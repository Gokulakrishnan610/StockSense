import React from 'react';

export type StatusVariant =
  | 'Draft'
  | 'Waiting'
  | 'Ready'
  | 'Done'
  | 'Canceled'
  | 'INVENTORY_MANAGER'
  | 'WAREHOUSE_STAFF'
  | 'In Stock'
  | 'Low Stock'
  | 'Out of Stock'
  | string;

interface StatusBadgeProps {
  status: StatusVariant;
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const displayText = label || status;

  let bg = 'rgba(100, 116, 139, 0.12)';
  let color = 'var(--text-muted)';
  let border = '1px solid rgba(100, 116, 139, 0.2)';

  switch (status) {
    case 'Draft':
      bg = 'rgba(148, 163, 184, 0.15)';
      color = '#94a3b8';
      border = '1px solid rgba(148, 163, 184, 0.3)';
      break;
    case 'Waiting':
      bg = 'rgba(234, 179, 8, 0.15)';
      color = '#eab308';
      border = '1px solid rgba(234, 179, 8, 0.3)';
      break;
    case 'Ready':
      bg = 'rgba(59, 130, 246, 0.15)';
      color = '#3b82f6';
      border = '1px solid rgba(59, 130, 246, 0.3)';
      break;
    case 'Done':
    case 'In Stock':
      bg = 'rgba(34, 197, 94, 0.15)';
      color = '#22c55e';
      border = '1px solid rgba(34, 197, 94, 0.3)';
      break;
    case 'Canceled':
    case 'Out of Stock':
      bg = 'rgba(239, 68, 68, 0.15)';
      color = '#ef4444';
      border = '1px solid rgba(239, 68, 68, 0.3)';
      break;
    case 'Low Stock':
      bg = 'rgba(249, 115, 22, 0.15)';
      color = '#f97316';
      border = '1px solid rgba(249, 115, 22, 0.3)';
      break;
    case 'INVENTORY_MANAGER':
      bg = 'rgba(168, 85, 247, 0.15)';
      color = '#a855f7';
      border = '1px solid rgba(168, 85, 247, 0.3)';
      break;
    case 'WAREHOUSE_STAFF':
      bg = 'rgba(14, 165, 233, 0.15)';
      color = '#0ea5e9';
      border = '1px solid rgba(14, 165, 233, 0.3)';
      break;
    default:
      break;
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: bg,
        color: color,
        border: border,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {displayText}
    </span>
  );
};
