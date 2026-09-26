import React from 'react';
import { api } from '../../services/api';
import type { Adjustment, Delivery, OperationStatusCode, Receipt, Transfer } from '../../types';
import { OperationList } from './OperationList';
import { QuantityText } from './OperationComponents';
import { formatQty, useCatalog } from './operationUtils';

// Module-level fetchers keep a stable identity for the list's data loading.
const fetchReceipts = (s: OperationStatusCode | undefined, o: number, l: number) =>
  api.getReceipts(s, o, l);
const fetchDeliveries = (s: OperationStatusCode | undefined, o: number, l: number) =>
  api.getDeliveries(s, o, l);
const fetchTransfers = (s: OperationStatusCode | undefined, o: number, l: number) =>
  api.getTransfers(s, o, l);
const fetchAdjustments = (s: OperationStatusCode | undefined, o: number, l: number) =>
  api.getAdjustments(s, o, l);

const Muted: React.FC<{ text: string }> = ({ text }) => (
  <span
    style={{
      color: text ? 'var(--text-secondary)' : 'var(--text-muted)',
      display: 'inline-block',
      maxWidth: '320px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}
    title={text}
  >
    {text || '—'}
  </span>
);

export const ReceiptList: React.FC = () => (
  <OperationList<Receipt>
    kind="receipt"
    subtitle="Incoming goods from suppliers. Stock increases only when a receipt is validated."
    fetchPage={fetchReceipts}
    searchText={(r) => `${r.supplier} ${r.notes}`}
    columns={[
      { key: 'supplier', header: 'Supplier', render: (r) => <strong>{r.supplier || '—'}</strong> },
      { key: 'notes', header: 'Notes', render: (r) => <Muted text={r.notes} /> },
    ]}
  />
);

export const DeliveryList: React.FC = () => (
  <OperationList<Delivery>
    kind="delivery"
    subtitle="Outgoing stock: Pick → Pack → Validate. Stock decreases only on validation."
    fetchPage={fetchDeliveries}
    searchText={(d) => d.notes}
    columns={[{ key: 'notes', header: 'Notes', render: (d) => <Muted text={d.notes} /> }]}
  />
);

export const TransferList: React.FC = () => (
  <OperationList<Transfer>
    kind="transfer"
    subtitle="Move stock between warehouses and locations. Global stock stays the same."
    fetchPage={fetchTransfers}
    searchText={(t) => t.notes}
    columns={[{ key: 'notes', header: 'Notes', render: (t) => <Muted text={t.notes} /> }]}
  />
);

export const AdjustmentList: React.FC = () => {
  const { catalog } = useCatalog();
  return (
    <OperationList<Adjustment>
      kind="adjustment"
      subtitle="Reconcile recorded stock with physical counts. Every change is kept in the ledger."
      fetchPage={fetchAdjustments}
      editable={false}
      searchText={(a) =>
        `${catalog.productLabel(a.product_id)} ${catalog.locationLabel(a.location_id)} ${a.reason}`
      }
      columns={[
        { key: 'product', header: 'Product', render: (a) => <strong>{catalog.productLabel(a.product_id)}</strong> },
        { key: 'location', header: 'Location', render: (a) => catalog.locationLabel(a.location_id) },
        {
          key: 'counted',
          header: 'Physical Count',
          align: 'right',
          render: (a) => formatQty(a.counted_quantity, catalog.unitOf(a.product_id)),
        },
        {
          key: 'delta',
          header: 'Difference',
          align: 'right',
          render: (a) =>
            a.delta === null ? (
              <span style={{ color: 'var(--text-muted)' }}>On validation</span>
            ) : (
              <QuantityText value={Number(a.delta)} unit={catalog.unitOf(a.product_id)} />
            ),
        },
        { key: 'reason', header: 'Reason', render: (a) => <Muted text={a.reason} /> },
      ]}
    />
  );
};
