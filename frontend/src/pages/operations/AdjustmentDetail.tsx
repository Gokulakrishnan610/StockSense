import React, { useCallback, useEffect, useState } from 'react';
import { notifyOperationsChanged } from '../../layouts/useNavCounts';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, History, XCircle } from '../../components/ui/icons';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import type { Adjustment } from '../../types';
import { InlineAlert, OperationStatusBadge, QuantityText, StockUpdatePanel } from './OperationComponents';
import { ActivityTrail, CopyRef, PrintButton, PrintSlip, Stepper, type ActivityEvent } from './DocumentParts';
import './operations.css';
import {
  DOC_KINDS,
  STATUS_LABELS,
  docRef,
  errorMessage,
  formatDateTime,
  formatQty,
  useCatalog,
  useStockLookup,
} from './operationUtils';

const STEPS = [
  { status: 'DRAFT' as const, label: 'Draft' },
  { status: 'DONE' as const, label: 'Done' },
];

export const AdjustmentDetail: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const meta = DOC_KINDS.adjustment;
  const { catalog, loading: catalogLoading, error: catalogError } = useCatalog();
  const { ensure: ensureStock, available } = useStockLookup();

  const [adjustment, setAdjustment] = useState<Adjustment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<'validate' | 'cancel' | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setAdjustment(await api.getAdjustment(id));
    } catch (err) {
      setLoadError(errorMessage(err, 'Failed to load adjustment'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const isDraft = adjustment?.status === 'DRAFT';
  useEffect(() => {
    if (adjustment && isDraft) ensureStock(adjustment.product_id, true);
  }, [adjustment, isDraft, ensureStock]);

  if (loading || catalogLoading) return <LoadingState message="Loading details..." height="300px" />;
  if (loadError || !adjustment) return <ErrorState message={loadError ?? 'Not found'} onRetry={load} />;
  if (catalogError) return <ErrorState message={catalogError} />;

  const reference = docRef('adjustment', adjustment.id);
  const unit = catalog.unitOf(adjustment.product_id);
  // Before validation the recorded quantity is not stored yet; preview from live stock.
  const liveSystemQty = isDraft ? available(adjustment.product_id, adjustment.location_id) : undefined;
  const systemQty =
    adjustment.recorded_quantity !== null ? Number(adjustment.recorded_quantity) : liveSystemQty;
  const difference =
    adjustment.delta !== null
      ? Number(adjustment.delta)
      : systemQty !== undefined
        ? Number(adjustment.counted_quantity) - systemQty
        : undefined;

  const runAction = async () => {
    if (!pending) return;
    setRunning(true);
    setActionError(null);
    try {
      if (pending === 'validate') {
        setAdjustment(await api.validateAdjustment(adjustment.id));
        showToast('success', `${reference} validated`, 'Stock has been updated.');
      } else {
        setAdjustment(await api.cancelAdjustment(adjustment.id));
        showToast('info', `${reference} canceled`, 'No stock was changed.');
      }
      notifyOperationsChanged();
    } catch (err) {
      const message = errorMessage(err, 'The action could not be completed');
      setActionError(message);
      showToast('error', 'Action failed', message);
      api.getAdjustment(adjustment.id).then(setAdjustment).catch(() => {});
    } finally {
      setRunning(false);
      setPending(null);
    }
  };

  const product = catalog.productById.get(adjustment.product_id);
  const events: ActivityEvent[] = [
    { key: 'created', at: adjustment.created_at, title: 'Count recorded', detail: `Physical count ${formatQty(adjustment.counted_quantity, unit)}` },
  ];
  if (adjustment.status !== 'DRAFT') {
    events.push({
      key: 'closed',
      at: adjustment.updated_at,
      title: adjustment.status === 'DONE' ? 'Validated — stock reconciled' : 'Canceled',
      detail:
        adjustment.status === 'DONE'
          ? `System ${formatQty(adjustment.recorded_quantity, unit)} → counted ${formatQty(adjustment.counted_quantity, unit)}`
          : 'No stock was changed',
      tone: adjustment.status === 'DONE' ? 'success' : 'danger',
    });
  }
  events.reverse();

  return (
    <div className="op-detail-page">
      <div className="op-page-header no-print">
        <button className="icon-button" onClick={() => navigate(meta.path)} aria-label={`Back to ${meta.plural}`}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="op-header-meta">
            <CopyRef value={reference} />
            <OperationStatusBadge status={adjustment.status} />
            <span className="cell-sub">Inventory Adjustment</span>
          </div>
          <h2 className="page-title">{product?.name ?? 'Stock count'}</h2>
          <p className="page-subtitle">Count at {catalog.locationLabel(adjustment.location_id)}</p>
        </div>
        <div className="op-header-actions">
          <PrintButton />
          {isDraft && (
            <>
              <button className="btn btn-primary" onClick={() => setPending('validate')} disabled={running}>
                <CheckCircle2 size={16} /> Validate
              </button>
              <button className="btn btn-danger-outline" onClick={() => setPending('cancel')} disabled={running}>
                <XCircle size={16} /> Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="no-print">
        {actionError && <InlineAlert>{actionError}</InlineAlert>}

        <div className="card stepper-card">
          <Stepper steps={STEPS} current={adjustment.status} />
        </div>

        <div className="summary-strip">
          <div>
            <span className="summary-label">{isDraft ? 'System Qty (now)' : 'System Qty'}</span>
            <span className="summary-value">{systemQty === undefined ? '…' : formatQty(systemQty, unit)}</span>
            <span className="cell-sub">{isDraft ? 'Re-read on validation' : 'At validation'}</span>
          </div>
          <div>
            <span className="summary-label">Physical Count</span>
            <span className="summary-value">{formatQty(adjustment.counted_quantity, unit)}</span>
            <span className="cell-sub">Counted on the floor</span>
          </div>
          <div>
            <span className="summary-label">{isDraft ? 'Difference (preview)' : 'Difference'}</span>
            <span className="summary-value">
              {difference === undefined ? '—' : <QuantityText value={difference} unit={unit} />}
            </span>
            <span className="cell-sub">Physical minus system</span>
          </div>
          <div>
            <span className="summary-label">Location</span>
            <span className="summary-value small mono">{catalog.locationLabel(adjustment.location_id)}</span>
            <span className="cell-sub">{product?.sku}</span>
          </div>
        </div>

        <section className="card panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="dot dot-warning" />
              <h3>Reason</h3>
            </div>
          </div>
          <p className="panel-body" style={{ fontSize: 14 }}>{adjustment.reason}</p>
        </section>

        {adjustment.status === 'DONE' && <StockUpdatePanel referenceId={adjustment.id} catalog={catalog} />}

        <section className="card panel" style={{ marginTop: 16 }}>
          <div className="panel-header">
            <div className="panel-title">
              <History size={16} />
              <h3>Activity & Audit Trail</h3>
            </div>
          </div>
          <div className="panel-body">
            <ActivityTrail events={events} />
          </div>
        </section>
      </div>

      <PrintSlip
        title="Inventory Adjustment Slip"
        reference={reference}
        status={STATUS_LABELS[adjustment.status]}
        meta={[
          { label: 'Location', value: catalog.locationLabel(adjustment.location_id) },
          { label: 'Created', value: formatDateTime(adjustment.created_at) },
          { label: 'System quantity', value: systemQty === undefined ? '—' : formatQty(systemQty, unit) },
          { label: 'Difference', value: difference === undefined ? '—' : formatQty(difference, unit) },
        ]}
        lines={[
          {
            sku: product?.sku ?? '',
            name: product?.name ?? adjustment.product_id.slice(0, 8),
            to: catalog.locationLabel(adjustment.location_id),
            quantity: formatQty(adjustment.counted_quantity, unit),
          },
        ]}
        showFrom={false}
        showTo
        notes={`Reason: ${adjustment.reason}`}
        signatures={['Counted by', 'Approved by']}
      />

      <ConfirmationDialog
        isOpen={pending !== null}
        onClose={() => !running && setPending(null)}
        onConfirm={runAction}
        loading={running}
        isDanger={pending === 'cancel'}
        title={pending === 'cancel' ? `Cancel ${reference}?` : `Validate ${reference}?`}
        message={
          pending === 'cancel'
            ? 'The adjustment will be marked Canceled. Stock is not changed.'
            : 'The backend sets the location quantity to the physical count and records the difference in the stock ledger. This cannot be undone.'
        }
        confirmLabel={pending === 'cancel' ? 'Cancel Adjustment' : 'Validate'}
        cancelLabel="Back"
      />
    </div>
  );
};
