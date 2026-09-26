import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Plus, Trash2 } from '../../components/ui/icons';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useToast } from '../../context/ToastContext';
import type { OperationStatusCode } from '../../types';
import { BackLink, InlineAlert, OperationStatusBadge } from './OperationComponents';
import {
  DOC_KINDS,
  docRef,
  errorMessage,
  formatQty,
  isTerminal,
  quantityError,
  useCatalog,
  useStockLookup,
  type Catalog,
} from './operationUtils';
import { advanceToReady, lineApi, type LineDocKind } from './operationWorkflow';

interface Line {
  key: string;
  /** Backend line id for lines that already exist. */
  id?: string;
  product_id: string;
  source_warehouse_id: string;
  location_id: string;
  destination_warehouse_id: string;
  destination_location_id: string;
  quantity: string;
}

type LineSnapshot = Pick<Line, 'product_id' | 'location_id' | 'destination_location_id' | 'quantity'>;

const newKey = () => Math.random().toString(36).slice(2, 10);

const emptyLine = (): Line => ({
  key: newKey(),
  product_id: '',
  source_warehouse_id: '',
  location_id: '',
  destination_warehouse_id: '',
  destination_location_id: '',
  quantity: '',
});

const sameLine = (a: LineSnapshot, b: LineSnapshot) =>
  a.product_id === b.product_id &&
  a.location_id === b.location_id &&
  a.destination_location_id === b.destination_location_id &&
  Number(a.quantity) === Number(b.quantity);

const COPY: Record<LineDocKind, { subtitle: string; locationLabel: string; validateLabel: string }> = {
  receipt: {
    subtitle: 'Record incoming goods from a supplier into a stock location',
    locationLabel: 'Destination Location',
    validateLabel: 'Validate Receipt',
  },
  delivery: {
    subtitle: 'Ship goods out of a stock location (Pick → Pack → Validate)',
    locationLabel: 'Source Location',
    validateLabel: 'Validate Delivery',
  },
  transfer: {
    subtitle: 'Move stock between warehouses or locations; global stock stays the same',
    locationLabel: 'From',
    validateLabel: 'Validate Transfer',
  },
};

const LocationSelect: React.FC<{
  catalog: Catalog;
  value: string;
  onChange: (value: string) => void;
  warehouseId?: string;
  disabled?: boolean;
  ariaLabel: string;
}> = ({ catalog, value, onChange, warehouseId, disabled, ariaLabel }) => {
  const warehouses = warehouseId
    ? catalog.warehouses.filter((w) => w.id === warehouseId)
    : catalog.warehouses;
  return (
    <select
      className="form-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <option value="">Select location</option>
      {warehouses.map((w) => (
        <optgroup key={w.id} label={`${w.name} (${w.short_code})`}>
          {catalog.locations
            .filter((l) => l.warehouse_id === w.id)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.short_code})
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
};

const WarehouseSelect: React.FC<{
  catalog: Catalog;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
}> = ({ catalog, value, onChange, disabled, ariaLabel }) => (
  <select
    className="form-input"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    disabled={disabled}
    aria-label={ariaLabel}
  >
    <option value="">Any warehouse</option>
    {catalog.warehouses.map((w) => (
      <option key={w.id} value={w.id}>
        {w.name} ({w.short_code})
      </option>
    ))}
  </select>
);

export const OperationForm: React.FC<{ kind: LineDocKind }> = ({ kind }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const meta = DOC_KINDS[kind];
  const copy = COPY[kind];
  const isEdit = Boolean(id);
  const { catalog, loading: catalogLoading, error: catalogError, reload } = useCatalog();
  const { ensure: ensureStock, available: availableAt } = useStockLookup();

  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>(() => [emptyLine()]);
  const [originalLines, setOriginalLines] = useState<Map<string, LineSnapshot>>(new Map());
  const [status, setStatus] = useState<OperationStatusCode>('DRAFT');
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'save' | 'validate' | null>(null);

  const usesSourceStock = kind !== 'receipt';

  useEffect(() => {
    if (!id) return;
    let active = true;
    const docApi = lineApi[kind];
    Promise.all([docApi.get(id), docApi.items(id)])
      .then(([doc, items]) => {
        if (!active) return;
        setSupplier(doc.supplier ?? '');
        setNotes(doc.notes);
        setStatus(doc.status);
        const loaded: Line[] = items.map((item) => ({
          ...emptyLine(),
          id: item.id,
          product_id: item.product_id,
          location_id: item.location_id,
          destination_location_id: item.destination_location_id ?? '',
          quantity: String(Number(item.quantity)),
        }));
        setLines(loaded.length ? loaded : [emptyLine()]);
        setOriginalLines(new Map(loaded.map((l) => [l.id as string, { ...l }])));
      })
      .catch((err) => active && setLoadError(errorMessage(err, `Failed to load ${meta.label}`)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, kind, meta.label]);

  useEffect(() => {
    if (usesSourceStock) lines.forEach((line) => ensureStock(line.product_id));
  }, [lines, usesSourceStock, ensureStock]);

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  // Total requested per product/source location, so split lines are checked together.
  const requested = useMemo(() => {
    const totals = new Map<string, number>();
    lines.forEach((line) => {
      if (!line.product_id || !line.location_id || quantityError(line.quantity)) return;
      const k = `${line.product_id}|${line.location_id}`;
      totals.set(k, (totals.get(k) ?? 0) + Number(line.quantity));
    });
    return totals;
  }, [lines]);

  const shortage = (line: Line) => {
    if (!usesSourceStock || !line.product_id || !line.location_id) return null;
    const available = availableAt(line.product_id, line.location_id);
    const total = requested.get(`${line.product_id}|${line.location_id}`) ?? 0;
    if (available === undefined || total <= available) return null;
    return `Only ${formatQty(available, catalog.unitOf(line.product_id))} available at this location`;
  };

  const validateForm = (forValidation: boolean): string | null => {
    if (kind === 'receipt' && !supplier.trim()) return 'Supplier is required.';
    const filled = lines.filter(
      (l) => l.product_id || l.location_id || l.destination_location_id || l.quantity
    );
    if (!filled.length) return 'Add at least one item.';
    for (const [index, line] of filled.entries()) {
      const n = `Item ${index + 1}`;
      if (!line.product_id) return `${n}: select a product.`;
      if (!line.location_id) return `${n}: select ${kind === 'transfer' ? 'a source' : 'a'} location.`;
      if (kind === 'transfer') {
        if (!line.destination_location_id) return `${n}: select a destination location.`;
        if (line.destination_location_id === line.location_id)
          return `${n}: source and destination must be different locations.`;
      }
      const qtyError = quantityError(line.quantity);
      if (qtyError) return `${n}: ${qtyError}.`;
      if (forValidation && shortage(line)) return `${n}: ${shortage(line)}.`;
    }
    return null;
  };

  /** Saves header and lines; reports the document id as soon as it exists. */
  const persist = async (onDocument: (docId: string) => void): Promise<string> => {
    const docApi = lineApi[kind];
    const header = { supplier: supplier.trim(), notes: notes.trim() };
    let docId = id;
    if (docId) {
      await docApi.update(docId, header);
    } else {
      docId = (await docApi.create(header)).id;
    }
    onDocument(docId);
    const filled = lines.filter((l) => l.product_id);
    const keptIds = new Set<string>();
    for (const line of filled) {
      const original = line.id ? originalLines.get(line.id) : undefined;
      if (line.id && original && sameLine(original, line)) {
        keptIds.add(line.id);
        continue;
      }
      await docApi.addItem(docId, {
        product_id: line.product_id,
        location_id: line.location_id,
        destination_location_id: line.destination_location_id,
        quantity: line.quantity.trim(),
      });
    }
    // Remove lines that were deleted or edited (edited lines were re-added above).
    for (const lineId of originalLines.keys()) {
      if (!keptIds.has(lineId)) await docApi.removeItem(docId, lineId);
    }
    return docId;
  };

  const handleSubmit = async (mode: 'save' | 'validate') => {
    const problem = validateForm(mode === 'validate');
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError(null);
    setSubmitting(mode);
    let docId: string | undefined;
    try {
      docId = await persist((savedId) => {
        docId = savedId;
      });
      if (mode === 'validate') {
        await advanceToReady(kind, docId);
        await lineApi[kind].validate(docId);
        showToast('success', `${meta.label} validated`, 'Stock has been updated.');
      } else {
        showToast('success', `${meta.label} saved`, `${docRef(kind, docId)} saved.`);
      }
      navigate(`${meta.path}/${docId}`);
    } catch (err) {
      const message = errorMessage(err, `Failed to save ${meta.label.toLowerCase()}`);
      if (docId) {
        // The document exists; continue on its detail page so a retry cannot duplicate it.
        showToast('error', `${meta.label} not completed`, message);
        navigate(`${meta.path}/${docId}`);
        return;
      }
      setFormError(message);
    } finally {
      setSubmitting(null);
    }
  };

  if (loading || catalogLoading) return <LoadingState message="Loading form..." height="300px" />;
  if (loadError) return <ErrorState message={loadError} />;
  if (catalogError) return <ErrorState message={catalogError} onRetry={reload} />;
  if (isEdit && isTerminal(status)) {
    return (
      <div>
        <BackLink to={`${meta.path}/${id}`} label={`Back to ${docRef(kind, id as string)}`} />
        <ErrorState
          title="This document can no longer be edited"
          message={`It is ${status === 'DONE' ? 'already done' : 'canceled'}. Completed stock history is preserved and cannot be changed.`}
        />
      </div>
    );
  }

  const busy = submitting !== null;
  const noCatalog = !catalog.products.length || !catalog.locations.length;

  return (
    <div>
      <BackLink to={id ? `${meta.path}/${id}` : meta.path} label={id ? 'Back to details' : `Back to ${meta.plural}`} />
      <div className="page-header">
        <div>
          <h2 className="page-title">
            {isEdit ? `Edit ${meta.label}` : `Create ${meta.label}`}
          </h2>
          <p className="page-subtitle">{copy.subtitle}</p>
        </div>
        {isEdit && <OperationStatusBadge status={status} />}
      </div>

      <div className="card">
        {formError && <InlineAlert>{formError}</InlineAlert>}
        {noCatalog && (
          <InlineAlert>
            Create at least one product and one location before recording {meta.plural.toLowerCase()}.
          </InlineAlert>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
          }}
        >
          {kind === 'receipt' && (
            <div className="form-group">
              <label className="form-label" htmlFor="supplier">Supplier *</label>
              <input
                id="supplier"
                className="form-input"
                value={supplier}
                maxLength={200}
                placeholder="e.g. ABC Traders"
                onChange={(e) => setSupplier(e.target.value)}
                disabled={busy}
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Reference No</label>
            <input
              className="form-input"
              value={id ? docRef(kind, id) : 'Assigned on save'}
              readOnly
              disabled
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            margin: '8px 0 12px',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Items</h3>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
            disabled={busy}
          >
            <Plus size={14} /> Add Item
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {lines.map((line, index) => {
            const available = usesSourceStock
              ? availableAt(line.product_id, line.location_id)
              : undefined;
            const unit = catalog.unitOf(line.product_id);
            const warning = shortage(line);
            // A selected location implies its warehouse, e.g. for lines loaded for editing.
            const sourceWarehouse =
              line.source_warehouse_id ||
              catalog.locationById.get(line.location_id)?.warehouse_id ||
              '';
            const destinationWarehouse =
              line.destination_warehouse_id ||
              catalog.locationById.get(line.destination_location_id)?.warehouse_id ||
              '';
            return (
              <div
                key={line.key}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '14px',
                  backgroundColor: 'var(--surface-input)',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '12px',
                    alignItems: 'end',
                  }}
                >
                  <div>
                    <label className="form-label">#{index + 1} Product *</label>
                    <select
                      className="form-input"
                      value={line.product_id}
                      onChange={(e) => updateLine(line.key, { product_id: e.target.value })}
                      disabled={busy}
                      aria-label={`Item ${index + 1} product`}
                    >
                      <option value="">Select product</option>
                      {catalog.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  {kind === 'transfer' && (
                    <div>
                      <label className="form-label">Source Warehouse</label>
                      <WarehouseSelect
                        catalog={catalog}
                        value={sourceWarehouse}
                        onChange={(value) =>
                          updateLine(line.key, { source_warehouse_id: value, location_id: '' })
                        }
                        disabled={busy}
                        ariaLabel={`Item ${index + 1} source warehouse`}
                      />
                    </div>
                  )}
                  <div>
                    <label className="form-label">
                      {kind === 'transfer' ? 'Source Location' : copy.locationLabel} *
                    </label>
                    <LocationSelect
                      catalog={catalog}
                      value={line.location_id}
                      warehouseId={kind === 'transfer' ? sourceWarehouse : undefined}
                      onChange={(value) => updateLine(line.key, { location_id: value })}
                      disabled={busy}
                      ariaLabel={`Item ${index + 1} ${kind === 'transfer' ? 'source location' : 'location'}`}
                    />
                  </div>

                  {kind === 'transfer' && (
                    <>
                      <div>
                        <label className="form-label">Destination Warehouse</label>
                        <WarehouseSelect
                          catalog={catalog}
                          value={destinationWarehouse}
                          onChange={(value) =>
                            updateLine(line.key, {
                              destination_warehouse_id: value,
                              destination_location_id: '',
                            })
                          }
                          disabled={busy}
                          ariaLabel={`Item ${index + 1} destination warehouse`}
                        />
                      </div>
                      <div>
                        <label className="form-label">Destination Location *</label>
                        <LocationSelect
                          catalog={catalog}
                          value={line.destination_location_id}
                          warehouseId={destinationWarehouse}
                          onChange={(value) =>
                            updateLine(line.key, { destination_location_id: value })
                          }
                          disabled={busy}
                          ariaLabel={`Item ${index + 1} destination location`}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="form-label">Quantity {unit && `(${unit})`} *</label>
                    <input
                      className="form-input"
                      inputMode="decimal"
                      value={line.quantity}
                      placeholder="0"
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      disabled={busy}
                      aria-label={`Item ${index + 1} quantity`}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        setLines((prev) =>
                          prev.length > 1 ? prev.filter((l) => l.key !== line.key) : [emptyLine()]
                        )
                      }
                      disabled={busy}
                      title="Remove item"
                      aria-label={`Remove item ${index + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '16px',
                    flexWrap: 'wrap',
                    marginTop: '10px',
                    fontSize: '0.8125rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  {kind === 'transfer' && line.location_id && line.destination_location_id && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      From <strong>{catalog.locationLabel(line.location_id)}</strong>
                      <ArrowRight size={12} />
                      To <strong>{catalog.locationLabel(line.destination_location_id)}</strong>
                    </span>
                  )}
                  {available !== undefined && (
                    <span>
                      Available at source: <strong>{formatQty(available, unit)}</strong>
                    </span>
                  )}
                  {line.quantity && quantityError(line.quantity) && (
                    <span style={{ color: 'var(--color-danger)' }}>{quantityError(line.quantity)}</span>
                  )}
                  {warning && <span style={{ color: 'var(--color-warning)' }}>{warning}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="form-group" style={{ marginTop: '16px' }}>
          <label className="form-label" htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            className="form-input"
            rows={3}
            maxLength={1000}
            placeholder="Enter notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(id ? `${meta.path}/${id}` : meta.path)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleSubmit('save')}
            disabled={busy || noCatalog}
          >
            {submitting === 'save' ? 'Saving...' : isEdit ? 'Save Changes' : 'Save as Draft'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleSubmit('validate')}
            disabled={busy || noCatalog}
          >
            {submitting === 'validate' ? 'Validating...' : copy.validateLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
