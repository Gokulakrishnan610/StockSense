import React from 'react';
import { PackageOpen } from './icons';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  height?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No records found',
  description = 'There are no items matching your criteria.',
  icon = <PackageOpen size={24} style={{ color: 'var(--text-muted)' }} />,
  actionLabel,
  onAction,
  height = '240px',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: height,
        padding: '32px 16px',
        textAlign: 'center',
        backgroundColor: 'var(--surface-card)',
        borderRadius: '12px',
        border: '1px dashed var(--border-color)',
        margin: '12px 0',
      }}
    >
      <div style={{ marginBottom: '12px', opacity: 0.8 }}>{icon}</div>
      <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
        {title}
      </h4>
      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '400px' }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn btn-primary"
          style={{ marginTop: '16px' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
