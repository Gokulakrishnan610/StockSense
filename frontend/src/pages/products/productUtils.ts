import type { LowStockAlert, ProductStock } from '../../types';

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export const STOCK_STATUS_OPTIONS: Array<{ value: StockStatus; label: string }> = [
  { value: 'In Stock', label: 'In stock' },
  { value: 'Low Stock', label: 'Low stock' },
  { value: 'Out of Stock', label: 'Out of stock' },
];

/** Common units offered in the product form; any other unit can still be typed. */
export const COMMON_UNITS = ['PCS', 'KG', 'G', 'L', 'M', 'BOX', 'ROLL', 'SET', 'PACK', 'UNIT'];

/**
 * Stock status from backend data: out of stock at zero on hand, low when the
 * backend's low-stock alert (reorder rule minimum) includes the product.
 */
export const stockStatus = (onHand: number, lowStockIds: Set<string>, productId: string): StockStatus =>
  onHand <= 0 ? 'Out of Stock' : lowStockIds.has(productId) ? 'Low Stock' : 'In Stock';

export const totalsByProduct = (balances: ProductStock[], warehouseId?: string) => {
  const totals = new Map<string, number>();
  balances
    .filter((b) => !warehouseId || b.warehouse_id === warehouseId)
    .forEach((b) => totals.set(b.product_id, (totals.get(b.product_id) ?? 0) + Number(b.quantity)));
  return totals;
};

/** The warehouse holding most of a product's stock, used as its "primary" warehouse. */
export const primaryWarehouseId = (balances: ProductStock[], productId: string) => {
  const byWarehouse = new Map<string, number>();
  balances
    .filter((b) => b.product_id === productId)
    .forEach((b) => byWarehouse.set(b.warehouse_id, (byWarehouse.get(b.warehouse_id) ?? 0) + Number(b.quantity)));
  let best: string | undefined;
  let bestQty = -1;
  byWarehouse.forEach((qty, id) => {
    if (qty > bestQty) {
      best = id;
      bestQty = qty;
    }
  });
  return best;
};

export const lowStockSet = (alerts: LowStockAlert[]) => new Set(alerts.map((a) => a.product_id));

/** Builds a CSV file body; values are quoted so commas and quotes stay intact. */
export const toCsv = (rows: Array<Array<string | number>>) =>
  rows
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
