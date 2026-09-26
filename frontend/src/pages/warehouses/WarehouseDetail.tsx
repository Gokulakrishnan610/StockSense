import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  History,
  MapPin,
  Package,
  PackageOpen,
  Warehouse as WarehouseIcon,
} from '../../components/ui/icons';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { api } from '../../services/api';
import type { Location, LowStockAlert, ProductStock, Warehouse } from '../../types';
import { errorMessage, formatQty, useCatalog } from '../operations/operationUtils';

async function fetchAll<T>(fetchPage: (offset: number, limit: number) => Promise<T[]>) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await fetchPage(offset, 100);
    rows.push(...page);
    if (page.length < 100) return rows;
  }
}

type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

interface StockRow extends ProductStock {
  key: string;
  quantityValue: number;
  status: StockStatus;
}

/** Sums quantities per unit of measure; different units are never added together. */
const unitTotals = (rows: StockRow[], unitOf: (productId: string) => string) => {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const unit = unitOf(row.product_id) || 'units';
    totals.set(unit, (totals.get(unit) ?? 0) + row.quantityValue);
  });
  return totals;
};

const formatTotals = (totals: Map<string, number>) =>
  totals.size ? [...totals].map(([unit, qty]) => formatQty(qty, unit)).join(' · ') : '0';

const KpiCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint: string;
  tone?: 'warning' | 'danger';
  icon: React.ReactNode;
}> = ({ label, value, hint, tone, icon }) => (
  <div className="card kpi-card">
    <div className="kpi-label">{label}</div>
    <div
      className="kpi-value"
      style={{
        color:
          tone === 'danger'
            ? 'var(--color-danger)'
            : tone === 'warning'
              ? 'var(--color-warning)'
              : 'var(--text-primary)',
      }}
    >
      {icon}
      {value}
    </div>
    <div className="kpi-hint">{hint}</div>
  </div>
);

export const WarehouseDetail: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { catalog, loading: catalogLoading, error: catalogError } = useCatalog();

  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stock, setStock] = useState<ProductStock[]>([]);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [treeOpen, setTreeOpen] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wh, locs, balances, lowStock] = await Promise.all([
        api.getWarehouse(id),
        fetchAll((offset, limit) => api.getLocations(id, offset, limit)),
        fetchAll((offset, limit) => api.getInventoryStock({ warehouse_id: id, offset, limit })),
        fetchAll((offset, limit) => api.getLowStockAlerts(offset, limit)),
      ]);
      setWarehouse(wh);
      setLocations(locs);
      setStock(balances);
      setAlerts(lowStock);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load warehouse details'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const lowStockProducts = useMemo(() => new Set(alerts.map((a) => a.product_id)), [alerts]);

  const rows = useMemo<StockRow[]>(
    () =>
      stock.map((row) => {
        const quantityValue = Number(row.quantity);
        const status: StockStatus =
          quantityValue <= 0
            ? 'Out of Stock'
            : lowStockProducts.has(row.product_id)
              ? 'Low Stock'
              : 'In Stock';
        return { ...row, key: `${row.product_id}|${row.location_id}`, quantityValue, status };
      }),
    [stock, lowStockProducts]
  );

  const byLocation = useMemo(() => {
    const map = new Map<string, StockRow[]>();
    rows.forEach((row) => map.set(row.location_id, [...(map.get(row.location_id) ?? []), row]));
    return map;
  }, [rows]);

  if (loading || catalogLoading) return <LoadingState message="Loading warehouse..." height="400px" />;
  if (error || !warehouse) return <ErrorState message={error ?? 'Warehouse not found'} onRetry={load} />;
  if (catalogError) return <ErrorState message={catalogError} />;

  // Per product across this warehouse's locations.
  const productTotals = new Map<string, number>();
  rows.forEach((r) => productTotals.set(r.product_id, (productTotals.get(r.product_id) ?? 0) + r.quantityValue));
  const stockedProducts = [...productTotals].filter(([, qty]) => qty > 0);
  const outOfStock = [...productTotals].filter(([, qty]) => qty <= 0).length;
  const lowStock = stockedProducts.filter(([productId]) => lowStockProducts.has(productId)).length;

  const term = search.trim().toLowerCase();
  const visibleRows = rows
    .filter((r) => !selectedLocation || r.location_id === selectedLocation)
    .filter((r) => {
      if (!term) return true;
      const product = catalog.productById.get(r.product_id);
      return `${product?.name ?? ''} ${product?.sku ?? ''}`.toLowerCase().includes(term);
    })
    .sort((a, b) => catalog.productLabel(a.product_id).localeCompare(catalog.productLabel(b.product_id)));

  const selectedName = locations.find((l) => l.id === selectedLocation)?.name;

  const columns: Column<StockRow>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (r) => (
        <Link to={`/products/${r.product_id}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>
          {catalog.productById.get(r.product_id)?.name ?? r.product_id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      render: (r) => <span className="code-chip" style={{ whiteSpace: 'nowrap' }}>{catalog.productById.get(r.product_id)?.sku ?? '—'}</span>,
    },
    {
      key: 'location',
      header: 'Location',
      render: (r) => {
        const loc = catalog.locationById.get(r.location_id);
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={14} />
            {loc?.name ?? r.location_id.slice(0, 8)}
          </span>
        );
      },
    },
    {
      key: 'qty',
      header: 'On Hand',
      align: 'right',
      render: (r) => (
        <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatQty(r.quantityValue, catalog.unitOf(r.product_id))}</span>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (r) => (
        <Link
          to={`/operations/move-history?product=${r.product_id}&location=${r.location_id}`}
          className="btn btn-secondary btn-sm"
          title="Show this product's movements at this location"
        >
          <History size={14} /> History
        </Link>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <button className="icon-button" onClick={() => navigate('/warehouses')} aria-label="Back to warehouses" style={{ marginTop: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="code-chip">{warehouse.short_code}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {locations.length} location{locations.length === 1 ? '' : 's'}
              </span>
            </div>
            <h2 className="page-title">{warehouse.name}</h2>
            <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} /> {warehouse.address || 'No address recorded'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/operations/move-history?warehouse=${warehouse.id}`} className="btn btn-secondary">
            <History size={16} /> Stock Ledger
          </Link>
          <Link to="/warehouses" className="btn btn-secondary">All Warehouses</Link>
        </div>
      </div>

      <div className="kpi-grid-4">
        <KpiCard
          label="On-Hand Quantity"
          icon={<Package size={20} />}
          value={<span style={{ fontSize: '1.125rem' }}>{formatTotals(unitTotals(rows, catalog.unitOf))}</span>}
          hint={`Across ${locations.length} storage location${locations.length === 1 ? '' : 's'}`}
        />
        <KpiCard
          label="Products Stocked"
          icon={<PackageOpen size={20} />}
          value={stockedProducts.length}
          hint="Distinct products with stock here"
        />
        <KpiCard
          label="Low Stock"
          icon={<AlertTriangle size={20} />}
          value={lowStock}
          tone={lowStock ? 'warning' : undefined}
          hint="Stocked here, below the reorder minimum"
        />
        <KpiCard
          label="Out of Stock Here"
          icon={<AlertTriangle size={20} />}
          value={outOfStock}
          tone={outOfStock ? 'danger' : undefined}
          hint="Products with a zero balance in this warehouse"
        />
      </div>

      <div className="warehouse-layout">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Location Hierarchy
            </h3>
            {selectedLocation && (
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLocation('')}>
                Show all
              </button>
            )}
          </div>

          <div role="tree" aria-label={`${warehouse.name} locations`}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                className="icon-button"
                onClick={() => setTreeOpen((open) => !open)}
                aria-label={treeOpen ? 'Collapse locations' : 'Expand locations'}
                aria-expanded={treeOpen}
              >
                {treeOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <button
                role="treeitem"
                aria-selected={!selectedLocation}
                className={`tree-node ${!selectedLocation ? 'selected' : ''}`}
                onClick={() => setSelectedLocation('')}
              >
                <WarehouseIcon size={16} />
                <span>
                  {warehouse.name} ({warehouse.short_code})
                </span>
                <span className="tree-meta">{stockedProducts.length} products</span>
              </button>
            </div>

            {treeOpen && (
              <div className="tree-children" role="group" style={{ marginLeft: 30 }}>
                {locations.length === 0 && (
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '8px 10px' }}>
                    No locations yet. <Link to="/locations" style={{ color: 'var(--color-primary)' }}>Add a location</Link>
                  </p>
                )}
                {locations.map((loc) => {
                  const locRows = byLocation.get(loc.id) ?? [];
                  const stocked = locRows.filter((r) => r.quantityValue > 0);
                  return (
                    <button
                      key={loc.id}
                      role="treeitem"
                      aria-selected={selectedLocation === loc.id}
                      className={`tree-node ${selectedLocation === loc.id ? 'selected' : ''}`}
                      onClick={() => setSelectedLocation(loc.id)}
                      title={formatTotals(unitTotals(stocked, catalog.unitOf))}
                    >
                      <MapPin size={14} />
                      <span>{loc.name}</span>
                      <span className="code-chip">{loc.short_code}</span>
                      <span className="tree-meta">
                        {stocked.length ? `${stocked.length} product${stocked.length === 1 ? '' : 's'}` : 'empty'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
            Select a location to filter the inventory list.
          </p>
        </div>

        <div>
          <div
            className="card"
            style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 16px' }}
          >
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>
                {selectedName ? `Inventory: ${selectedName}` : `All inventory: ${warehouse.short_code}`}
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {visibleRows.length} product line{visibleRows.length === 1 ? '' : 's'}
              </span>
            </div>
            <SearchInput value={search} onChange={setSearch} placeholder="Search product or SKU..." />
          </div>
          <DataTable
            columns={columns}
            data={visibleRows}
            keyExtractor={(r) => r.key}
            emptyTitle={rows.length ? 'No matching stock' : 'No stock in this warehouse yet'}
            emptyDescription={
              rows.length
                ? 'Try another location or search term.'
                : 'Validate a receipt or transfer into one of its locations to add stock.'
            }
            emptyActionLabel={rows.length ? undefined : 'New Receipt'}
            onEmptyAction={rows.length ? undefined : () => navigate('/operations/receipts/new')}
          />
        </div>
      </div>
    </div>
  );
};
