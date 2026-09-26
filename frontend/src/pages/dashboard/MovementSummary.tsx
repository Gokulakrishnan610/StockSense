import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  SlidersHorizontal,
  Warehouse as WarehouseIcon,
} from '../../components/ui/icons';
import type { LedgerEntry, MovementType } from '../../types';
import type { Catalog } from '../operations/operationUtils';
import { PanelHeader } from './DashboardParts';
import type { Period } from './useDashboardData';

const TYPES: Array<{ type: MovementType; label: string; className: string; Icon: typeof ArrowDownToLine; verb: string }> = [
  { type: 'RECEIPT', label: 'Inbound', className: 'seg-in', Icon: ArrowDownToLine, verb: 'receipts validated' },
  { type: 'DELIVERY', label: 'Outbound', className: 'seg-out', Icon: ArrowUpFromLine, verb: 'deliveries shipped' },
  { type: 'TRANSFER', label: 'Internal', className: 'seg-int', Icon: ArrowLeftRight, verb: 'transfers completed' },
  { type: 'ADJUSTMENT', label: 'Adjusted', className: 'seg-adj', Icon: SlidersHorizontal, verb: 'counts reconciled' },
];

const PERIOD_LABELS: Record<Period, string> = { '24h': 'Last 24 hours', '7d': 'Last 7 days', '30d': 'Last 30 days' };

export const MovementSummary: React.FC<{
  entries: LedgerEntry[];
  truncated: boolean;
  catalog: Catalog;
  warehouseId: string;
  period: Period;
  onPeriodChange: (period: Period) => void;
}> = ({ entries, truncated, catalog, warehouseId, period, onPeriodChange }) => {
  const docs = (type: MovementType) =>
    new Set(entries.filter((e) => e.transaction_type === type).map((e) => e.reference_id)).size;
  const lines = (type: MovementType) => entries.filter((e) => e.transaction_type === type).length;

  const counts = TYPES.map((t) => ({ ...t, docs: docs(t.type), lines: lines(t.type) }));
  const totalDocs = counts.reduce((sum, c) => sum + c.docs, 0);

  const warehouses = warehouseId
    ? catalog.warehouses.filter((w) => w.id === warehouseId)
    : catalog.warehouses;
  const byWarehouse = warehouses.map((w) => {
    const here = entries.filter((e) => catalog.locationById.get(e.location_id)?.warehouse_id === w.id);
    return {
      warehouse: w,
      in: here.filter((e) => Number(e.quantity) > 0).length,
      out: here.filter((e) => Number(e.quantity) < 0).length,
    };
  });

  return (
    <div className="card panel">
      <PanelHeader title="Inventory Movement Summary" dot="success">
        <select
          className="period-select"
          value={period}
          onChange={(e) => onPeriodChange(e.target.value as Period)}
          aria-label="Summary period"
        >
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
          ))}
        </select>
      </PanelHeader>

      <div className="panel-body">
        <div className="movement-grid">
          {counts.map(({ type, label, className, Icon, docs: n, lines: l, verb }) => (
            <Link key={type} to={`/operations/move-history?type=${type}`} className={`movement-tile ${className}`}>
              <span className="movement-label"><Icon size={14} /> {label}</span>
              <span className="movement-value">{n}</span>
              <span className="cell-sub">{verb} · {l} line{l === 1 ? '' : 's'}</span>
            </Link>
          ))}
        </div>

        <div className="breakdown-head">
          <span>Movement breakdown</span>
          <span className="mono">{totalDocs} document{totalDocs === 1 ? '' : 's'}</span>
        </div>
        <div className="breakdown-bar" role="img" aria-label="Share of documents by movement type">
          {totalDocs === 0 ? (
            <span className="seg-empty" style={{ width: '100%' }} />
          ) : (
            counts.map((c) =>
              c.docs ? <span key={c.type} className={c.className} style={{ width: `${(c.docs / totalDocs) * 100}%` }} /> : null
            )
          )}
        </div>
        <div className="breakdown-legend">
          {counts.map((c) => (
            <span key={c.type}>
              <i className={`legend-dot ${c.className}`} />
              {c.label} ({totalDocs ? Math.round((c.docs / totalDocs) * 100) : 0}%)
            </span>
          ))}
        </div>

        <h4 className="subheading">Movements by warehouse</h4>
        <div className="warehouse-moves">
          {byWarehouse.length === 0 && <span className="cell-sub">No warehouses configured.</span>}
          {byWarehouse.map(({ warehouse, in: inCount, out }) => (
            <Link key={warehouse.id} to={`/warehouses/${warehouse.id}`} className="warehouse-move-row">
              <WarehouseIcon size={14} />
              <strong>{warehouse.short_code}</strong>
              <span className="cell-sub truncate">{warehouse.name}</span>
              <span className="mono" style={{ color: 'var(--color-success)' }} title="Stock-in movements">+{inCount}</span>
              <span className="mono" style={{ color: 'var(--color-danger)' }} title="Stock-out movements">−{out}</span>
            </Link>
          ))}
        </div>
        <p className="cell-sub" style={{ marginTop: 10 }}>
          Counts of ledger movements in and out of each warehouse ({PERIOD_LABELS[period].toLowerCase()}).
          {truncated && ' Showing the latest 500 movements.'}
        </p>
      </div>
    </div>
  );
};
