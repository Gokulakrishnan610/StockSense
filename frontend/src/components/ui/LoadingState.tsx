import React from 'react';
import { Loader2 } from './icons';

interface LoadingStateProps {
  message?: string;
  height?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
  height = '200px',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: height,
        gap: '12px',
        color: 'var(--text-muted)',
      }}
    >
      <Loader2
        size={24}
        className="animate-spin"
        style={{ color: 'var(--color-primary)' }}
      />
      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{message}</span>
    </div>
  );
};
