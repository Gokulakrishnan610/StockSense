import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  height?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load data',
  message = 'An unexpected error occurred while fetching information from the server.',
  onRetry,
  height = '220px',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: height,
        padding: '24px',
        textAlign: 'center',
        backgroundColor: 'var(--surface-danger-subtle)',
        borderRadius: '12px',
        border: '1px solid var(--border-danger)',
        margin: '12px 0',
      }}
    >
      <AlertCircle size={36} style={{ color: 'var(--color-danger)', marginBottom: '10px' }} />
      <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 600, color: 'var(--color-danger)' }}>
        {title}
      </h4>
      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '460px' }}>
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn btn-secondary"
          style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={15} />
          Retry
        </button>
      )}
    </div>
  );
};
