import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { api } from '../../services/api';
import type { LedgerEntry, OperationStatusCode } from '../../types';
import { MOVEMENT_LABELS, type MovementEnd } from './ledgerUtils';
import { STATUS_LABELS, errorMessage, formatQty, formatSignedQty, type Catalog } from './operationUtils';

export const OperationStatusBadge: React.FC<{ status: OperationStatusCode }> = ({ status }) => (
  <StatusBadge status={STATUS_LABELS[status] ?? status} />
);

/** Horizontal progress indicator for the operation workflow. */
export const StatusSteps: React.FC<{
  steps: Array<{ status: OperationStatusCode; label: string }>;
  current: OperationStatusCode;
}> = ({ steps, current }) => {
  const canceled = current === 'CANCELED';
  const currentIndex = steps.findIndex((s) => s.status === current);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      {steps.map((step, index) => {
        const done = !canceled && index < currentIndex;
        const active = !canceled && index === currentIndex;
        return (
          <React.Fragment key={step.status}>
            {index > 0 && <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '0.8125rem',
                fontWeight: active ? 700 : 500,
                color: active ? '#fff' : done ? 'var(--color-success)' : 'var(--text-muted)',
                backgroundColor: active ? 'var(--color-primary)' : 'transparent',
                border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border-color)'}`,
                opacity: canceled ? 0.5 : 1,
              }}
            >
              {done && <Check size={13} />}
              {step.label}
            </span>
          </React.Fragment>
        );
      })}
      {canceled && <StatusBadge status="Canceled" />}
    </div>
  );
};

export const InlineAlert: React.FC<{ tone?: 'error' | 'success'; children: React.ReactNode }> = ({
  tone = 'error',
  children,
}) => {
  const isError = tone === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: '8px',
        backgroundColor: isError ? 'var(--surface-danger-subtle)' : 'rgba(16, 185, 129, 0.1)',
        border: `1px solid ${isError ? 'var(--border-danger)' : 'rgba(16, 185, 129, 0.4)'}`,
        color: isError ? 'var(--color-danger)' : 'var(--color-success)',
        fontSize: '0.8438rem',
        marginBottom: '16px',
      }}
    >
      {isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
};

export const BackLink: React.FC<{ to: string; label: string }> = ({ to, label }) => (
  <Link
    to={to}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      color: 'var(--text-muted)',
      fontSize: '0.8125rem',
      textDecoration: 'none',
      marginBottom: '12px',
    }}
  >
    <ArrowLeft size={14} /> {label}
  </Link>
);

export const InfoGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '16px',
    }}
  >
    {children}
  </div>
);

export const InfoItem: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div>
    <div
      style={{
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </div>
    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{children}</div>
  </div>
);

export const MovementEndLabel: React.FC<{ end: MovementEnd; catalog: Catalog }> = ({
  end,
  catalog,
}) =>
  'locationId' in end ? (
    <span>{catalog.locationLabel(end.locationId)}</span>
  ) : (
    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{end.external}</span>
  );

export const QuantityText: React.FC<{ value: number; unit?: string; signed?: boolean }> = ({
  value,
  unit,
  signed = true,
}) => (
  <span
    style={{
      fontWeight: 700,
      color: !signed
        ? 'var(--text-primary)'
        : value > 0
          ? 'var(--color-success)'
          : value < 0
            ? 'var(--color-danger)'
            : 'var(--text-primary)',
    }}
  >
    {signed ? formatSignedQty(value, unit) : formatQty(value, unit)}
  </span>
);

const cellStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left' };
const headStyle: React.CSSProperties = {
  ...cellStyle,
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  fontWeight: 600,
};

/**
 * Shows the ledger entries a validated operation produced: the real stock
 * change per location, as recorded by the backend.
 */
export const StockUpdatePanel: React.FC<{ referenceId: string; catalog: Catalog }> = ({
  referenceId,
  catalog,
}) => {
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getLedger({ reference_id: referenceId, limit: 100 })
      .then((rows) => active && setEntries(rows))
      .catch((err) => active && setError(errorMessage(err, 'Failed to load stock movements')));
    return () => {
      active = false;
    };
  }, [referenceId]);

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 600 }}>
        Stock Updated
      </h3>
      {error && <InlineAlert>{error}</InlineAlert>}
      {!entries && !error && (
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading stock movements...</p>
      )}
      {entries && entries.length === 0 && (
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          No stock change was needed (counted quantity matched the system quantity).
        </p>
      )}
      {entries && entries.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={headStyle}>Product</th>
                <th style={headStyle}>Location</th>
                <th style={headStyle}>Movement</th>
                <th style={{ ...headStyle, textAlign: 'right' }}>Before</th>
                <th style={{ ...headStyle, textAlign: 'right' }}>Change</th>
                <th style={{ ...headStyle, textAlign: 'right' }}>After</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const unit = catalog.unitOf(entry.product_id);
                return (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color-subtle)' }}>
                    <td style={cellStyle}>{catalog.productLabel(entry.product_id)}</td>
                    <td style={cellStyle}>{catalog.locationLabel(entry.location_id)}</td>
                    <td style={cellStyle}>{MOVEMENT_LABELS[entry.transaction_type]}</td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      {formatQty(entry.before_quantity, unit)}
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      <QuantityText value={Number(entry.quantity)} unit={unit} />
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700 }}>
                      {formatQty(entry.after_quantity, unit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
