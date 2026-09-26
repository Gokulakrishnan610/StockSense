import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from '../../components/ui/icons';
import { Select } from '../../components/ui/Select';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { InlineAlert, QuantityText } from './OperationComponents';
import './operations.css';
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
    <div className="op-form-page">
      <div className="op-page-header">
        <button className="icon-button" onClick={() => navigate(meta.path)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="page-title">Create Inventory Adjustment</h2>
          <p className="page-subtitle">
            Record a physical count; the backend calculates the difference against the system quantity.
          </p>
        </div>
        <Link to={meta.path} className="panel-link">Cancel</Link>
      </div>

      <div className="card op-form">
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
            <Select
              id="adj-product"
              value={productId}
              onChange={setProductId}
              options={catalog.products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
              placeholder="Select product"
              disabled={busy}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="adj-warehouse">Warehouse</label>
            <Select
              id="adj-warehouse"
              value={warehouseId}
              onChange={(v) => { setWarehouseId(v); setLocationId(''); }}
              options={[
                { value: '', label: 'All warehouses' },
                ...catalog.warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.short_code})` })),
              ]}
              placeholder="All warehouses"
              disabled={busy}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="adj-location">Location *</label>
            <Select
              id="adj-location"
              value={locationId}
              onChange={setLocationId}
              options={locations.map((l) => ({ value: l.id, label: catalog.locationLabel(l.id) }))}
              placeholder="Select location"
              disabled={busy}
            />
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
          <Select
            id="adj-reason"
            value={reason}
            onChange={setReason}
            options={REASONS.map((r) => ({ value: r, label: r }))}
            placeholder="Select reason"
            disabled={busy}
          />
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

        <div className="op-form-footer">
          <span className="form-hint">Validating sets the location quantity to the physical count and records the difference.</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
    </div>
  );
};
