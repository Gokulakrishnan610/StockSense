import React from 'react';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import { Pagination } from './Pagination';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (item: T, index: number) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  pagination?: {
    offset: number;
    limit: number;
    totalCount?: number;
    hasMore?: boolean;
    onPageChange: (offset: number) => void;
  };
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  pagination,
}: DataTableProps<T>) {
  if (loading) {
    return <LoadingState height="300px" />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: 'var(--surface-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.875rem',
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--surface-table-header)',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    width: col.width,
                    textAlign: col.align || 'left',
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr
                key={keyExtractor(item)}
                className="table-row-hover"
                style={{
                  borderBottom:
                    index === data.length - 1 && !pagination
                      ? 'none'
                      : '1px solid var(--border-color-subtle)',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '14px 16px',
                      color: 'var(--text-primary)',
                      textAlign: col.align || 'left',
                      verticalAlign: 'middle',
                    }}
                  >
                    {col.render
                      ? col.render(item, index)
                      : (item as Record<string, unknown>)[col.key] !== undefined
                      ? String((item as Record<string, unknown>)[col.key])
                      : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && (
        <Pagination
          offset={pagination.offset}
          limit={pagination.limit}
          totalCount={pagination.totalCount}
          hasMore={pagination.hasMore}
          onPageChange={pagination.onPageChange}
        />
      )}
    </div>
  );
}
