import React, { useCallback, useEffect, useState } from 'react';
import { notifyOperationsChanged } from '../../layouts/useNavCounts';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Edit3, XCircle } from '../../components/ui/icons';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useToast } from '../../context/ToastContext';
import {
  BackLink,
  InfoItem,
  InlineAlert,
  OperationStatusBadge,
  StatusSteps,
  StockUpdatePanel,
  InfoGrid,
} from './OperationComponents';
import {
  DOC_KINDS,
  docRef,
  errorMessage,
  formatDateTime,
  formatQty,
  isTerminal,
  useCatalog,
  useStockLookup,
} from './operationUtils';
import {
  lineApi,
  stepLabels,
  workflowSteps,
  type LineDocKind,
  type LineDocument,
  type LineItem,
} from './operationWorkflow';

type PendingAction = { kind: 'step' | 'validate' | 'cancel'; label: string } | null;

const VALIDATE_COPY: Record<LineDocKind, string> = {
  receipt: 'Validating adds each line quantity to its destination location and records it in the stock ledger. This cannot be undone.',
  delivery: 'Validating removes each line quantity from its source location and records it in the stock ledger. It fails if stock is insufficient. This cannot be undone.',
  transfer: 'Validating decreases each source location and increases each destination location by the same amount. Global stock is unchanged. This cannot be undone.',
};

const th: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  fontWeight: 600,
};
const td: React.CSSProperties = { padding: '12px 14px', textAlign: 'left' };

export const OperationDetail: React.FC<{ kind: LineDocKind }> = ({ kind }) => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const meta = DOC_KINDS[kind];
  const { catalog, loading: catalogLoading, error: catalogError } = useCatalog();
  const { ensure: ensureStock, available } = useStockLookup();

  const [doc, setDoc] = useState<LineDocument | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [loadedDoc, loadedItems] = await Promise.all([
        lineApi[kind].get(id),
        lineApi[kind].items(id),
      ]);
      setDoc(loadedDoc);
      setItems(loadedItems);
    } catch (err) {
      setLoadError(errorMessage(err, `Failed to load ${meta.label.toLowerCase()}`));
    } finally {
      setLoading(false);
    }
  }, [id, kind, meta.label]);

  useEffect(() => {
    load();
  }, [load]);

  const showsAvailability = kind !== 'receipt' && doc !== null && !isTerminal(doc.status);
  useEffect(() => {
    if (showsAvailability) items.forEach((item) => ensureStock(item.product_id, true));
  }, [items, showsAvailability, ensureStock]);

  if (loading || catalogLoading) return <LoadingState message="Loading details..." height="300px" />;
  if (loadError || !doc) return <ErrorState message={loadError ?? 'Not found'} onRetry={load} />;
  if (catalogError) return <ErrorState message={catalogError} />;

  const step = workflowSteps[kind].find((s) => s.from === doc.status);
  const terminal = isTerminal(doc.status);
  const reference = docRef(kind, doc.id);

  const runAction = async () => {
    if (!pending) return;
    setRunning(true);
    setActionError(null);
    try {
      let updated: LineDocument;
      if (pending.kind === 'validate') {
        updated = await lineApi[kind].validate(doc.id);
        showToast('success', `${reference} validated`, 'Stock has been updated.');
      } else if (pending.kind === 'cancel') {
        updated = await lineApi[kind].cancel(doc.id);
        showToast('info', `${reference} canceled`, 'No stock was changed.');
      } else {
        updated = await (step as NonNullable<typeof step>).run(doc.id);
        showToast('success', `${reference}: ${pending.label}`, 'Status updated.');
      }
      setDoc(updated);
      notifyOperationsChanged();
    } catch (err) {
      const message = errorMessage(err, 'The action could not be completed');
      setActionError(message);
      showToast('error', 'Action failed', message);
      // Reload so the page reflects the backend's current status.
      lineApi[kind].get(doc.id).then(setDoc).catch(() => {});
    } finally {
      setRunning(false);
      setPending(null);
    }
  };

  return (
    <div>
      <BackLink to={meta.path} label={`Back to ${meta.plural}`} />
      <div className="page-header">
        <div>
          <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {meta.label} <span style={{ fontFamily: 'monospace' }}>{reference}</span>
            <OperationStatusBadge status={doc.status} />
          </h2>
          <p className="page-subtitle">Created {formatDateTime(doc.created_at)}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!terminal && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => navigate(`${meta.path}/${doc.id}/edit`)}
                disabled={running}
              >
                <Edit3 size={16} /> Edit
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setPending({ kind: 'cancel', label: 'Cancel' })}
                disabled={running}
              >
                <XCircle size={16} /> Cancel {meta.label}
              </button>
            </>
          )}
          {step && (
            <button
              className="btn btn-primary"
              onClick={() => setPending({ kind: 'step', label: step.label })}
              disabled={running || !items.length}
              title={!items.length ? 'Add at least one item first' : undefined}
            >
              <ArrowRight size={16} /> {step.label}
            </button>
          )}
          {doc.status === 'READY' && (
            <button
              className="btn btn-primary"
              onClick={() => setPending({ kind: 'validate', label: 'Validate' })}
              disabled={running}
            >
              <CheckCircle2 size={16} /> Validate
            </button>
          )}
        </div>
      </div>

      {actionError && <InlineAlert>{actionError}</InlineAlert>}
      {doc.status === 'DONE' && (
        <InlineAlert tone="success">
          This {meta.label.toLowerCase()} is done and stock has been updated. See the changes below.
        </InlineAlert>
      )}
      {doc.status === 'CANCELED' && (
        <InlineAlert>This {meta.label.toLowerCase()} was canceled. No stock was changed.</InlineAlert>
      )}

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          <StatusSteps steps={stepLabels[kind]} current={doc.status} />
        </div>
        <InfoGrid>
          <InfoItem label="Reference">{reference}</InfoItem>
          {kind === 'receipt' && <InfoItem label="Supplier">{doc.supplier || '—'}</InfoItem>}
          <InfoItem label="Created">{formatDateTime(doc.created_at)}</InfoItem>
          <InfoItem label="Last Updated">{formatDateTime(doc.updated_at)}</InfoItem>
          <InfoItem label="Items">{items.length}</InfoItem>
        </InfoGrid>
        {doc.notes && (
          <div style={{ marginTop: '16px' }}>
            <InfoItem label="Notes">
              <span style={{ fontWeight: 400, whiteSpace: 'pre-wrap' }}>{doc.notes}</span>
            </InfoItem>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <h3 style={{ margin: 0, padding: '16px 20px', fontSize: '1rem', fontWeight: 600 }}>Items</h3>
        {items.length === 0 ? (
          <p style={{ padding: '0 20px 20px', margin: 0, color: 'var(--text-muted)' }}>
            No items yet. Use Edit to add products before continuing.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-table-header)' }}>
                  <th style={th}>#</th>
                  <th style={th}>Product</th>
                  <th style={th}>From</th>
                  <th style={th}>To</th>
                  <th style={{ ...th, textAlign: 'right' }}>Quantity</th>
                  {showsAvailability && <th style={{ ...th, textAlign: 'right' }}>Available at Source</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const unit = catalog.unitOf(item.product_id);
                  const avail = showsAvailability ? available(item.product_id, item.location_id) : undefined;
                  const short = avail !== undefined && avail < Number(item.quantity);
                  const party = (label: string) => (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{label}</span>
                  );
                  return (
                    <tr key={item.id} style={{ borderTop: '1px solid var(--border-color-subtle)' }}>
                      <td style={td}>{index + 1}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{catalog.productLabel(item.product_id)}</td>
                      <td style={td}>
                        {kind === 'receipt'
                          ? party(doc.supplier || 'Vendor')
                          : catalog.locationLabel(item.location_id)}
                      </td>
                      <td style={td}>
                        {kind === 'receipt'
                          ? catalog.locationLabel(item.location_id)
                          : kind === 'delivery'
                            ? party('Customer')
                            : catalog.locationLabel(item.destination_location_id)}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>
                        {formatQty(item.quantity, unit)}
                      </td>
                      {showsAvailability && (
                        <td
                          style={{
                            ...td,
                            textAlign: 'right',
                            color: short ? 'var(--color-danger)' : 'var(--text-secondary)',
                          }}
                        >
                          {avail === undefined ? '…' : formatQty(avail, unit)}
                          {short && ' (insufficient)'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {doc.status === 'DONE' && <StockUpdatePanel referenceId={doc.id} catalog={catalog} />}

      <ConfirmationDialog
        isOpen={pending !== null}
        onClose={() => !running && setPending(null)}
        onConfirm={runAction}
        loading={running}
        isDanger={pending?.kind === 'cancel'}
        title={
          pending?.kind === 'validate'
            ? `Validate ${reference}?`
            : pending?.kind === 'cancel'
              ? `Cancel ${reference}?`
              : `${pending?.label ?? ''} — ${reference}`
        }
        message={
          pending?.kind === 'validate'
            ? VALIDATE_COPY[kind]
            : pending?.kind === 'cancel'
              ? `The ${meta.label.toLowerCase()} will be marked Canceled and can no longer be processed. Stock is not changed.`
              : `Move this ${meta.label.toLowerCase()} to the next stage. Stock is only changed when it is validated.`
        }
        confirmLabel={pending?.kind === 'cancel' ? `Cancel ${meta.label}` : pending?.label}
        cancelLabel="Back"
      />
    </div>
  );
};
