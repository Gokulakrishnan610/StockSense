import React from 'react';
import { ArrowUpRight, ShieldAlert } from 'lucide-react';

export const DeliveryOrdersStub: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Operations / Delivery Orders</h2>
          <p className="page-subtitle">Outgoing customer dispatches, pick, pack, and validate</p>
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
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            color: 'var(--color-warning)',
          }}
        >
          <ArrowUpRight size={36} />
        </div>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Delivery Orders Workflow</h3>
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
