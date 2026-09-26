import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDownToLine, Edit3, Eye, Plus } from '../../components/ui/icons';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ErrorState } from '../../components/ui/ErrorState';
import { FilterDropdown } from '../../components/ui/FilterDropdown';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { LowStockAlert, Product, ProductStock } from '../../types';
import { errorMessage, fetchAllPages, formatQty, useCatalog } from '../operations/operationUtils';
import {
  STOCK_STATUS_OPTIONS,
  lowStockSet,
  primaryWarehouseId,
  stockStatus,
  toCsv,
  totalsByProduct,
  type StockStatus,
} from './productUtils';

const PAGE_SIZE = 20;

interface Row {
  product: Product;
  onHand: number;
  status: StockStatus;
  warehouseName: string;
  categoryName: string;
}

export const ProductList: React.FC = () => {
  const { isManager } = useAuth();
  const navigate = useNavigate();
  const { catalog } = useCatalog();

  // The header search links here with ?search=, so search lives in the URL.
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') || '';
  const setSearch = (value: string) => setSearchParams(value ? { search: value } : {});
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [offset, setOffset] = useState(0);

  const [products, setProducts] = useState<Product[]>([]);
  const [balances, setBalances] = useState<ProductStock[]>([]);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productRows, balanceRows, alertRows] = await Promise.all([
        fetchAllPages((o, l) =>
          api.getProducts({
            search: search || undefined,
            category_id: categoryId || undefined,
            warehouse_id: warehouseId || undefined,
            offset: o,
            limit: l,
          })
        ),
        fetchAllPages((o, l) => api.getInventoryStock({ offset: o, limit: l })),
        fetchAllPages((o, l) => api.getLowStockAlerts(o, l)),
      ]);
      setProducts(productRows);
      setBalances(balanceRows);
      setAlerts(alertRows);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load the product catalog'));
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, warehouseId]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo<Row[]>(() => {
    const totals = totalsByProduct(balances, warehouseId || undefined);
    const low = lowStockSet(alerts);
    return products
      .map((product) => {
        const onHand = totals.get(product.id) ?? 0;
        const primary = primaryWarehouseId(balances, product.id);
        return {
          product,
          onHand,
          status: stockStatus(onHand, low, product.id),
          warehouseName: primary ? catalog.warehouseById.get(primary)?.name ?? '' : '',
          categoryName: catalog.categories.find((c) => c.id === product.category_id)?.name ?? '—',
        };
      })
      .filter((row) => !status || row.status === status);
  }, [products, balances, alerts, warehouseId, status, catalog]);

  const page = rows.slice(offset, offset + PAGE_SIZE);
  const filtersActive = Boolean(search || categoryId || status || warehouseId);

  const exportCsv = () => {
    const csv = toCsv([
      ['SKU', 'Product', 'Category', 'Unit', warehouseId ? 'On hand (warehouse)' : 'On hand', 'Status', 'Primary warehouse'],
      ...rows.map((r) => [r.product.sku, r.product.name, r.categoryName, r.product.unit_of_measure, r.onHand, r.status, r.warehouseName]),
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `stocksense-products-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<Row>[] = [
    {
      key: 'sku',
      header: 'Product SKU',
      render: (r) => <span className="code-chip" style={{ whiteSpace: 'nowrap' }}>{r.product.sku}</span>,
    },
    {
      key: 'name',
      header: 'Product Name',
      render: (r) => (
        <Link to={`/products/${r.product.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontWeight: 600 }}>{r.product.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.warehouseName || 'Not stocked yet'}</div>
        </Link>
      ),
    },
    { key: 'category', header: 'Category', render: (r) => r.categoryName },
    {
      key: 'unit',
      header: 'Unit',
      render: (r) => <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.product.unit_of_measure}</span>,
    },
    {
      key: 'onHand',
      header: 'On Hand',
      align: 'right',
      render: (r) => (
        <span
          style={{
            fontWeight: 700,
            whiteSpace: 'nowrap',
            color:
              r.status === 'Out of Stock'
                ? 'var(--color-danger)'
                : r.status === 'Low Stock'
                  ? 'var(--color-warning)'
                  : 'var(--text-primary)',
          }}
        >
          {formatQty(r.onHand, r.product.unit_of_measure)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <div style={{ display: 'inline-flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/products/${r.product.id}`)}>
            <Eye size={14} /> View
          </button>
          {isManager && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/products/${r.product.id}/edit`)}>
              <Edit3 size={14} /> Edit
            </button>
          )}
        </div>
      ),
    },
  ];

  const resetPage = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setOffset(0);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Products</h2>
          <p className="page-subtitle">
            Catalog of SKUs with categories, units and on-hand stock across locations
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={exportCsv} disabled={loading || rows.length === 0}>
            <ArrowDownToLine size={16} /> Export CSV
          </button>
          {isManager && (
            <button className="btn btn-primary" onClick={() => navigate('/products/new')}>
              <Plus size={16} /> New Product
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <SearchInput value={search} onChange={resetPage(setSearch)} placeholder="Search products or SKUs..." />
        <FilterDropdown
          value={categoryId}
          onChange={resetPage(setCategoryId)}
          allLabel="Category: All"
          options={catalog.categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterDropdown value={status} onChange={resetPage(setStatus)} allLabel="Status: All" options={STOCK_STATUS_OPTIONS} />
        <FilterDropdown
          value={warehouseId}
          onChange={resetPage(setWarehouseId)}
          allLabel="Warehouse: All"
          options={catalog.warehouses.map((w) => ({ value: w.id, label: `${w.short_code} — ${w.name}` }))}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {filtersActive && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearch('');
                setCategoryId('');
                setStatus('');
                setWarehouseId('');
                setOffset(0);
              }}
            >
              Clear
            </button>
          )}
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
            {rows.length} of {products.length} items
          </span>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <DataTable
          columns={columns}
          data={page}
          keyExtractor={(r) => r.product.id}
          loading={loading}
          emptyTitle="No products found"
          emptyDescription={filtersActive ? 'No products match the current filters.' : 'Create your first product to get started.'}
          emptyActionLabel={isManager && !filtersActive ? 'New Product' : undefined}
          onEmptyAction={isManager && !filtersActive ? () => navigate('/products/new') : undefined}
          pagination={{ offset, limit: PAGE_SIZE, totalCount: rows.length, onPageChange: setOffset }}
        />
      )}
    </div>
  );
};
