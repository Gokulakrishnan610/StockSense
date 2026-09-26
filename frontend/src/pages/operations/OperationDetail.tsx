import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Edit3, History, XCircle } from '../../components/ui/icons';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { notifyOperationsChanged } from '../../layouts/useNavCounts';
import { api } from '../../services/api';
import type { LedgerEntry } from '../../types';
import { ActivityTrail, CopyRef, PrintButton, PrintSlip, Stepper, type ActivityEvent } from './DocumentParts';
import { InlineAlert, OperationStatusBadge, StockUpdatePanel } from './OperationComponents';
import {
  DOC_KINDS,
  STATUS_LABELS,
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
import './operations.css';

type PendingAction = { kind: 'step' | 'validate' | 'cancel'; label: string } | null;

const VALIDATE_COPY: Record<LineDocKind, string> = {
  receipt: 'Validating adds each line quantity to its destination location and records it in the stock ledger. This cannot be undone.',
  delivery: 'Validating removes each line quantity from its source location and records it in the stock ledger. It fails if stock is insufficient. This cannot be undone.',
  transfer: 'Validating decreases each source location and increases each destination location by the same amount. Global stock is unchanged. This cannot be undone.',
};

const DONE_VERB: Record<LineDocKind, string> = { receipt: 'Received', delivery: 'Shipped', transfer: 'Moved' };
const SLIP_TITLE: Record<LineDocKind, string> = {
  receipt: 'Goods Receipt Slip',
  delivery: 'Delivery Slip',
  transfer: 'Internal Transfer Slip',
};
const SIGNATURES: Record<LineDocKind, string[]> = {
  receipt: ['Delivered by (supplier)', 'Received by', 'Checked by'],
  delivery: ['Picked by', 'Packed by', 'Received by (customer)'],
  transfer: ['Issued by', 'Received by'],
};

export const OperationDetail: React.FC<{ kind: LineDocKind }> = ({ kind }) => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const meta = DOC_KINDS[kind];
  const { catalog, loading: catalogLoading, error: catalogError } = useCatalog();
  const { ensure: ensureStock, available } = useStockLookup();

  const [doc, setDoc] = useState<LineDocument | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [loadedDoc, loadedItems, entries] = await Promise.all([
        lineApi[kind].get(id),
        lineApi[kind].items(id),
        api.getLedger({ reference_id: id, limit: 100 }),
      ]);
      setDoc(loadedDoc);
      setItems(loadedItems);
      setLedger(entries);
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

  const events = useMemo<ActivityEvent[]>(() => {
    if (!doc) return [];
    const list: ActivityEvent[] = [
      {
        key: 'created',
        at: doc.created_at,
        title: `${meta.label} created`,
        detail: doc.created_by === user?.id ? `By ${user?.name}` : undefined,
      },
    ];
    if (ledger.length) {
      const first = [...ledger].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
      list.push({
        key: 'validated',
        at: first.created_at,
        title: 'Validated — stock updated',
        detail: `By ${first.user_name} · ${ledger.length} ledger entr${ledger.length === 1 ? 'y' : 'ies'} recorded`,
        tone: 'success',
      });
    } else if (doc.updated_at !== doc.created_at) {
      list.push({
        key: 'updated',
        at: doc.updated_at,
        title: doc.status === 'CANCELED' ? 'Canceled' : `Last updated — status ${STATUS_LABELS[doc.status]}`,
        detail: doc.status === 'CANCELED' ? 'No stock was changed' : undefined,
        tone: doc.status === 'CANCELED' ? 'danger' : 'neutral',
      });
    }
    // Newest first; events recorded in the same instant keep their logical order reversed.
    return list.map((event, index) => ({ event, index }))
      .sort((a, b) => b.event.at.localeCompare(a.event.at) || b.index - a.index)
      .map(({ event }) => event);
  }, [doc, ledger, meta.label, user]);

  if (loading || catalogLoading) return <LoadingState message="Loading details..." height="300px" />;
  if (loadError || !doc) return <ErrorState message={loadError ?? 'Not found'} onRetry={load} />;
  if (catalogError) return <ErrorState message={catalogError} />;

  const step = workflowSteps[kind].find((s) => s.from === doc.status);
  const terminal = isTerminal(doc.status);
  const reference = docRef(kind, doc.id);
  const hasFrom = kind !== 'receipt';
  const hasTo = kind !== 'delivery';
  const fromOf = (item: LineItem) => (hasFrom ? item.location_id : undefined);
  const toOf = (item: LineItem) => (kind === 'receipt' ? item.location_id : item.destination_location_id);

  const units = new Set(items.map((i) => catalog.unitOf(i.product_id)));
  const totalQty = items.reduce((sum, i) => sum + Number(i.quantity), 0);
  const totalLabel = units.size > 1 ? 'Mixed units' : formatQty(totalQty, [...units][0]);
  const summarize = (ids: Array<string | undefined>) => {
    const unique = [...new Set(ids.filter(Boolean))] as string[];
    if (!unique.length) return '—';
    return unique.length === 1 ? catalog.locationLabel(unique[0]) : `${catalog.locationLabel(unique[0])} +${unique.length - 1} more`;
  };
  const warehouseCodes = [
    ...new Set(
      items
        .flatMap((i) => [fromOf(i), toOf(i)])
        .map((locId) => (locId ? catalog.locationById.get(locId)?.warehouse_id : undefined))
        .map((whId) => (whId ? catalog.warehouseById.get(whId) : undefined))
        .filter(Boolean)
        .map((w) => `${w!.short_code} — ${w!.name}`)
    ),
  ];
  const title =
    kind === 'receipt' ? doc.supplier || 'Receipt' : kind === 'delivery' ? 'Delivery Order' : 'Internal Transfer';
  const routeText =
    kind === 'receipt'
      ? `Destination: ${summarize(items.map(toOf))}`
      : kind === 'delivery'
        ? `Source: ${summarize(items.map(fromOf))}`
        : `${summarize(items.map(fromOf))} → ${summarize(items.map(toOf))}`;

  const runAction = async () => {
    if (!pending) return;
    setRunning(true);
    setActionError(null);
    try {
      if (pending.kind === 'validate') {
        await lineApi[kind].validate(doc.id);
        showToast('success', `${reference} validated`, 'Stock has been updated.');
      } else if (pending.kind === 'cancel') {
        await lineApi[kind].cancel(doc.id);
        showToast('info', `${reference} canceled`, 'No stock was changed.');
      } else {
        await (step as NonNullable<typeof step>).run(doc.id);
        showToast('success', `${reference}: ${pending.label}`, 'Status updated.');
      }
      notifyOperationsChanged();
      await load();
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

  const slipLines = items.map((item) => {
    const product = catalog.productById.get(item.product_id);
    return {
      sku: product?.sku ?? '',
      name: product?.name ?? item.product_id.slice(0, 8),
      from: hasFrom ? catalog.locationLabel(fromOf(item)) : undefined,
      to: hasTo ? catalog.locationLabel(toOf(item)) : undefined,
      quantity: formatQty(item.quantity, product?.unit_of_measure),
    };
  });

  return (
    <div className="op-detail-page">
      <div className="op-page-header no-print">
        <button className="icon-button" onClick={() => navigate(meta.path)} aria-label={`Back to ${meta.plural}`}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="op-header-meta">
            <CopyRef value={reference} />
            <OperationStatusBadge status={doc.status} />
            <span className="cell-sub">{meta.label}</span>
          </div>
          <h2 className="page-title">{title}</h2>
          <p className="page-subtitle">{routeText}</p>
        </div>
        <div className="op-header-actions">
          <PrintButton />
          {!terminal && (
            <button className="btn btn-secondary" onClick={() => navigate(`${meta.path}/${doc.id}/edit`)} disabled={running}>
              <Edit3 size={16} /> Edit
            </button>
          )}
          {step && (
            <button
              className="btn btn-primary"
              onClick={() => setPending({ kind: 'step', label: step.label })}
              disabled={running || !items.length}
              title={!items.length ? 'Add at least one product line first' : undefined}
            >
              <ArrowRight size={16} /> {step.label}
            </button>
          )}
          {doc.status === 'READY' && (
            <button className="btn btn-primary" onClick={() => setPending({ kind: 'validate', label: 'Validate' })} disabled={running}>
              <CheckCircle2 size={16} /> Validate
            </button>
          )}
          {!terminal && (
            <button className="btn btn-danger-outline" onClick={() => setPending({ kind: 'cancel', label: 'Cancel' })} disabled={running}>
              <XCircle size={16} /> Cancel
            </button>
          )}
        </div>
      </div>

      <div className="no-print">
        {actionError && <InlineAlert>{actionError}</InlineAlert>}

        <div className="card stepper-card">
          <Stepper steps={stepLabels[kind]} current={doc.status} />
        </div>

        <div className="summary-strip">
          <div>
            <span className="summary-label">Total Quantity</span>
            <span className="summary-value">{totalLabel}</span>
            <span className="cell-sub">Across {items.length} line{items.length === 1 ? '' : 's'}</span>
          </div>
          <div>
            <span className="summary-label">Warehouse</span>
            <span className="summary-value small">{warehouseCodes[0] ?? '—'}</span>
            <span className="cell-sub">{warehouseCodes.length > 1 ? `+${warehouseCodes.length - 1} more` : ' '}</span>
          </div>
          <div>
            <span className="summary-label">Created</span>
            <span className="summary-value small">{formatDateTime(doc.created_at)}</span>
            <span className="cell-sub">Updated {formatDateTime(doc.updated_at)}</span>
          </div>
          <div>
            <span className="summary-label">{kind === 'receipt' ? 'Destination' : kind === 'delivery' ? 'Source' : 'Route'}</span>
            <span className="summary-value small mono">{routeText.replace(/^(Destination|Source): /, '')}</span>
            <span className="cell-sub">{kind === 'receipt' ? 'Receiving location' : kind === 'delivery' ? 'Picking location' : 'From → to'}</span>
          </div>
        </div>

        <section className="card panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="dot dot-primary" />
              <h3>Product Lines ({items.length})</h3>
            </div>
            <span className="mono cell-sub">{totalLabel} total</span>
          </div>
          {items.length === 0 ? (
            <p className="panel-body cell-sub">No product lines yet. Use Edit to add products before continuing.</p>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    {hasFrom && <th>From</th>}
                    {hasTo && <th>To</th>}
                    <th className="num">Quantity</th>
                    {showsAvailability && <th className="num">Available at Source</th>}
                    <th className="num">Fulfilment</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const product = catalog.productById.get(item.product_id);
                    const unit = product?.unit_of_measure;
                    const avail = showsAvailability ? available(item.product_id, item.location_id) : undefined;
                    const short = avail !== undefined && avail < Number(item.quantity);
                    return (
                      <tr key={item.id}>
                        <td>
                          <Link className="ref-link" to={`/products/${item.product_id}`}>{product?.sku ?? '—'}</Link>
                        </td>
                        <td className="cell-main">{product?.name ?? item.product_id.slice(0, 8)}</td>
                        {hasFrom && <td className="mono">{catalog.locationLabel(fromOf(item))}</td>}
                        {hasTo && <td className="mono">{catalog.locationLabel(toOf(item))}</td>}
                        <td className="num"><strong>{formatQty(item.quantity, unit)}</strong></td>
                        {showsAvailability && (
                          <td className="num" style={{ color: short ? 'var(--color-danger)' : undefined }}>
                            {avail === undefined ? '…' : formatQty(avail, unit)}
                            {short && <div className="cell-sub" style={{ color: 'var(--color-danger)' }}>Insufficient</div>}
                          </td>
                        )}
                        <td className="num">
                          {doc.status === 'DONE' ? (
                            <span className="text-success">{DONE_VERB[kind]}</span>
                          ) : doc.status === 'CANCELED' ? (
                            <span className="cell-sub">Canceled</span>
                          ) : (
                            <span className="cell-sub">Pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {doc.notes && (
            <div className="panel-footer" style={{ justifyContent: 'flex-start' }}>
              <span><strong style={{ color: 'var(--text-primary)' }}>Notes:</strong> {doc.notes}</span>
            </div>
          )}
        </section>

        {doc.status === 'DONE' && <StockUpdatePanel referenceId={doc.id} catalog={catalog} />}

        <section className="card panel" style={{ marginTop: 16 }}>
          <div className="panel-header">
            <div className="panel-title">
              <History size={16} />
              <h3>Activity & Audit Trail</h3>
            </div>
            <span className="mono cell-sub">{events.length} event{events.length === 1 ? '' : 's'}</span>
          </div>
          <div className="panel-body">
            <ActivityTrail events={events} />
          </div>
        </section>
      </div>

      <PrintSlip
        title={SLIP_TITLE[kind]}
        reference={reference}
        status={STATUS_LABELS[doc.status]}
        meta={[
          ...(kind === 'receipt' ? [{ label: 'Supplier', value: doc.supplier ?? '' }] : []),
          { label: 'Created', value: formatDateTime(doc.created_at) },
          { label: kind === 'transfer' ? 'Route' : kind === 'receipt' ? 'Destination' : 'Source', value: routeText.replace(/^(Destination|Source): /, '') },
          { label: 'Total', value: totalLabel },
        ]}
        lines={slipLines}
        showFrom={hasFrom}
        showTo={hasTo}
        notes={doc.notes}
        signatures={SIGNATURES[kind]}
      />

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
