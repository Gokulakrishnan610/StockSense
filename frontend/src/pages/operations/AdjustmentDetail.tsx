import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from '../../components/ui/icons';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import type { Adjustment } from '../../types';
import {
  BackLink,
  InfoItem,
  InlineAlert,
  OperationStatusBadge,
  QuantityText,
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

  return (
    <div>
      <BackLink to={meta.path} label={`Back to ${meta.plural}`} />
      <div className="page-header">
        <div>
          <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            Adjustment <span style={{ fontFamily: 'monospace' }}>{reference}</span>
            <OperationStatusBadge status={adjustment.status} />
          </h2>
          <p className="page-subtitle">Created {formatDateTime(adjustment.created_at)}</p>
        </div>
        {isDraft && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => setPending('cancel')} disabled={running}>
              <XCircle size={16} /> Cancel Adjustment
            </button>
            <button className="btn btn-primary" onClick={() => setPending('validate')} disabled={running}>
              <CheckCircle2 size={16} /> Validate
            </button>
          </div>
        )}
      </div>

      {actionError && <InlineAlert>{actionError}</InlineAlert>}
      {adjustment.status === 'DONE' && (
        <InlineAlert tone="success">Adjustment validated. Stock now matches the physical count.</InlineAlert>
      )}
      {adjustment.status === 'CANCELED' && (
        <InlineAlert>This adjustment was canceled. No stock was changed.</InlineAlert>
      )}

      <div className="card">
        <div style={{ marginBottom: '16px' }}>
          <StatusSteps steps={STEPS} current={adjustment.status} />
        </div>
        <InfoGrid>
          <InfoItem label="Product">{catalog.productLabel(adjustment.product_id)}</InfoItem>
          <InfoItem label="Location">{catalog.locationLabel(adjustment.location_id)}</InfoItem>
          <InfoItem label={isDraft ? 'System Quantity (current)' : 'System Quantity'}>
            {systemQty === undefined ? '…' : formatQty(systemQty, unit)}
          </InfoItem>
          <InfoItem label="Physical Count">{formatQty(adjustment.counted_quantity, unit)}</InfoItem>
          <InfoItem label={isDraft ? 'Difference (preview)' : 'Difference'}>
            {difference === undefined ? '—' : <QuantityText value={difference} unit={unit} />}
          </InfoItem>
        </InfoGrid>
        <div style={{ marginTop: '16px' }}>
          <InfoItem label="Reason">
            <span style={{ fontWeight: 400 }}>{adjustment.reason}</span>
          </InfoItem>
        </div>
      </div>

      {adjustment.status === 'DONE' && <StockUpdatePanel referenceId={adjustment.id} catalog={catalog} />}

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
