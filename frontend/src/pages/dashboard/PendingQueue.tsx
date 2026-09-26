import React, { useState } from 'react';
import { notifyOperationsChanged } from '../../layouts/useNavCounts';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CheckCircle2,
  SlidersHorizontal,
} from '../../components/ui/icons';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import type { ProductStock } from '../../types';
import { OperationStatusBadge } from '../operations/OperationComponents';
import { DOC_KINDS, docRef, errorMessage, formatQty, type Catalog, type DocKind } from '../operations/operationUtils';
import { lineApi } from '../operations/operationWorkflow';
import { PanelHeader } from './DashboardParts';
import { relativeTime } from './dashboardUtils';
import type { QueueDoc } from './useDashboardData';

const KIND_META: Record<DocKind, { label: string; Icon: typeof ArrowDownToLine }> = {
  receipt: { label: 'Receipt', Icon: ArrowDownToLine },
  delivery: { label: 'Delivery', Icon: ArrowUpFromLine },
  transfer: { label: 'Transfer', Icon: ArrowLeftRight },
  adjustment: { label: 'Adjustment', Icon: SlidersHorizontal },
};

const TABS: Array<{ value: DocKind | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'receipt', label: 'Receipts' },
  { value: 'delivery', label: 'Deliveries' },
  { value: 'transfer', label: 'Transfers' },
  { value: 'adjustment', label: 'Adjustments' },
];

/** Receipts, deliveries and transfers validate from Ready; adjustments from Draft. */
const canValidate = (doc: QueueDoc) =>
  doc.kind === 'adjustment' ? doc.status === 'DRAFT' : doc.status === 'READY';

export const PendingQueue: React.FC<{
  docs: QueueDoc[];
  catalog: Catalog;
  balances: ProductStock[];
  onChanged: () => void;
}> = ({ docs, catalog, balances, onChanged }) => {
  const { showToast } = useToast();
  const [tab, setTab] = useState<DocKind | ''>('');
  const [confirming, setConfirming] = useState<QueueDoc | null>(null);
  const [running, setRunning] = useState(false);

  const balanceAt = (productId: string, locationId: string) =>
    Number(balances.find((b) => b.product_id === productId && b.location_id === locationId)?.quantity ?? 0);

  const place = (locationId?: string) => {
    if (!locationId) return '—';
    const loc = catalog.locationById.get(locationId);
    const wh = loc ? catalog.warehouseById.get(loc.warehouse_id) : undefined;
    return loc ? `${wh?.short_code ?? ''}/${loc.name}` : locationId.slice(0, 8);
  };

  const places = (ids: Array<string | undefined>) => {
    const unique = [...new Set(ids.filter(Boolean))] as string[];
    if (!unique.length) return '—';
    return unique.length === 1 ? place(unique[0]) : `${place(unique[0])} +${unique.length - 1}`;
  };

  const warehouseCodes = (doc: QueueDoc) => {
    const codes = new Set<string>();
    doc.lines.forEach((l) =>
      [l.fromLocationId, l.toLocationId, l.atLocationId].forEach((id) => {
        const loc = id ? catalog.locationById.get(id) : undefined;
        const wh = loc ? catalog.warehouseById.get(loc.warehouse_id) : undefined;
        if (wh) codes.add(wh.short_code);
      })
    );
    return [...codes].join(', ') || '—';
  };

  /** Lines that ask for more than the source location currently holds. */
  const shortLines = (doc: QueueDoc) => {
    if (doc.kind !== 'delivery' && doc.kind !== 'transfer') return 0;
    const requested = new Map<string, number>();
    doc.lines.forEach((l) => {
      if (!l.fromLocationId) return;
      const key = `${l.productId}|${l.fromLocationId}`;
      requested.set(key, (requested.get(key) ?? 0) + l.quantity);
    });
    return [...requested].filter(([key, qty]) => {
      const [productId, locationId] = key.split('|');
      return qty > balanceAt(productId, locationId);
    }).length;
  };

  const route = (doc: QueueDoc): { title: string; detail: string } => {
    const firstProduct = doc.lines[0] ? catalog.productById.get(doc.lines[0].productId)?.name : undefined;
    switch (doc.kind) {
      case 'receipt':
        return {
          title: doc.partner || 'Unnamed supplier',
          detail: `Vendor → ${places(doc.lines.map((l) => l.toLocationId))}`,
        };
      case 'delivery':
        return {
          title: doc.notes || firstProduct || 'Customer delivery',
          detail: `${places(doc.lines.map((l) => l.fromLocationId))} → Customer`,
        };
      case 'transfer':
        return {
          title: places(doc.lines.map((l) => l.toLocationId)),
          detail: `${places(doc.lines.map((l) => l.fromLocationId))} → ${places(doc.lines.map((l) => l.toLocationId))}`,
        };
      case 'adjustment':
        return {
          title: firstProduct ?? 'Stock count',
          detail: `Count at ${place(doc.lines[0]?.atLocationId)} · ${doc.partner}`,
        };
    }
  };

  const quantitySummary = (doc: QueueDoc) => {
    if (!doc.lines.length) return { value: '—', detail: 'No lines yet' };
    const units = new Set(doc.lines.map((l) => catalog.unitOf(l.productId)));
    const total = doc.lines.reduce((sum, l) => sum + l.quantity, 0);
    const value =
      doc.kind === 'adjustment'
        ? `Count ${formatQty(total, [...units][0])}`
        : units.size === 1
          ? formatQty(total, [...units][0])
          : 'Mixed units';
    const lines = doc.lines.length;
    return { value, detail: `${lines} line${lines === 1 ? '' : 's'}` };
  };

  const validate = async () => {
    if (!confirming) return;
    const doc = confirming;
    setRunning(true);
    try {
      if (doc.kind === 'adjustment') await api.validateAdjustment(doc.id);
      else await lineApi[doc.kind].validate(doc.id);
      showToast('success', `${docRef(doc.kind, doc.id)} validated`, 'Stock has been updated.');
      onChanged();
      notifyOperationsChanged();
    } catch (err) {
      showToast('error', `${docRef(doc.kind, doc.id)} not validated`, errorMessage(err));
    } finally {
      setRunning(false);
      setConfirming(null);
    }
  };

  const visible = docs.filter((d) => !tab || d.kind === tab);
  const countOf = (kind: DocKind | '') => docs.filter((d) => !kind || d.kind === kind).length;

  return (
    <div className="card panel">
      <PanelHeader title="Pending Operations Queue" dot="primary" badge={`${docs.length} open`}>
        <div className="segmented" role="tablist" aria-label="Filter by document type">
          {TABS.map((t) => (
            <button
              key={t.label}
              role="tab"
              aria-selected={tab === t.value}
              className={tab === t.value ? 'active' : ''}
              onClick={() => setTab(t.value)}
            >
              {t.label}
              <span className="segmented-count">{countOf(t.value)}</span>
            </button>
          ))}
        </div>
      </PanelHeader>

      {visible.length === 0 ? (
        <div className="panel-empty">
          <CheckCircle2 size={20} />
          <span>Nothing waiting here. New operations appear in this queue until they are validated or canceled.</span>
        </div>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Type</th>
                <th>Route / Partner</th>
                <th className="num">Items</th>
                <th>Created</th>
                <th>Status</th>
                <th className="num">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((doc) => {
                const { Icon, label } = KIND_META[doc.kind];
                const r = route(doc);
                const qty = quantitySummary(doc);
                const short = shortLines(doc);
                const path = `${DOC_KINDS[doc.kind].path}/${doc.id}`;
                return (
                  <tr key={doc.key}>
                    <td>
                      <Link to={path} className="ref-link">{docRef(doc.kind, doc.id)}</Link>
                      <div className="cell-sub">{warehouseCodes(doc)}</div>
                    </td>
                    <td>
                      <span className="type-cell"><Icon size={14} />{label}</span>
                    </td>
                    <td className="truncate-cell">
                      <div className="cell-main" title={r.title}>{r.title}</div>
                      <div className="cell-sub" title={r.detail}>{r.detail}</div>
                    </td>
                    <td className="num">
                      <div className="cell-main">{qty.value}</div>
                      <div className="cell-sub">{qty.detail}</div>
                    </td>
                    <td>
                      <div className="cell-main">{relativeTime(doc.createdAt)}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <OperationStatusBadge status={doc.status} />
                        {short > 0 && (
                          <span className="chip chip-danger" title="A line asks for more than its source location holds">
                            Short stock
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="num">
                      {canValidate(doc) && doc.lines.length > 0 ? (
                        <button className="btn btn-primary btn-sm" onClick={() => setConfirming(doc)}>
                          Validate
                        </button>
                      ) : (
                        <Link to={path} className="btn btn-secondary btn-sm">Open</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmationDialog
        isOpen={confirming !== null}
        onClose={() => !running && setConfirming(null)}
        onConfirm={validate}
        loading={running}
        title={confirming ? `Validate ${docRef(confirming.kind, confirming.id)}?` : ''}
        message="Stock balances and the stock ledger are updated immediately. This cannot be undone."
        confirmLabel="Validate"
        cancelLabel="Back"
      />
    </div>
  );
};
