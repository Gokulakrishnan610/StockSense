import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, History } from '../../components/ui/icons';
import { api } from '../../services/api';
import type { LedgerEntry, Product } from '../../types';
import { MOVEMENT_LABELS, toMovementRows } from './ledgerUtils';
import { MovementEndLabel, QuantityText } from './OperationComponents';
import { errorMessage, formatDateTime, formatQty, useCatalog } from './operationUtils';

const LIMIT = 100;

/**
 * Movement history of one product from the stock ledger, with the current
 * stock taken from the backend's location balances.
 */
export const ProductMovements: React.FC<{ product: Product; currentStock: number }> = ({
  product,
  currentStock,
}) => {
  const { catalog } = useCatalog();
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getLedger({ product_id: product.id, limit: LIMIT })
      .then((rows) => active && setEntries(rows))
      .catch((err) => active && setError(errorMessage(err, 'Failed to load movement history')));
    return () => {
      active = false;
    };
  }, [product.id]);

  const rows = useMemo(() => (entries ? toMovementRows(entries) : []), [entries]);
  const unit = product.unit_of_measure;

  return (
    <div style={{ marginTop: '20px' }}>
      <h4
        style={{
          margin: '0 0 12px 0',
          fontSize: '0.9375rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <History size={16} style={{ color: 'var(--color-primary)' }} />
        Movement History
      </h4>

      {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>{error}</p>}
      {!entries && !error && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading movements...</p>
      )}
      {entries && rows.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No stock movements recorded for this product yet.
        </p>
      )}
      {rows.length > 0 && (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
          {rows.map((row, index) => (
            <div
              key={row.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 1fr auto',
                gap: '12px',
                alignItems: 'center',
                padding: '10px 14px',
                fontSize: '0.875rem',
                borderTop: index ? '1px solid var(--border-color-subtle)' : 'none',
              }}
            >
              <QuantityText value={row.quantity} unit={unit} signed={!row.paired} />
              <div>
                <div style={{ fontWeight: 600 }}>
                  {MOVEMENT_LABELS[row.type]}{' '}
                  {row.referencePath ? (
                    <Link
                      to={row.referencePath}
                      style={{ fontFamily: 'monospace', color: 'var(--color-primary)', textDecoration: 'none' }}
                    >
                      {row.reference}
                    </Link>
                  ) : null}
                </div>
                <div
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexWrap: 'wrap',
                  }}
                >
                  <MovementEndLabel end={row.from} catalog={catalog} />
                  <ArrowRight size={12} />
                  <MovementEndLabel end={row.to} catalog={catalog} />
                </div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'right' }}>
                {formatDateTime(row.createdAt)}
                <div>{row.userName}</div>
              </div>
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--surface-table-header)',
              fontWeight: 700,
            }}
          >
            <span>Current stock</span>
            <span>{formatQty(currentStock, unit)}</span>
          </div>
        </div>
      )}
      {entries && entries.length === LIMIT && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          Showing the latest {LIMIT} ledger entries.{' '}
          <Link to="/operations/move-history" style={{ color: 'var(--color-primary)' }}>
            Open the full stock ledger
          </Link>
        </p>
      )}
    </div>
  );
};
