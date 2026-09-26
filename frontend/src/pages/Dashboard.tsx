import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ChevronDown,
  Package,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from '../components/ui/icons';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterDropdown } from '../components/ui/FilterDropdown';
import { LoadingState } from '../components/ui/LoadingState';
import { SearchInput } from '../components/ui/SearchInput';
import { DOC_KINDS, STATUS_LABELS, docRef, useCatalog, type DocKind } from './operations/operationUtils';
import { KpiCard } from './dashboard/DashboardParts';
import { relativeTime } from './dashboard/dashboardUtils';
import { LowStockPanel } from './dashboard/LowStockPanel';
import { MovementSummary } from './dashboard/MovementSummary';
import { PendingQueue } from './dashboard/PendingQueue';
import { RecentActivity } from './dashboard/RecentActivity';
import './dashboard/dashboard.css';
import { PENDING_STATUSES, useDashboardData, type Period, type QueueDoc } from './dashboard/useDashboardData';

const NEW_OPERATIONS: Array<{ kind: DocKind; Icon: typeof Package }> = [
  { kind: 'receipt', Icon: ArrowDownToLine },
  { kind: 'delivery', Icon: ArrowUpFromLine },
  { kind: 'transfer', Icon: ArrowLeftRight },
  { kind: 'adjustment', Icon: SlidersHorizontal },
];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { catalog, loading: catalogLoading, error: catalogError, reload: reloadCatalog } = useCatalog();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [period, setPeriod] = useState<Period>('24h');

  const { data, loading, error, updatedAt, reload } = useDashboardData({ warehouseId, categoryId, period });

  const balances = useMemo(() => data?.balances ?? [], [data]);

  // Products passing the category and warehouse filters.
  const productIds = useMemo(() => {
    const inWarehouse = warehouseId
      ? new Set(balances.filter((b) => b.warehouse_id === warehouseId).map((b) => b.product_id))
      : undefined;
    return new Set(
      catalog.products
        .filter((p) => !categoryId || p.category_id === categoryId)
        .filter((p) => !inWarehouse || inWarehouse.has(p.id))
        .map((p) => p.id)
    );
  }, [catalog.products, balances, categoryId, warehouseId]);

  const stockTotals = useMemo(() => {
    const totals = new Map<string, number>();
    balances
      .filter((b) => !warehouseId || b.warehouse_id === warehouseId)
      .forEach((b) => totals.set(b.product_id, (totals.get(b.product_id) ?? 0) + Number(b.quantity)));
    return totals;
  }, [balances, warehouseId]);

  const queue = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = (doc: QueueDoc) => {
      if (status && doc.status !== status) return false;
      const locationIds = doc.lines.flatMap((l) => [l.fromLocationId, l.toLocationId, l.atLocationId]);
      if (
        warehouseId &&
        !locationIds.some((id) => id && catalog.locationById.get(id)?.warehouse_id === warehouseId)
      ) {
        return false;
      }
      if (
        categoryId &&
        !doc.lines.some((l) => catalog.productById.get(l.productId)?.category_id === categoryId)
      ) {
        return false;
      }
      if (!term) return true;
      const products = doc.lines.map((l) => {
        const p = catalog.productById.get(l.productId);
        return p ? `${p.name} ${p.sku}` : '';
      });
      return [docRef(doc.kind, doc.id), doc.partner, doc.notes, ...products]
        .join(' ')
        .toLowerCase()
        .includes(term);
    };
    return (data?.queue ?? []).filter(matches);
  }, [data, search, status, warehouseId, categoryId, catalog]);

  if ((loading && !data) || catalogLoading) {
    return <LoadingState message="Loading inventory dashboard..." height="400px" />;
  }
  if (catalogError) return <ErrorState message={catalogError} onRetry={reloadCatalog} height="350px" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} height="350px" />;
  if (!data) return null;

  const productCount = productIds.size;
  const inStock = [...productIds].filter((id) => (stockTotals.get(id) ?? 0) > 0).length;
  const outOfStock = productCount - inStock;
  const lowStock = data.alerts.filter(
    (a) => productIds.has(a.product_id) && (stockTotals.get(a.product_id) ?? 0) > 0
  ).length;
  const pending = (kind: DocKind) => queue.filter((d) => d.kind === kind).length;
  const filtersActive = Boolean(search || status || warehouseId || categoryId);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Inventory Operations Dashboard</h2>
          <p className="page-subtitle">
            Stock levels, open operations, replenishment alerts and recent movements.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={reload} disabled={loading} title="Reload all dashboard data">
            <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} />
            Refresh
            {updatedAt && <span className="cell-sub mono">({relativeTime(updatedAt.toISOString())})</span>}
          </button>
          <details className="menu">
            <summary className="btn btn-primary">
              <Plus size={16} /> New Operation <ChevronDown size={14} />
            </summary>
            <div className="menu-list" role="menu">
              {NEW_OPERATIONS.map(({ kind, Icon }) => (
                <Link key={kind} role="menuitem" to={`${DOC_KINDS[kind].path}/new`}>
                  <Icon size={16} /> {DOC_KINDS[kind].label}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </div>

      {error && (
        <div className="inline-warning" role="alert">
          <AlertCircle size={16} /> Refresh failed: {error}. Showing the last loaded data.
        </div>
      )}

      <div className="dash-kpis">
        <KpiCard label="Total Products" tag="Catalog" tone="neutral" value={productCount}
          hint={`${inStock} with stock on hand`} icon={<Package size={20} />} onClick={() => navigate('/products')} />
        <KpiCard label="Low Stock" tag="Reorder" tone="warning" value={lowStock}
          hint="At or below minimum level" icon={<AlertTriangle size={20} />} onClick={() => navigate('/reordering-rules')} />
        <KpiCard label="Out of Stock" tag="Critical" tone="danger" value={outOfStock}
          hint="Zero on hand" icon={<AlertCircle size={20} />} onClick={() => navigate('/products')} />
        <KpiCard label="Pending Receipts" tag="Inbound" tone="info" value={pending('receipt')}
          hint="Awaiting validation" icon={<ArrowDownToLine size={20} />} onClick={() => navigate(DOC_KINDS.receipt.path)} />
        <KpiCard label="Pending Deliveries" tag="Outbound" tone="info" value={pending('delivery')}
          hint="Awaiting dispatch" icon={<ArrowUpFromLine size={20} />} onClick={() => navigate(DOC_KINDS.delivery.path)} />
        <KpiCard label="Scheduled Transfers" tag="Internal" tone="primary" value={pending('transfer')}
          hint="Open relocations" icon={<ArrowLeftRight size={20} />} onClick={() => navigate(DOC_KINDS.transfer.path)} />
      </div>

      <div className="card dash-filters">
        <SearchInput value={search} onChange={setSearch} placeholder="Search reference, supplier, product or SKU..." />
        <FilterDropdown
          value={status}
          onChange={setStatus}
          allLabel="Status: All open"
          options={PENDING_STATUSES.map((s) => ({ value: s, label: `Status: ${STATUS_LABELS[s]}` }))}
        />
        <FilterDropdown
          value={warehouseId}
          onChange={setWarehouseId}
          allLabel="All Warehouses"
          options={catalog.warehouses.map((w) => ({ value: w.id, label: `${w.short_code} — ${w.name}` }))}
        />
        <FilterDropdown
          value={categoryId}
          onChange={setCategoryId}
          allLabel="Category: All"
          options={catalog.categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <div className="dash-filters-meta">
          {filtersActive && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearch('');
                setStatus('');
                setWarehouseId('');
                setCategoryId('');
              }}
            >
              Clear
            </button>
          )}
          <span className="mono">{queue.length} open records</span>
        </div>
      </div>

      <PendingQueue docs={queue} catalog={catalog} balances={balances} onChanged={reload} />

      <div className="dash-two-col">
        <LowStockPanel catalog={catalog} balances={balances} alerts={data.alerts} productIds={productIds} />
        <MovementSummary
          entries={data.periodLedger}
          truncated={data.periodLedgerTruncated}
          catalog={catalog}
          warehouseId={warehouseId}
          period={period}
          onPeriodChange={setPeriod}
        />
      </div>

      <RecentActivity entries={data.recent} catalog={catalog} />
    </div>
  );
};

export default Dashboard;
