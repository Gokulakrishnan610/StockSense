import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

export const InventoryAdjustmentsStub: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Operations / Inventory Adjustments</h2>
          <p className="page-subtitle">Physical stock counts, variance corrections, and audit adjustments</p>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: '40px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            padding: '16px',
            borderRadius: '50%',
            backgroundColor: 'rgba(6, 182, 212, 0.15)',
            color: 'var(--color-info)',
          }}
        >
          <RefreshCw size={36} />
        </div>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Inventory Adjustments</h3>
        <p style={{ maxWidth: '480px', margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          This operation module is owned by Member 4 (Operations Frontend). Member 3 shell navigation is ready for full feature integration.
        </p>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(234, 179, 8, 0.12)',
            color: '#eab308',
            fontSize: '0.75rem',
            fontWeight: 600,
            marginTop: '8px',
          }}
        >
          <ShieldAlert size={14} />
          MEMBER 4 INTEGRATION TARGET
        </div>
      </div>
    </div>
  );
};
