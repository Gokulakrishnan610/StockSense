import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import type {
  LedgerEntry,
  LowStockAlert,
  OperationStatusCode,
  ProductStock,
  ReorderRule,
} from '../../types';
import { errorMessage, type DocKind } from '../operations/operationUtils';
import { lineApi } from '../operations/operationWorkflow';

export const PENDING_STATUSES: OperationStatusCode[] = ['DRAFT', 'WAITING', 'READY'];

export interface QueueLine {
  productId: string;
  /** Location stock leaves from (deliveries, transfers). */
  fromLocationId?: string;
  /** Location stock arrives at (receipts, transfers). */
  toLocationId?: string;
  /** Location being counted (adjustments). */
  atLocationId?: string;
  quantity: number;
}

export interface QueueDoc {
  key: string;
  kind: DocKind;
  id: string;
  status: OperationStatusCode;
  createdAt: string;
  partner: string;
  notes: string;
  lines: QueueLine[];
}

async function fetchAll<T>(fetchPage: (offset: number, limit: number) => Promise<T[]>, maxPages = 20) {
  const rows: T[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const batch = await fetchPage(page * 100, 100);
    rows.push(...batch);
    if (batch.length < 100) break;
  }
  return rows;
}

/** Loads every open (Draft/Waiting/Ready) operation with its lines. */
async function loadQueue(): Promise<QueueDoc[]> {
  const byStatus = <T,>(fetch: (s: OperationStatusCode) => Promise<T[]>) =>
    Promise.all(PENDING_STATUSES.map(fetch)).then((lists) => lists.flat());

  const [receipts, deliveries, transfers, adjustments] = await Promise.all([
    byStatus((s) => api.getReceipts(s, 0, 100)),
    byStatus((s) => api.getDeliveries(s, 0, 100)),
    byStatus((s) => api.getTransfers(s, 0, 100)),
    api.getAdjustments('DRAFT', 0, 100),
  ]);

  const withLines = async (
    kind: 'receipt' | 'delivery' | 'transfer',
    doc: { id: string; status: OperationStatusCode; created_at: string; notes: string; supplier?: string }
  ): Promise<QueueDoc> => {
    const items = await lineApi[kind].items(doc.id);
    return {
      key: `${kind}-${doc.id}`,
      kind,
      id: doc.id,
      status: doc.status,
      createdAt: doc.created_at,
      partner: doc.supplier ?? '',
      notes: doc.notes,
      lines: items.map((item) => ({
        productId: item.product_id,
        quantity: Number(item.quantity),
        fromLocationId: kind === 'receipt' ? undefined : item.location_id,
        toLocationId:
          kind === 'receipt'
            ? item.location_id
            : kind === 'transfer'
              ? item.destination_location_id
              : undefined,
      })),
    };
  };

  const docs = await Promise.all([
    ...receipts.map((d) => withLines('receipt', d)),
    ...deliveries.map((d) => withLines('delivery', d)),
    ...transfers.map((d) => withLines('transfer', d)),
  ]);
  const adjustmentDocs: QueueDoc[] = adjustments.map((a) => ({
    key: `adjustment-${a.id}`,
    kind: 'adjustment',
    id: a.id,
    status: a.status,
    createdAt: a.created_at,
    partner: a.reason,
    notes: '',
    lines: [{ productId: a.product_id, atLocationId: a.location_id, quantity: Number(a.counted_quantity) }],
  }));
  return [...docs, ...adjustmentDocs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface DashboardData {
  balances: ProductStock[];
  alerts: LowStockAlert[];
  rules: ReorderRule[];
  queue: QueueDoc[];
  recent: LedgerEntry[];
}

/**
 * All dashboard numbers come from these backend reads; nothing is estimated in
 * the browser beyond summing the returned balances.
 */
export function useDashboardData(filters: { warehouseId: string; categoryId: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const { warehouseId, categoryId } = filters;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ledgerFilter = {
        warehouse_id: warehouseId || undefined,
        category_id: categoryId || undefined,
      };
      const [balances, alerts, rules, queue, recent] = await Promise.all([
        fetchAll((offset, limit) => api.getInventoryStock({ offset, limit })),
        fetchAll((offset, limit) => api.getLowStockAlerts(offset, limit)),
        fetchAll((offset, limit) => api.getReorderRules(undefined, offset, limit)),
        loadQueue(),
        api.getLedger({ ...ledgerFilter, limit: 12 }),
      ]);
      setData({
        balances,
        alerts,
        rules,
        queue,
        recent,
      });
      setUpdatedAt(new Date());
    } catch (err) {
      setError(errorMessage(err, 'Failed to load the dashboard'));
    } finally {
      setLoading(false);
    }
  }, [warehouseId, categoryId]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, updatedAt, reload: load };
}
