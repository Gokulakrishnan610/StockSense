import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Edit3,
  FolderTree,
  History,
  MapPin,
  Sliders,
  Warehouse as WarehouseIcon,
} from '../../components/ui/icons';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { LedgerEntry, Product, ProductStock, ReorderRule } from '../../types';
import { MOVEMENT_LABELS, toMovementRows } from '../operations/ledgerUtils';
import { MovementEndLabel, QuantityText } from '../operations/OperationComponents';
import { errorMessage, formatDateTime, formatQty, useCatalog } from '../operations/operationUtils';
import { stockStatus } from './productUtils';
import './products.css';

const MOVEMENT_LIMIT = 25;

export const ProductDetail: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isManager } = useAuth();
  const { catalog } = useCatalog();

  const [product, setProduct] = useState<Product | null>(null);
  const [stock, setStock] = useState<ProductStock[]>([]);
  const [rule, setRule] = useState<ReorderRule | null>(null);
  const [isLow, setIsLow] = useState(false);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, balances, rules, alerts, entries] = await Promise.all([
        api.getProduct(id),
        api.getProductStock(id),
        api.getReorderRules(id),
        api.getLowStockAlerts(0, 100),
        api.getLedger({ product_id: id, limit: MOVEMENT_LIMIT }),
      ]);
      setProduct(p);
      setStock(balances);
      setRule(rules[0] ?? null);
      setIsLow(alerts.some((a) => a.product_id === id));
      setLedger(entries);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load product'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const movements = useMemo(() => toMovementRows(ledger), [ledger]);

  const byWarehouse = useMemo(() => {
    const groups = new Map<string, ProductStock[]>();
    stock.forEach((row) => groups.set(row.warehouse_id, [...(groups.get(row.warehouse_id) ?? []), row]));
    return [...groups].map(([warehouseId, rows]) => ({
      warehouseId,
      rows: rows.sort((a, b) => Number(b.quantity) - Number(a.quantity)),
      total: rows.reduce((sum, r) => sum + Number(r.quantity), 0),
    }));
  }, [stock]);

  if (loading) return <LoadingState message="Loading product..." height="400px" />;
  if (error || !product) return <ErrorState message={error ?? 'Product not found'} onRetry={load} />;

  const unit = product.unit_of_measure;
  const onHand = stock.reduce((sum, r) => sum + Number(r.quantity), 0);
  const status = stockStatus(onHand, isLow ? new Set([product.id]) : new Set(), product.id);
  const category = catalog.categories.find((c) => c.id === product.category_id)?.name ?? '—';
  const primary = [...byWarehouse].sort((a, b) => b.total - a.total)[0];
  const primaryName = primary ? catalog.warehouseById.get(primary.warehouseId)?.name : undefined;
  const minimum = rule ? Number(rule.minimum_stock) : undefined;
  const reorderQty = rule ? Number(rule.reorder_quantity) : undefined;
  const deficit = minimum !== undefined ? minimum - onHand : undefined;
  const stockedLocations = stock.filter((r) => Number(r.quantity) > 0).length;

  const toggle = (warehouseId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(warehouseId)) next.delete(warehouseId);
      else next.add(warehouseId);
      return next;
    });

  return (
    <div className="product-page">
      <div className="product-header">
        <button className="icon-button" onClick={() => navigate('/products')} aria-label="Back to products">
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span className="code-chip">{product.sku}</span>
            <StatusBadge status={status} />
          </div>
          <h2 className="page-title">{product.name}</h2>
          <p className="page-subtitle">
            Category: <strong>{category}</strong>
            {primaryName && (
              <>
                {' · '}Primary warehouse: <strong>{primaryName}</strong>
              </>
            )}
            {' · '}Unit: <strong>{unit}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link
            className="btn btn-secondary"
            to={`/operations/receipts/new?product=${product.id}${reorderQty ? `&quantity=${reorderQty}` : ''}`}
          >
            <ArrowDownToLine size={16} /> Receive Stock
          </Link>
          {isManager && (
            <Link className="btn btn-primary" to={`/products/${product.id}/edit`}>
              <Edit3 size={16} /> Edit Product
            </Link>
          )}
        </div>
      </div>

      <div className="product-kpis">
        <div className="product-kpi">
          <span className="product-kpi-label">Total On-Hand Stock</span>
          <span className="product-kpi-value">{formatQty(onHand)} <small>{unit}</small></span>
          <span className="product-kpi-hint">Physical stock across all locations</span>
        </div>
        <div className="product-kpi">
          <span className="product-kpi-label">Reorder Minimum</span>
          <span className="product-kpi-value">
            {minimum !== undefined ? <>{formatQty(minimum)} <small>{unit}</small></> : '—'}
          </span>
          <span className="product-kpi-hint">{rule ? 'Low-stock threshold' : 'No reorder rule set'}</span>
        </div>
        <div className="product-kpi">
          <span className="product-kpi-label">Reorder Quantity</span>
          <span className="product-kpi-value">
            {reorderQty !== undefined ? <>+{formatQty(reorderQty)} <small>{unit}</small></> : '—'}
          </span>
          <span className="product-kpi-hint">Suggested replenishment amount</span>
        </div>
        <div className="product-kpi">
          <span className="product-kpi-label">Stocked Locations</span>
          <span className="product-kpi-value">{stockedLocations} <small>of {stock.length} with records</small></span>
          <span className="product-kpi-hint">Locations currently holding this product</span>
        </div>
      </div>

      <div className="product-grid">
        <section className="card panel">
          <div className="panel-header">
            <div className="panel-title">
              <FolderTree size={16} />
              <h3>Stock by Location</h3>
            </div>
            <span className="panel-subtitle">Live balances</span>
          </div>
          <div className="panel-body">
            {byWarehouse.length === 0 ? (
              <p className="cell-sub">
                No stock recorded yet. Validate a receipt to put this product into a location.
              </p>
            ) : (
              <div role="tree" className="stock-tree">
                {byWarehouse.map(({ warehouseId, rows, total }) => {
                  const wh = catalog.warehouseById.get(warehouseId);
                  const open = !collapsed.has(warehouseId);
                  return (
                    <div key={warehouseId}>
                      <div className="stock-tree-root">
                        <button
                          className="icon-button"
                          onClick={() => toggle(warehouseId)}
                          aria-expanded={open}
                          aria-label={open ? 'Collapse' : 'Expand'}
                        >
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <WarehouseIcon size={16} />
                        <Link to={`/warehouses/${warehouseId}`} className="stock-tree-name">
                          {wh ? `${wh.name} (${wh.short_code})` : warehouseId.slice(0, 8)}
                        </Link>
                        <span className="stock-tree-qty">{formatQty(total, unit)}</span>
                      </div>
                      {open && (
                        <div className="stock-tree-children">
                          {rows.map((row) => {
                            const loc = catalog.locationById.get(row.location_id);
                            const qty = Number(row.quantity);
                            return (
                              <Link
                                key={row.location_id}
                                to={`/operations/move-history?product=${product.id}&location=${row.location_id}`}
                                className="stock-tree-leaf"
                                title="Show movements at this location"
                              >
                                <MapPin size={14} />
                                <span>{loc?.name ?? row.location_id.slice(0, 8)}</span>
                                {loc && <span className="code-chip">{loc.short_code}</span>}
                                <span className={`stock-tree-qty ${qty <= 0 ? 'is-empty' : ''}`}>{formatQty(qty, unit)}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="card panel">
          <div className="panel-header">
            <div className="panel-title">
              <Sliders size={16} />
              <h3>Reorder Information</h3>
            </div>
            <Link to="/reordering-rules" className="panel-link">Reorder rules</Link>
          </div>
          <div className="panel-body">
            {rule ? (
              <dl className="info-list">
                <div><dt>Rule</dt><dd>Minimum stock / reorder quantity</dd></div>
                <div><dt>Minimum threshold</dt><dd className="mono">{formatQty(minimum, unit)}</dd></div>
                <div><dt>Reorder quantity</dt><dd className="mono">+{formatQty(reorderQty, unit)}</dd></div>
                <div><dt>Current on hand</dt><dd className="mono">{formatQty(onHand, unit)}</dd></div>
                <div>
                  <dt>Position</dt>
                  <dd style={{ color: deficit !== undefined && deficit >= 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    {deficit !== undefined && deficit >= 0
                      ? `${formatQty(deficit, unit)} at or below minimum — reorder`
                      : `${formatQty(-(deficit ?? 0), unit)} above minimum`}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="cell-sub" style={{ display: 'grid', gap: 12 }}>
                <p>No reorder rule is configured, so this product never raises a low-stock alert.</p>
                {isManager && (
                  <Link to={`/products/${product.id}/edit`} className="btn btn-secondary btn-sm" style={{ justifySelf: 'start' }}>
                    Set reorder rule
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="card panel">
        <div className="panel-header">
          <div className="panel-title">
            <History size={16} />
            <h3>Recent Product Movements</h3>
          </div>
          <Link to={`/operations/move-history?product=${product.id}`} className="panel-link">
            Full history <ChevronRight size={14} />
          </Link>
        </div>
        {movements.length === 0 ? (
          <p className="panel-body cell-sub">No stock movements recorded for this product yet.</p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Route</th>
                  <th className="num">Quantity</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.key}>
                    <td className="cell-sub" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(m.createdAt)}</td>
                    <td>
                      {m.referencePath ? (
                        <Link className="ref-link" to={m.referencePath}>{m.reference}</Link>
                      ) : (
                        <span className="mono">{m.reference}</span>
                      )}
                    </td>
                    <td>{MOVEMENT_LABELS[m.type]}</td>
                    <td>
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <MovementEndLabel end={m.from} catalog={catalog} />
                        <span className="cell-sub">→</span>
                        <MovementEndLabel end={m.to} catalog={catalog} />
                      </span>
                    </td>
                    <td className="num"><QuantityText value={m.quantity} unit={unit} signed={!m.paired} /></td>
                    <td>{m.userName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="panel-footer">
          <span>Ledger entries are immutable once recorded</span>
          <span className="mono">{movements.length} logged movements</span>
        </div>
      </section>
    </div>
  );
};
