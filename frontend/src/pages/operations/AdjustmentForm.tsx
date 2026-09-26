import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { BackLink, InlineAlert, QuantityText } from './OperationComponents';
import {
  DOC_KINDS,
  docRef,
  errorMessage,
  formatQty,
  quantityError,
  useCatalog,
  useStockLookup,
} from './operationUtils';

const REASONS = ['Damaged', 'Lost / Missing', 'Found / Surplus', 'Physical count correction', 'Other'];

export const AdjustmentForm: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const meta = DOC_KINDS.adjustment;
  const { catalog, loading, error, reload } = useCatalog();
  const { ensure: ensureStock, available } = useStockLookup();

  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [counted, setCounted] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'save' | 'validate' | null>(null);

  useEffect(() => {
    ensureStock(productId);
  }, [productId, ensureStock]);

  if (loading) return <LoadingState message="Loading form..." height="300px" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const unit = catalog.unitOf(productId);
  const systemQty = productId && locationId ? available(productId, locationId) : undefined;
  const countedValid = counted.trim() !== '' && !quantityError(counted, true);
  const difference =
    systemQty !== undefined && countedValid ? Number(counted) - systemQty : undefined;
  const locations = catalog.locations.filter((l) => !warehouseId || l.warehouse_id === warehouseId);

  const submit = async (mode: 'save' | 'validate') => {
    const problem = !productId
      ? 'Select a product.'
      : !locationId
        ? 'Select a location.'
        : quantityError(counted, true)
          ? `Physical count: ${quantityError(counted, true)}.`
          : !reason
            ? 'A reason is required for inventory adjustments.'
            : reason === 'Other' && !notes.trim()
              ? 'Describe the reason in the notes when choosing "Other".'
              : null;
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError(null);
    setSubmitting(mode);
    let createdId: string | undefined;
    try {
      const fullReason = notes.trim() ? `${reason}: ${notes.trim()}` : reason;
      const adjustment = await api.createAdjustment({
        product_id: productId,
        location_id: locationId,
        counted_quantity: counted.trim(),
        reason: fullReason.slice(0, 500),
      });
      createdId = adjustment.id;
      if (mode === 'validate') {
        await api.validateAdjustment(adjustment.id);
        showToast('success', 'Adjustment validated', 'Stock has been updated.');
      } else {
        showToast('success', 'Adjustment saved', `${docRef('adjustment', adjustment.id)} saved as draft.`);
      }
      navigate(`${meta.path}/${adjustment.id}`);
    } catch (err) {
      const message = errorMessage(err, 'Failed to save adjustment');
      if (createdId) {
        showToast('error', 'Adjustment not validated', message);
        navigate(`${meta.path}/${createdId}`);
        return;
      }
      setFormError(message);
    } finally {
      setSubmitting(null);
    }
  };

  const busy = submitting !== null;

  return (
    <div>
      <BackLink to={meta.path} label={`Back to ${meta.plural}`} />
      <div className="page-header">
        <div>
          <h2 className="page-title">Create Adjustment</h2>
          <p className="page-subtitle">
            Record a physical count; the backend calculates the difference against the system quantity
          </p>
        </div>
      </div>

      <div className="card">
        {formError && <InlineAlert>{formError}</InlineAlert>}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
          }}
        >
          <div className="form-group">
            <label className="form-label" htmlFor="adj-product">Product *</label>
            <select
              id="adj-product"
              className="form-input"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={busy}
            >
              <option value="">Select product</option>
              {catalog.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="adj-warehouse">Warehouse</label>
            <select
              id="adj-warehouse"
              className="form-input"
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setLocationId('');
              }}
              disabled={busy}
            >
              <option value="">All warehouses</option>
              {catalog.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.short_code})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="adj-location">Location *</label>
            <select
              id="adj-location"
              className="form-input"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              disabled={busy}
            >
              <option value="">Select location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {catalog.locationLabel(l.id)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
          }}
        >
          <div className="form-group">
            <label className="form-label">System Quantity</label>
            <input
              className="form-input"
              readOnly
              disabled
              value={systemQty === undefined ? '—' : formatQty(systemQty, unit)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="adj-counted">
              Physical Count {unit && `(${unit})`} *
            </label>
            <input
              id="adj-counted"
              className="form-input"
              inputMode="decimal"
              placeholder="0"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              disabled={busy}
            />
            {counted && quantityError(counted, true) && (
              <span className="form-error">{quantityError(counted, true)}</span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Difference</label>
            <div
              className="form-input"
              style={{ display: 'flex', alignItems: 'center', minHeight: '40px' }}
              aria-live="polite"
            >
              {difference === undefined ? '—' : <QuantityText value={difference} unit={unit} />}
            </div>
          </div>
        </div>
        <p style={{ margin: '-4px 0 16px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          The difference shown is a preview. On validation the backend reads the current system
          quantity again and records the exact difference in the stock ledger.
        </p>

        <div className="form-group">
          <label className="form-label" htmlFor="adj-reason">Reason *</label>
          <select
            id="adj-reason"
            className="form-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
          >
            <option value="">Select reason</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="adj-notes">Notes</label>
          <textarea
            id="adj-notes"
            className="form-input"
            rows={3}
            maxLength={400}
            placeholder="Enter notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => navigate(meta.path)} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-secondary" onClick={() => submit('save')} disabled={busy}>
            {submitting === 'save' ? 'Saving...' : 'Save as Draft'}
          </button>
          <button className="btn btn-primary" onClick={() => submit('validate')} disabled={busy}>
            {submitting === 'validate' ? 'Validating...' : 'Validate Adjustment'}
          </button>
        </div>
      </div>
    </div>
  );
};
