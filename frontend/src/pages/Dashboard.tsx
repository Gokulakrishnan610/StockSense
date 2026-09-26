import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  SlidersHorizontal,
  Layers,
} from '../components/ui/icons';
import { api } from '../services/api';
import type {
  Category,
  Warehouse,
  Location,
  Product,
  ReorderRule,
  DocumentType,
  OperationStatus,
  OperationStatusCode,
} from '../types';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterDropdown } from '../components/ui/FilterDropdown';
import { StatusBadge } from '../components/ui/StatusBadge';

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('All');
  const [selectedStatus, setSelectedStatus] = useState<OperationStatus>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  // Loaded metadata
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reorderRules, setReorderRules] = useState<ReorderRule[]>([]);

  // Calculated stock map
  const [productStocksMap, setProductStocksMap] = useState<Record<string, number>>({});

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catsRes, whRes, locsRes, prodsRes, rulesRes] = await Promise.all([
        api.getCategories(),
        api.getWarehouses(),
        api.getLocations(selectedWarehouse || undefined),
        api.getProducts({
          category_id: selectedCategory || undefined,
          warehouse_id: selectedWarehouse || undefined,
          location_id: selectedLocation || undefined,
        }),
        api.getReorderRules(),
      ]);

      setCategories(catsRes);
      setWarehouses(whRes);
      setLocations(locsRes);
      setProducts(prodsRes);
      setReorderRules(rulesRes);

      // Fetch per-product stock balances dynamically
      const stockMap: Record<string, number> = {};
      await Promise.all(
        prodsRes.slice(0, 30).map(async (p) => {
          try {
            const stockRows = await api.getProductStock(
              p.id,
              selectedWarehouse || undefined,
              selectedLocation || undefined
            );
            const totalQty = stockRows.reduce((acc, row) => acc + parseFloat(row.quantity || '0'), 0);
            stockMap[p.id] = totalQty;
          } catch {
            stockMap[p.id] = 0;
          }
        })
      );
      setProductStocksMap(stockMap);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load inventory dashboard data');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedWarehouse, selectedLocation]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle location update when warehouse changes
  useEffect(() => {
    if (selectedWarehouse) {
      api.getLocations(selectedWarehouse).then(setLocations).catch(() => {});
    }
  }, [selectedWarehouse]);

  // Derived KPI calculations from real backend datasets
  const totalProductsInStockCount = Object.values(productStocksMap).filter((q) => q > 0).length;

  const lowStockCount = products.filter((p) => {
    const currentStock = productStocksMap[p.id] ?? 0;
    const rule = reorderRules.find((r) => r.product_id === p.id);
    const minStock = rule ? parseFloat(rule.minimum_stock) : 0;
    return currentStock <= minStock || currentStock === 0;
  }).length;

  // Operation KPIs come from the operations API. "Pending" means not yet Done or
  // Canceled, unless a specific status is selected in the filter.
  const [operationCounts, setOperationCounts] = useState({ receipts: 0, deliveries: 0, transfers: 0 });
  useEffect(() => {
    const statuses: OperationStatusCode[] =
      selectedStatus === 'All'
        ? ['DRAFT', 'WAITING', 'READY']
        : [selectedStatus.toUpperCase() as OperationStatusCode];
    const count = (byStatus: Record<OperationStatusCode, number>) =>
      statuses.reduce((sum, status) => sum + byStatus[status], 0);
    let active = true;
    api
      .getOperationSummary()
      .then((summary) => {
        if (!active) return;
        setOperationCounts({
          receipts: count(summary.receipts),
          deliveries: count(summary.deliveries),
          transfers: count(summary.transfers),
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [selectedStatus]);

  const pendingReceiptsCount =
    selectedDocType === 'Receipts' || selectedDocType === 'All' ? operationCounts.receipts : 0;
  const pendingDeliveriesCount =
    selectedDocType === 'Delivery' || selectedDocType === 'All' ? operationCounts.deliveries : 0;
  const internalTransfersScheduled =
    selectedDocType === 'Internal' || selectedDocType === 'All' ? operationCounts.transfers : 0;

  if (loading) {
    return <LoadingState message="Fetching real-time inventory metrics..." height="400px" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadDashboardData} height="350px" />;
  }

  return (
    <div>
      {/* Top Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Inventory Dashboard</h2>
          <p className="page-subtitle">Real-time inventory overview & warehouse control center</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid-kpi">
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--color-primary)',
            }}
          >
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Total Products Active
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {products.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600 }}>
              {totalProductsInStockCount} in stock
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: 'var(--color-danger)',
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Low Stock / Reorder Alert
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {lowStockCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>
              Requires attention
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--color-success)',
            }}
          >
            <ArrowDownLeft size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Pending Receipts
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {pendingReceiptsCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Incoming shipments</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--color-warning)',
            }}
          >
            <ArrowUpRight size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Pending Deliveries
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {pendingDeliveriesCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Outgoing dispatches</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(6, 182, 212, 0.15)',
              color: 'var(--color-info)',
            }}
          >
            <RefreshCw size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Internal Transfers
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {internalTransfersScheduled}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Scheduled relocations</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="card"
        style={{
          marginBottom: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '16px',
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.875rem' }}>
          <SlidersHorizontal size={16} />
          <span>Filters:</span>
        </div>

        <FilterDropdown
          label="Document Type"
          value={selectedDocType}
          onChange={(val) => setSelectedDocType(val as DocumentType)}
          allLabel="All Types"
          options={[
            { value: 'Receipts', label: 'Receipts' },
            { value: 'Delivery', label: 'Delivery Orders' },
            { value: 'Internal', label: 'Internal Transfers' },
            { value: 'Adjustments', label: 'Adjustments' },
          ]}
        />

        <FilterDropdown
          label="Operation Status"
          value={selectedStatus}
          onChange={(val) => setSelectedStatus(val as OperationStatus)}
          allLabel="All Statuses"
          options={[
            { value: 'Draft', label: 'Draft' },
            { value: 'Waiting', label: 'Waiting' },
            { value: 'Ready', label: 'Ready' },
            { value: 'Done', label: 'Done' },
            { value: 'Canceled', label: 'Canceled' },
          ]}
        />

        <FilterDropdown
          label="Product Category"
          value={selectedCategory}
          onChange={setSelectedCategory}
          allLabel="All Categories"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />

        <FilterDropdown
          label="Warehouse"
          value={selectedWarehouse}
          onChange={(val) => {
            setSelectedWarehouse(val);
            setSelectedLocation('');
          }}
          allLabel="All Warehouses"
          options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.short_code})` }))}
        />

        <FilterDropdown
          label="Location"
          value={selectedLocation}
          onChange={setSelectedLocation}
          allLabel="All Locations"
          options={locations.map((l) => ({ value: l.id, label: `${l.name} (${l.short_code})` }))}
          disabled={!selectedWarehouse && locations.length === 0}
        />
      </div>

      {/* Inventory Stock Overview Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Stock Availability & Reorder Status
            </h3>
          </div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Showing {products.length} products
          </span>
        </div>

        {products.length === 0 ? (
          <div style={{ padding: '32px' }}>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              No products match the selected category or warehouse filter criteria.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-table-header)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    SKU / Code
                  </th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Product Name
                  </th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Category
                  </th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Unit
                  </th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>
                    Current Stock
                  </th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>
                    Min Stock
                  </th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center' }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((prod) => {
                  const cat = categories.find((c) => c.id === prod.category_id);
                  const rule = reorderRules.find((r) => r.product_id === prod.id);
                  const currentStock = productStocksMap[prod.id] ?? 0;
                  const minStock = rule ? parseFloat(rule.minimum_stock) : 0;

                  let stockStatus = 'In Stock';
                  if (currentStock === 0) {
                    stockStatus = 'Out of Stock';
                  } else if (currentStock <= minStock) {
                    stockStatus = 'Low Stock';
                  }

                  return (
                    <tr
                      key={prod.id}
                      className="table-row-hover"
                      style={{ borderBottom: '1px solid var(--border-color-subtle)' }}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {prod.sku}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {prod.name}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                        {cat?.name || 'Uncategorized'}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                        {prod.unit_of_measure}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)' }}>
                        {currentStock.toFixed(2)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>
                        {rule ? minStock.toFixed(2) : '-'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <StatusBadge status={stockStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
