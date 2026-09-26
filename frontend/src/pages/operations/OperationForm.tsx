import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Plus, Trash2 } from '../../components/ui/icons';
import { Select, type SelectItem } from '../../components/ui/Select';
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
import './operations.css';

interface Line {
  key: string;
  /** Backend line id for lines that already exist. */
  id?: string;
  product_id: string;
  location_id: string;
  destination_location_id: string;
  quantity: string;
}

type LineSnapshot = Pick<Line, 'product_id' | 'location_id' | 'destination_location_id' | 'quantity'>;

const newKey = () => Math.random().toString(36).slice(2, 10);

const emptyLine = (defaults: Partial<Line> = {}): Line => ({
  key: newKey(),
  product_id: '',
  location_id: '',
  destination_location_id: '',
  quantity: '',
  ...defaults,
});

const sameLine = (a: LineSnapshot, b: LineSnapshot) =>
  a.product_id === b.product_id &&
  a.location_id === b.location_id &&
  a.destination_location_id === b.destination_location_id &&
  Number(a.quantity) === Number(b.quantity);

const COPY: Record<
  LineDocKind,
  { title: string; subtitle: string; section1: string; validateLabel: string; footerHint: string }
> = {
  receipt: {
    title: 'Receipt',
    subtitle: 'Record goods arriving from a supplier into a stock location.',
    section1: 'Supplier & destination',
    validateLabel: 'Validate & Receive',
    footerHint: 'Validating adds the quantities to stock and records them in the ledger.',
  },
  delivery: {
    title: 'Delivery Order',
    subtitle: 'Ship goods out of a stock location: Pick → Pack → Validate.',
    section1: 'Source & dispatch details',
    validateLabel: 'Validate & Ship',
    footerHint: 'Validating removes the quantities from stock; it fails if stock is insufficient.',
  },
  transfer: {
    title: 'Internal Transfer',
    subtitle: 'Move stock between warehouses or locations. Global stock stays the same.',
    section1: 'Route',
    validateLabel: 'Validate & Move',
    footerHint: 'Validating decreases each source and increases each destination by the same amount.',
  },
};

const locationItems = (catalog: Catalog): SelectItem[] =>
  catalog.warehouses.map((w) => ({
    label: `${w.name} (${w.short_code})`,
    options: catalog.locations
      .filter((l) => l.warehouse_id === w.id)
      .map((l) => ({ value: l.id, label: `${w.short_code} / ${l.name}` })),
  }));

export const OperationForm: React.FC<{ kind: LineDocKind }> = ({ kind }) => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const meta = DOC_KINDS[kind];
  const copy = COPY[kind];
  const isEdit = Boolean(id);
  const { catalog, loading: catalogLoading, error: catalogError, reload } = useCatalog();
  const { ensure: ensureStock, available: availableAt } = useStockLookup();

  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  // Header-level defaults applied to lines that have no location yet.
  const [defaultFrom, setDefaultFrom] = useState('');
  const [defaultTo, setDefaultTo] = useState('');
  // New documents can be pre-filled from links, e.g. ?product=<id>&quantity=50.
  const [lines, setLines] = useState<Line[]>(() => [
    emptyLine({
      product_id: id ? '' : searchParams.get('product') ?? '',
      quantity: id ? '' : searchParams.get('quantity') ?? '',
    }),
  ]);
  const [originalLines, setOriginalLines] = useState<Map<string, LineSnapshot>>(new Map());
  const [status, setStatus] = useState<OperationStatusCode>('DRAFT');
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'save' | 'validate' | null>(null);

  const usesSourceStock = kind !== 'receipt';
  // Receipts only have a destination; deliveries only a source; transfers both.
  const hasFrom = kind !== 'receipt';
  const hasTo = kind !== 'delivery';

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
          key: newKey(),
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

  /**
   * Receipt lines store their destination in `location_id`; delivery and
   * transfer lines store their source there (transfers add a destination).
   */
  const fromOf = (line: Line) => (hasFrom ? line.location_id : '');
  const toOf = (line: Line) => (kind === 'receipt' ? line.location_id : line.destination_location_id);
  const setFrom = (line: Line, value: string) => updateLine(line.key, { location_id: value });
  const setTo = (line: Line, value: string) =>
    updateLine(line.key, kind === 'receipt' ? { location_id: value } : { destination_location_id: value });

  const applyDefault = (which: 'from' | 'to', value: string) => {
    if (which === 'from') setDefaultFrom(value);
    else setDefaultTo(value);
    setLines((prev) =>
      prev.map((line) => {
        if (which === 'from' && !line.location_id) return { ...line, location_id: value };
        if (which === 'to') {
          if (kind === 'receipt' && !line.location_id) return { ...line, location_id: value };
          if (kind === 'transfer' && !line.destination_location_id) return { ...line, destination_location_id: value };
        }
        return line;
      })
    );
  };

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      emptyLine(
        kind === 'receipt'
          ? { location_id: defaultTo }
          : { location_id: defaultFrom, destination_location_id: kind === 'transfer' ? defaultTo : '' }
      ),
    ]);

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
    return `Only ${formatQty(available, catalog.unitOf(line.product_id))} available at the source`;
  };

  const validateForm = (forValidation: boolean): string | null => {
    if (kind === 'receipt' && !supplier.trim()) return 'Supplier is required.';
    const filled = lines.filter((l) => l.product_id || l.quantity);
    if (!filled.length) return 'Add at least one product line.';
    for (const [index, line] of filled.entries()) {
      const n = `Line ${index + 1}`;
      if (!line.product_id) return `${n}: select a product.`;
      if (hasFrom && !line.location_id) return `${n}: select a source location.`;
      if (kind === 'receipt' && !line.location_id) return `${n}: select a destination location.`;
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
  const backTo = id ? `${meta.path}/${id}` : meta.path;
  const locations = locationItems(catalog);
  const productItems = catalog.products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }));

  const filledLines = lines.filter((l) => l.product_id && !quantityError(l.quantity));
  const units = new Set(filledLines.map((l) => catalog.unitOf(l.product_id)));
  const totalQty = filledLines.reduce((sum, l) => sum + Number(l.quantity), 0);
  const gridClass = `line-grid ${hasFrom && hasTo ? 'has-both' : ''}`;

  return (
    <div className="op-form-page">
      <div className="op-page-header">
        <button className="icon-button" onClick={() => navigate(backTo)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {isEdit ? `Edit ${copy.title}` : `Create ${copy.title}`}
            {isEdit && <span className="code-chip">{docRef(kind, id as string)}</span>}
            {isEdit && <OperationStatusBadge status={status} />}
          </h2>
          <p className="page-subtitle">{copy.subtitle}</p>
        </div>
        <Link to={backTo} className="panel-link">Cancel</Link>
      </div>

      <div className="card op-form">
        {formError && <InlineAlert>{formError}</InlineAlert>}
        {noCatalog && (
          <InlineAlert>
            Create at least one product and one location before recording {meta.plural.toLowerCase()}.
          </InlineAlert>
        )}

        <h3 className="form-section-title">1. {copy.section1}</h3>
        <div className="form-row">
          {kind === 'receipt' && (
            <div className="form-group">
              <label className="form-label" htmlFor="supplier">Supplier / Vendor *</label>
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
          {hasFrom && (
            <div className="form-group">
              <label className="form-label">{kind === 'transfer' ? 'Default From' : 'Default Source Location'}</label>
              <Select value={defaultFrom} onChange={(v) => applyDefault('from', v)} options={locations}
                placeholder="Select location" disabled={busy} aria-label="Default source location" />
              <span className="form-hint">Applied to lines without a source</span>
            </div>
          )}
          {hasTo && (
            <div className="form-group">
              <label className="form-label">{kind === 'transfer' ? 'Default To' : 'Default Destination Location'}</label>
              <Select value={defaultTo} onChange={(v) => applyDefault('to', v)} options={locations}
                placeholder="Select location" disabled={busy} aria-label="Default destination location" />
              <span className="form-hint">Applied to lines without a destination</span>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Reference</label>
            <input className="form-input mono-input" value={id ? docRef(kind, id) : 'Assigned on save'} readOnly disabled />
          </div>
        </div>

        <div className="form-section-head">
          <h3 className="form-section-title" style={{ margin: 0, border: 0, padding: 0 }}>
            2. Product lines & quantities ({lines.length})
          </h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addLine} disabled={busy}>
            <Plus size={14} /> Add Product Line
          </button>
        </div>

        <div className="line-table">
          <div className={`${gridClass} line-head`} aria-hidden="true">
            <span>Product</span>
            {hasFrom && <span>From</span>}
            {hasTo && <span>To</span>}
            <span className="num">Quantity</span>
            <span />
          </div>
          {lines.map((line, index) => {
            const unit = catalog.unitOf(line.product_id);
            const available = usesSourceStock ? availableAt(line.product_id, line.location_id) : undefined;
            const warning = shortage(line);
            const qtyProblem = line.quantity ? quantityError(line.quantity) : null;
            const showRoute = kind === 'transfer' && line.location_id && line.destination_location_id;
            return (
              <div key={line.key} className="line-row">
                <div className={gridClass}>
                  <Select value={line.product_id} onChange={(v) => updateLine(line.key, { product_id: v })}
                    options={productItems} placeholder="Select product" disabled={busy}
                    aria-label={`Line ${index + 1} product`} />
                  {hasFrom && (
                    <Select value={fromOf(line)} onChange={(v) => setFrom(line, v)} options={locations}
                      placeholder="From location" disabled={busy} aria-label={`Line ${index + 1} source location`} />
                  )}
                  {hasTo && (
                    <Select value={toOf(line)} onChange={(v) => setTo(line, v)} options={locations}
                      placeholder="To location" disabled={busy} aria-label={`Line ${index + 1} destination location`} />
                  )}
                  <div className="qty-cell">
                    <input
                      className={`form-input qty-input ${qtyProblem ? 'has-error' : ''}`}
                      inputMode="decimal"
                      value={line.quantity}
                      placeholder="0"
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      disabled={busy}
                      aria-label={`Line ${index + 1} quantity`}
                    />
                    <span className="qty-unit">{unit || '—'}</span>
                  </div>
                  <button
                    type="button"
                    className="icon-button line-remove"
                    onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== line.key) : [emptyLine()]))}
                    disabled={busy}
                    aria-label={`Remove line ${index + 1}`}
                    title="Remove line"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {(available !== undefined || warning || qtyProblem || showRoute) && (
                  <div className="line-notes">
                    {showRoute && (
                      <span className="route">
                        {catalog.locationLabel(line.location_id)} <ArrowRight size={12} />{' '}
                        {catalog.locationLabel(line.destination_location_id)}
                      </span>
                    )}
                    {available !== undefined && (
                      <span>Available at source: <strong>{formatQty(available, unit)}</strong></span>
                    )}
                    {qtyProblem && <span className="text-danger">{qtyProblem}</span>}
                    {warning && <span className="text-warning">{warning}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="line-totals">
          <span className="mono">{filledLines.length} line{filledLines.length === 1 ? '' : 's'} total</span>
          <span className="mono">
            Total: <strong>{units.size > 1 ? 'mixed units' : formatQty(totalQty, [...units][0])}</strong>
          </span>
        </div>

        <h3 className="form-section-title">3. Notes</h3>
        <div className="form-group">
          <label className="form-label" htmlFor="notes">
            {kind === 'receipt' ? 'Receiving notes & instructions' : kind === 'delivery' ? 'Customer / dispatch notes' : 'Transfer notes'}
          </label>
          <textarea
            id="notes"
            className="form-input"
            rows={3}
            maxLength={1000}
            placeholder={kind === 'delivery' ? 'Customer name, order number, carrier…' : 'Inspection checklist, dock number, carrier…'}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="op-form-footer">
          <span className="form-hint">{copy.footerHint}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={() => handleSubmit('save')} disabled={busy || noCatalog}>
              {submitting === 'save' ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Draft'}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => handleSubmit('validate')} disabled={busy || noCatalog}>
              <CheckCircle2 size={16} /> {submitting === 'validate' ? 'Validating...' : copy.validateLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
