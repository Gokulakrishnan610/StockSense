import React from 'react';
import { ChevronLeft, ChevronRight } from './icons';

interface PaginationProps {
  offset: number;
  limit: number;
  totalCount?: number;
  hasMore?: boolean;
  onPageChange: (newOffset: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  offset,
  limit,
  totalCount,
  hasMore,
  onPageChange,
}) => {
  const currentPage = Math.floor(offset / limit) + 1;
  const canGoPrev = offset > 0;
  const canGoNext =
    typeof totalCount === 'number'
      ? offset + limit < totalCount
      : hasMore ?? false;

  const handlePrev = () => {
    if (canGoPrev) {
      onPageChange(Math.max(0, offset - limit));
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      onPageChange(offset + limit);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderTop: '1px solid var(--border-color)',
        fontSize: '0.875rem',
        color: 'var(--text-muted)',
      }}
    >
      <div>
        Showing {offset + 1}
        {typeof totalCount === 'number' && ` to ${Math.min(offset + limit, totalCount)} of ${totalCount}`}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={handlePrev}
          disabled={!canGoPrev}
          className="btn btn-secondary btn-sm"
          style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <ChevronLeft size={16} />
          Previous
        </button>
        <span style={{ fontWeight: 600, padding: '0 8px', color: 'var(--text-primary)' }}>
          Page {currentPage}
        </span>
        <button
          onClick={handleNext}
          disabled={!canGoNext}
          className="btn btn-secondary btn-sm"
          style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
