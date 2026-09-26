import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, History, User } from '../../components/ui/icons';
import type { LedgerEntry } from '../../types';
import { MOVEMENT_LABELS, toMovementRows } from '../operations/ledgerUtils';
import { QuantityText } from '../operations/OperationComponents';
import type { Catalog } from '../operations/operationUtils';
import { PanelHeader } from './DashboardParts';
import { relativeTime, shortTime } from './dashboardUtils';

export const RecentActivity: React.FC<{ entries: LedgerEntry[]; catalog: Catalog }> = ({ entries, catalog }) => {
  const rows = useMemo(() => toMovementRows(entries).slice(0, 8), [entries]);

  const warehouseOf = (end: { locationId: string } | { external: string }) => {
    if (!('locationId' in end)) return undefined;
    const loc = catalog.locationById.get(end.locationId);
    return loc ? catalog.warehouseById.get(loc.warehouse_id) : undefined;
  };

  return (
    <div className="card panel">
      <PanelHeader title="Recent Inventory Activity" dot="muted" subtitle="Live stock ledger">
        <Link to="/operations/move-history" className="panel-link">
          Full move history <ChevronRight size={14} />
        </Link>
      </PanelHeader>
      {rows.length === 0 ? (
        <div className="panel-empty">
          <History size={20} />
          <span>No stock movements yet. Validated operations appear here.</span>
        </div>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Reference</th>
                <th>Operation</th>
                <th>Warehouse</th>
                <th className="num">Quantity</th>
                <th>User</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const product = catalog.productById.get(row.productId);
                const category = product ? catalog.categories.find((c) => c.id === product.category_id)?.name : '';
                // Destination for inbound/transfer rows, otherwise the source.
                const wh = warehouseOf(row.quantity >= 0 || row.paired ? row.to : row.from) ?? warehouseOf(row.from);
                return (
                  <tr key={row.key}>
                    <td>
                      <div className="cell-main" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={14} /> {shortTime(row.createdAt)}
                      </div>
                      <div className="cell-sub">{relativeTime(row.createdAt)}</div>
                    </td>
                    <td>
                      {row.referencePath ? (
                        <Link to={row.referencePath} className="ref-link">{row.reference}</Link>
                      ) : (
                        <span className="mono">{row.reference}</span>
                      )}
                      <div className="cell-sub">{category}</div>
                    </td>
                    <td className="truncate-cell">
                      <div className="cell-main" title={product?.name}>
                        {MOVEMENT_LABELS[row.type]}: {product?.name ?? row.productId.slice(0, 8)}
                      </div>
                      <div className="cell-sub">{product?.sku}</div>
                    </td>
                    <td>
                      <div className="cell-main">{wh?.short_code ?? '—'}</div>
                      <div className="cell-sub">{wh?.name}</div>
                    </td>
                    <td className="num">
                      <QuantityText value={row.quantity} unit={product?.unit_of_measure} signed={!row.paired} />
                    </td>
                    <td>
                      <span className="cell-main" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <User size={14} /> {row.userName}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="panel-footer">
        <span>Ledger entries are immutable once recorded</span>
        <span className="mono">Showing latest {rows.length} movements</span>
      </div>
    </div>
  );
};
