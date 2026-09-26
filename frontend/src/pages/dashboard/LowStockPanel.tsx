import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from '../../components/ui/icons';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { LowStockAlert, ProductStock } from '../../types';
import { formatQty, type Catalog } from '../operations/operationUtils';
import { PanelHeader } from './DashboardParts';

interface Row {
  productId: string;
  onHand: number;
  minimum?: number;
  reorderQuantity?: number;
  status: 'Low Stock' | 'Out of Stock';
}

export const LowStockPanel: React.FC<{
  catalog: Catalog;
  balances: ProductStock[];
  alerts: LowStockAlert[];
  /** Product ids that pass the dashboard's category/warehouse filters. */
  productIds: Set<string>;
}> = ({ catalog, balances, alerts, productIds }) => {
  const totals = new Map<string, number>();
  balances.forEach((b) => totals.set(b.product_id, (totals.get(b.product_id) ?? 0) + Number(b.quantity)));

  const rows: Row[] = alerts.map((a) => {
    const onHand = Number(a.total_quantity);
    return {
      productId: a.product_id,
      onHand,
      minimum: Number(a.minimum_stock),
      reorderQuantity: Number(a.reorder_quantity),
      status: onHand <= 0 ? 'Out of Stock' : 'Low Stock',
    };
  });
  const alerted = new Set(rows.map((r) => r.productId));
  // Products without a reorder rule still count as out of stock at zero on hand.
  catalog.products.forEach((p) => {
    if (!alerted.has(p.id) && (totals.get(p.id) ?? 0) <= 0) {
      rows.push({ productId: p.id, onHand: 0, status: 'Out of Stock' });
    }
  });

  const visible = rows
    .filter((r) => productIds.has(r.productId))
    .sort((a, b) => (a.status === b.status ? a.onHand - b.onHand : a.status === 'Out of Stock' ? -1 : 1));

  const warehousesOf = (productId: string) => {
    const codes = new Set<string>();
    balances
      .filter((b) => b.product_id === productId)
      .forEach((b) => {
        const code = catalog.warehouseById.get(b.warehouse_id)?.short_code;
        if (code) codes.add(code);
      });
    return [...codes].join(', ') || 'Not stocked';
  };

  const totalDeficit = visible.reduce(
    (sum, r) => sum + (r.minimum !== undefined ? Math.max(r.minimum - r.onHand, 0) : 0),
    0
  );

  return (
    <div className="card panel">
      <PanelHeader title="Low Stock & Reorder Triggers" dot="warning" badge={`${visible.length} alerts`}>
        <Link to="/reordering-rules" className="panel-link">Reorder rules</Link>
      </PanelHeader>
      {visible.length === 0 ? (
        <div className="panel-empty">
          <CheckCircle2 size={20} />
          <span>All products are above their reorder minimums.</span>
        </div>
      ) : (
        <div className="dash-table-wrap" style={{ maxHeight: 440 }}>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Warehouses</th>
                <th className="num">On Hand</th>
                <th className="num">Min Level</th>
                <th>Status</th>
                <th className="num">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const product = catalog.productById.get(r.productId);
                const unit = product?.unit_of_measure ?? '';
                const category = product ? catalog.categories.find((c) => c.id === product.category_id)?.name : '';
                const deficit = r.minimum !== undefined ? r.minimum - r.onHand : undefined;
                const receiveQty = r.reorderQuantity ?? (deficit && deficit > 0 ? deficit : undefined);
                return (
                  <tr key={r.productId}>
                    <td className="truncate-cell">
                      <div className="mono-strong">{product?.sku ?? '—'}</div>
                      <div className="cell-main" title={product?.name}>{product?.name ?? r.productId.slice(0, 8)}</div>
                      <div className="cell-sub">{category}</div>
                    </td>
                    <td className="cell-sub">{warehousesOf(r.productId)}</td>
                    <td className="num">
                      <span style={{ fontWeight: 700, color: r.onHand <= 0 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                        {formatQty(r.onHand, unit)}
                      </span>
                    </td>
                    <td className="num">
                      {r.minimum !== undefined ? (
                        <>
                          <div className="mono">{formatQty(r.minimum, unit)}</div>
                          {deficit !== undefined && deficit > 0 && (
                            <div className="cell-sub" style={{ color: 'var(--color-danger)' }}>
                              -{formatQty(deficit)} deficit
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="cell-sub" title="No reorder rule configured">No rule</span>
                      )}
                    </td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="num">
                      <Link
                        className="btn btn-secondary btn-sm"
                        to={`/operations/receipts/new?product=${r.productId}${receiveQty ? `&quantity=${receiveQty}` : ''}`}
                        title="Create a receipt for this product"
                      >
                        Receive
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {totalDeficit > 0 && (
        <div className="panel-footer">
          <span>Deficit = minimum level minus current on-hand stock</span>
          <span className="mono">{visible.filter((r) => r.minimum !== undefined && r.onHand < r.minimum).length} below minimum</span>
        </div>
      )}
    </div>
  );
};
