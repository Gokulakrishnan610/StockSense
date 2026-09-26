import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ErrorState } from '../../components/ui/ErrorState';
import { FilterDropdown } from '../../components/ui/FilterDropdown';
import { api } from '../../services/api';
import type { LedgerEntry, LedgerFilter, MovementType, OperationStatusCode } from '../../types';
import { MOVEMENT_LABELS, MOVEMENT_OPTIONS, toMovementRows, type MovementRow } from './ledgerUtils';
import { MovementEndLabel, OperationStatusBadge, QuantityText } from './OperationComponents';
import {
  DOC_KINDS,
  STATUS_OPTIONS,
  docRef,
  errorMessage,
  formatDateTime,
  useCatalog,
  type Catalog,
  type DocKind,
} from './operationUtils';

const LEDGER_PAGE = 50;
const DOCUMENTS_PAGE = 20;

const dateInputStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: '0.875rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--surface-input)',
  color: 'var(--text-primary)',
  colorScheme: 'dark',
};

const DateFilter: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px' }}>
    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</label>
    <input type="date" value={value} onChange={(e) => onChange(e.target.value)} style={dateInputStyle} />
  </div>
);

const ReferenceLink: React.FC<{ text: string; to?: string }> = ({ text, to }) =>
  to ? (
    <Link
      to={to}
      style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary)', textDecoration: 'none' }}
    >
      {text}
    </Link>
  ) : (
    <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{text}</span>
  );

/** Local calendar day boundaries sent to the backend as UTC instants. */
const dayStart = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : undefined);
const dayEnd = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : undefined);

const StockLedgerTab: React.FC<{ catalog: Catalog }> = ({ catalog }) => {
  const [type, setType] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [productId, setProductId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filter = useMemo<LedgerFilter>(
    () => ({
      transaction_type: (type || undefined) as MovementType | undefined,
      warehouse_id: warehouseId || undefined,
      location_id: locationId || undefined,
      category_id: categoryId || undefined,
      product_id: productId || undefined,
      date_from: dayStart(dateFrom),
      date_to: dayEnd(dateTo),
    }),
    [type, warehouseId, locationId, categoryId, productId, dateFrom, dateTo]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await api.getLedger({ ...filter, offset, limit: LEDGER_PAGE + 1 }));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load the stock ledger'));
    } finally {
      setLoading(false);
    }
  }, [filter, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const change = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setOffset(0);
  };

  const hasFilters = Boolean(type || warehouseId || locationId || categoryId || productId || dateFrom || dateTo);
  const resetFilters = () => {
    [setType, setWarehouseId, setLocationId, setCategoryId, setProductId, setDateFrom, setDateTo].forEach(
      (setter) => setter('')
    );
    setOffset(0);
  };

  const rows = useMemo(() => toMovementRows(entries.slice(0, LEDGER_PAGE)), [entries]);
  const products = categoryId
    ? catalog.products.filter((p) => p.category_id === categoryId)
    : catalog.products;
  const locations = warehouseId
    ? catalog.locations.filter((l) => l.warehouse_id === warehouseId)
    : catalog.locations;

  const columns: Column<MovementRow>[] = [
    { key: 'date', header: 'Date', render: (r) => formatDateTime(r.createdAt) },
    { key: 'product', header: 'Product', render: (r) => <strong>{catalog.productLabel(r.productId)}</strong> },
    { key: 'type', header: 'Transaction Type', render: (r) => MOVEMENT_LABELS[r.type] },
    { key: 'reference', header: 'Reference', render: (r) => <ReferenceLink text={r.reference} to={r.referencePath} /> },
    { key: 'from', header: 'From', render: (r) => <MovementEndLabel end={r.from} catalog={catalog} /> },
    { key: 'to', header: 'To', render: (r) => <MovementEndLabel end={r.to} catalog={catalog} /> },
    {
      key: 'quantity',
      header: 'Quantity',
      align: 'right',
      render: (r) => (
        <QuantityText value={r.quantity} unit={catalog.unitOf(r.productId)} signed={!r.paired} />
      ),
    },
    { key: 'user', header: 'User', render: (r) => r.userName },
  ];

  return (
    <>
      <div
        className="card"
        style={{ marginBottom: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}
      >
        <FilterDropdown label="Document Type" value={type} onChange={change(setType)} allLabel="All Types" options={MOVEMENT_OPTIONS} />
        <FilterDropdown
          label="Warehouse"
          value={warehouseId}
          onChange={(v) => {
            change(setWarehouseId)(v);
            setLocationId('');
          }}
          allLabel="All Warehouses"
          options={catalog.warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.short_code})` }))}
        />
        <FilterDropdown
          label="Location"
          value={locationId}
          onChange={change(setLocationId)}
          allLabel="All Locations"
          options={locations.map((l) => ({ value: l.id, label: catalog.locationLabel(l.id) }))}
        />
        <FilterDropdown
          label="Product Category"
          value={categoryId}
          onChange={(v) => {
            change(setCategoryId)(v);
            setProductId('');
          }}
          allLabel="All Categories"
          options={catalog.categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterDropdown
          label="Product"
          value={productId}
          onChange={change(setProductId)}
          allLabel="All Products"
          options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
        />
        <DateFilter label="From Date" value={dateFrom} onChange={change(setDateFrom)} />
        <DateFilter label="To Date" value={dateTo} onChange={change(setDateTo)} />
        {hasFilters && (
          <button className="btn btn-secondary btn-sm" onClick={resetFilters} style={{ marginBottom: '2px' }}>
            <RotateCcw size={14} /> Reset
          </button>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={(r) => r.key}
          loading={loading}
          emptyTitle="No stock movements found"
          emptyDescription={
            hasFilters
              ? 'No ledger entries match the selected filters.'
              : 'Validated receipts, deliveries, transfers and adjustments appear here.'
          }
          pagination={{
            offset,
            limit: LEDGER_PAGE,
            hasMore: entries.length > LEDGER_PAGE,
            onPageChange: setOffset,
          }}
        />
      )}
    </>
  );
};

interface DocumentRow {
  key: string;
  kind: DocKind;
  id: string;
  status: OperationStatusCode;
  createdAt: string;
  details: string;
}

const DOCUMENT_TYPES: Array<{ value: DocKind; label: string }> = [
  { value: 'receipt', label: 'Receipts' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'transfer', label: 'Internal' },
  { value: 'adjustment', label: 'Adjustments' },
];

const OperationsTab: React.FC<{ catalog: Catalog }> = ({ catalog }) => {
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const s = (status || undefined) as OperationStatusCode | undefined;
    const wanted = (k: DocKind) => !kind || kind === k;
    try {
      const [receipts, deliveries, transfers, adjustments] = await Promise.all([
        wanted('receipt') ? api.getReceipts(s) : Promise.resolve([]),
        wanted('delivery') ? api.getDeliveries(s) : Promise.resolve([]),
        wanted('transfer') ? api.getTransfers(s) : Promise.resolve([]),
        wanted('adjustment') ? api.getAdjustments(s) : Promise.resolve([]),
      ]);
      setTruncated([receipts, deliveries, transfers, adjustments].some((list) => list.length === 100));
      const merged: DocumentRow[] = [
        ...receipts.map((r) => ({ kind: 'receipt' as const, doc: r, details: r.supplier || r.notes })),
        ...deliveries.map((d) => ({ kind: 'delivery' as const, doc: d, details: d.notes })),
        ...transfers.map((t) => ({ kind: 'transfer' as const, doc: t, details: t.notes })),
        ...adjustments.map((a) => ({
          kind: 'adjustment' as const,
          doc: a,
          details: `${catalog.productLabel(a.product_id)} @ ${catalog.locationLabel(a.location_id)}: ${a.reason}`,
        })),
      ].map(({ kind: k, doc, details }) => ({
        key: `${k}-${doc.id}`,
        kind: k,
        id: doc.id,
        status: doc.status,
        createdAt: doc.created_at,
        details,
      }));
      merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRows(merged);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load operations'));
    } finally {
      setLoading(false);
    }
  }, [kind, status, catalog]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<DocumentRow>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (r) => <ReferenceLink text={docRef(r.kind, r.id)} to={`${DOC_KINDS[r.kind].path}/${r.id}`} />,
    },
    { key: 'type', header: 'Document Type', render: (r) => DOC_KINDS[r.kind].label },
    {
      key: 'details',
      header: 'Details',
      render: (r) => <span style={{ color: 'var(--text-secondary)' }}>{r.details || '—'}</span>,
    },
    { key: 'date', header: 'Created', render: (r) => formatDateTime(r.createdAt) },
    { key: 'status', header: 'Status', render: (r) => <OperationStatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div className="card" style={{ marginBottom: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <FilterDropdown
          label="Document Type"
          value={kind}
          onChange={(v) => {
            setKind(v);
            setOffset(0);
          }}
          allLabel="All Documents"
          options={DOCUMENT_TYPES}
        />
        <FilterDropdown
          label="Status"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setOffset(0);
          }}
          allLabel="All Statuses"
          options={STATUS_OPTIONS}
        />
        {truncated && (
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Showing the latest 100 documents of each type.
          </span>
        )}
      </div>
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <DataTable
          columns={columns}
          data={rows.slice(offset, offset + DOCUMENTS_PAGE)}
          keyExtractor={(r) => r.key}
          loading={loading}
          emptyTitle="No operations found"
          emptyDescription="No documents match the selected filters."
          pagination={{
            offset,
            limit: DOCUMENTS_PAGE,
            totalCount: rows.length,
            onPageChange: setOffset,
          }}
        />
      )}
    </>
  );
};

export const MoveHistory: React.FC = () => {
  const { catalog, loading, error, reload } = useCatalog();
  const [tab, setTab] = useState<'ledger' | 'operations'>('ledger');

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    border: 'none',
    borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
    background: 'none',
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    fontSize: '0.9375rem',
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Move History / Stock Ledger</h2>
          <p className="page-subtitle">
            Immutable record of every stock movement, and the status of every stock operation
          </p>
        </div>
      </div>

      <div role="tablist" style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
        <button role="tab" aria-selected={tab === 'ledger'} style={tabStyle(tab === 'ledger')} onClick={() => setTab('ledger')}>
          Stock Ledger
        </button>
        <button role="tab" aria-selected={tab === 'operations'} style={tabStyle(tab === 'operations')} onClick={() => setTab('operations')}>
          Operations
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? null : tab === 'ledger' ? (
        <StockLedgerTab catalog={catalog} />
      ) : (
        <OperationsTab catalog={catalog} />
      )}
    </div>
  );
};
