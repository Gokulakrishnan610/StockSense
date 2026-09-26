import React from 'react';
import type { Column } from '../../components/ui/DataTable';
import { api } from '../../services/api';
import type { Adjustment, Delivery, OperationStatusCode, Receipt, Transfer } from '../../types';
import { OperationList, type ListContext } from './OperationList';
import { QuantityText } from './OperationComponents';
import { formatQty, type Catalog } from './operationUtils';
import { lineApi, type LineDocKind, type LineItem } from './operationWorkflow';

// Module-level functions keep a stable identity for the list's data loading.
const fetchReceipts = (s: OperationStatusCode | undefined, o: number, l: number) => api.getReceipts(s, o, l);
const fetchDeliveries = (s: OperationStatusCode | undefined, o: number, l: number) => api.getDeliveries(s, o, l);
const fetchTransfers = (s: OperationStatusCode | undefined, o: number, l: number) => api.getTransfers(s, o, l);
const fetchAdjustments = (s: OperationStatusCode | undefined, o: number, l: number) => api.getAdjustments(s, o, l);
const receiptLines = (id: string) => lineApi.receipt.items(id);
const deliveryLines = (id: string) => lineApi.delivery.items(id);
const transferLines = (id: string) => lineApi.transfer.items(id);

const shortPlace = (catalog: Catalog, locationId?: string) => {
  if (!locationId) return '—';
  const loc = catalog.locationById.get(locationId);
  const wh = loc ? catalog.warehouseById.get(loc.warehouse_id) : undefined;
  return loc ? `${wh?.short_code ?? ''}/${loc.name}` : locationId.slice(0, 8);
};

const places = (catalog: Catalog, ids: Array<string | undefined>) => {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (!unique.length) return '—';
  return unique.length === 1 ? shortPlace(catalog, unique[0]) : `${shortPlace(catalog, unique[0])} +${unique.length - 1}`;
};

const fromIds = (kind: LineDocKind, lines: LineItem[]) => (kind === 'receipt' ? [] : lines.map((l) => l.location_id));
const toIds = (kind: LineDocKind, lines: LineItem[]) =>
  kind === 'receipt' ? lines.map((l) => l.location_id) : lines.map((l) => l.destination_location_id);

const Pending: React.FC = () => <span className="cell-sub">…</span>;

/** Warehouse, route and quantity columns shared by receipts, deliveries and transfers. */
function lineColumns<T extends { id: string; notes: string; supplier?: string }>(
  kind: LineDocKind,
  { catalog, linesOf }: ListContext
): Column<T>[] {
  return [
    {
      key: 'partner',
      header: kind === 'receipt' ? 'Supplier' : kind === 'delivery' ? 'Dispatch' : 'Route',
      render: (row) => {
        const lines = linesOf(row.id);
        if (!lines) return <Pending />;
        const from = places(catalog, fromIds(kind, lines));
        const to = places(catalog, toIds(kind, lines));
        const title =
          kind === 'receipt' ? row.supplier || 'Unnamed supplier' : kind === 'delivery' ? row.notes || 'Customer delivery' : `${from} → ${to}`;
        const route = kind === 'receipt' ? `→ ${to}` : kind === 'delivery' ? `${from} → Customer` : row.notes;
        return (
          <div style={{ minWidth: 0, maxWidth: 280 }}>
            <div className="cell-main" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={title}>
              {title}
            </div>
            {route && <span className="op-list-route" title={route}>{route}</span>}
          </div>
        );
      },
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (row) => {
        const lines = linesOf(row.id);
        if (!lines) return <Pending />;
        const whIds = [...new Set([...fromIds(kind, lines), ...toIds(kind, lines)]
          .map((id) => (id ? catalog.locationById.get(id)?.warehouse_id : undefined))
          .filter(Boolean))] as string[];
        const first = whIds[0] ? catalog.warehouseById.get(whIds[0]) : undefined;
        if (!first) return <span className="cell-sub">—</span>;
        return (
          <div>
            <div className="cell-main">{first.short_code}{whIds.length > 1 ? ` +${whIds.length - 1}` : ''}</div>
            <div className="cell-sub">{first.name}</div>
          </div>
        );
      },
    },
    {
      key: 'qty',
      header: 'Items & Qty',
      align: 'right',
      render: (row) => {
        const lines = linesOf(row.id);
        if (!lines) return <Pending />;
        if (!lines.length) return <span className="cell-sub">No lines</span>;
        const units = new Set(lines.map((l) => catalog.unitOf(l.product_id)));
        const total = lines.reduce((sum, l) => sum + Number(l.quantity), 0);
        return (
          <div style={{ whiteSpace: 'nowrap' }}>
            <div className="cell-main"><strong>{units.size > 1 ? 'Mixed units' : formatQty(total, [...units][0])}</strong></div>
            <div className="cell-sub">{lines.length} line{lines.length === 1 ? '' : 's'}</div>
          </div>
        );
      },
    },
  ];
}

const lineSearch = (kind: LineDocKind) => (row: { id: string; notes: string; supplier?: string }, { catalog, linesOf }: ListContext) => {
  const products = (linesOf(row.id) ?? []).map((l) => {
    const p = catalog.productById.get(l.product_id);
    return p ? `${p.name} ${p.sku}` : '';
  });
  return [kind === 'receipt' ? row.supplier : '', row.notes, ...products].join(' ');
};

const lineLocations = (kind: LineDocKind) => (row: { id: string }, { linesOf }: ListContext) => {
  const lines = linesOf(row.id) ?? [];
  return [...fromIds(kind, lines), ...toIds(kind, lines)].filter(Boolean) as string[];
};

export const ReceiptList: React.FC = () => (
  <OperationList<Receipt>
    kind="receipt"
    subtitle="Goods arriving from suppliers. Stock increases only when a receipt is validated."
    fetchPage={fetchReceipts}
    loadLines={receiptLines}
    columns={(ctx) => lineColumns<Receipt>('receipt', ctx)}
    searchText={lineSearch('receipt')}
    locationIdsOf={lineLocations('receipt')}
    validateFrom="READY"
    validate={(id) => api.validateReceipt(id)}
  />
);

export const DeliveryList: React.FC = () => (
  <OperationList<Delivery>
    kind="delivery"
    subtitle="Outgoing stock: Pick → Pack → Validate. Stock decreases only on validation."
    fetchPage={fetchDeliveries}
    loadLines={deliveryLines}
    columns={(ctx) => lineColumns<Delivery>('delivery', ctx)}
    searchText={lineSearch('delivery')}
    locationIdsOf={lineLocations('delivery')}
    validateFrom="READY"
    validate={(id) => api.validateDelivery(id)}
  />
);

export const TransferList: React.FC = () => (
  <OperationList<Transfer>
    kind="transfer"
    subtitle="Move stock between warehouses and locations. Global stock stays the same."
    fetchPage={fetchTransfers}
    loadLines={transferLines}
    columns={(ctx) => lineColumns<Transfer>('transfer', ctx)}
    searchText={lineSearch('transfer')}
    locationIdsOf={lineLocations('transfer')}
    validateFrom="READY"
    validate={(id) => api.validateTransfer(id)}
  />
);

export const AdjustmentList: React.FC = () => (
    <OperationList<Adjustment>
      kind="adjustment"
      subtitle="Reconcile recorded stock with physical counts. Every change is kept in the ledger."
      fetchPage={fetchAdjustments}
      editable={false}
      validateFrom="DRAFT"
      validate={(id) => api.validateAdjustment(id)}
      locationIdsOf={(a) => [a.location_id]}
      searchText={(a, { catalog }) => `${catalog.productLabel(a.product_id)} ${catalog.locationLabel(a.location_id)} ${a.reason}`}
      columns={({ catalog }) => [
        {
          key: 'product',
          header: 'Product',
          render: (a) => {
            const p = catalog.productById.get(a.product_id);
            return (
              <div>
                <div className="cell-main">{p?.name ?? a.product_id.slice(0, 8)}</div>
                <div className="cell-sub mono">{p?.sku}</div>
              </div>
            );
          },
        },
        { key: 'location', header: 'Location', render: (a) => <span className="mono">{shortPlace(catalog, a.location_id)}</span> },
        {
          key: 'counted',
          header: 'Physical Count',
          align: 'right',
          render: (a) => <strong style={{ whiteSpace: 'nowrap' }}>{formatQty(a.counted_quantity, catalog.unitOf(a.product_id))}</strong>,
        },
        {
          key: 'delta',
          header: 'Difference',
          align: 'right',
          render: (a) =>
            a.delta === null ? (
              <span className="cell-sub">On validation</span>
            ) : (
              <QuantityText value={Number(a.delta)} unit={catalog.unitOf(a.product_id)} />
            ),
        },
        {
          key: 'reason',
          header: 'Reason',
          render: (a) => <span className="op-list-route" style={{ maxWidth: 220 }} title={a.reason}>{a.reason}</span>,
        },
      ]}
    />
);
