import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit3, Eye, Plus } from '../../components/ui/icons';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ErrorState } from '../../components/ui/ErrorState';
import { FilterDropdown } from '../../components/ui/FilterDropdown';
import { SearchInput } from '../../components/ui/SearchInput';
import type { OperationStatusCode } from '../../types';
import { OperationStatusBadge } from './OperationComponents';
import {
  DOC_KINDS,
  STATUS_OPTIONS,
  docRef,
  errorMessage,
  formatDateTime,
  isTerminal,
  type DocKind,
} from './operationUtils';

const PAGE_SIZE = 20;

interface OperationRecord {
  id: string;
  status: OperationStatusCode;
  created_at: string;
}

interface OperationListProps<T extends OperationRecord> {
  kind: DocKind;
  subtitle: string;
  fetchPage: (status: OperationStatusCode | undefined, offset: number, limit: number) => Promise<T[]>;
  columns: Column<T>[];
  /** Extra text matched by the search box in addition to the reference. */
  searchText?: (item: T) => string;
  editable?: boolean;
}

export function OperationList<T extends OperationRecord>({
  kind,
  subtitle,
  fetchPage,
  columns,
  searchText,
  editable = true,
}: OperationListProps<T>) {
  const navigate = useNavigate();
  const meta = DOC_KINDS[kind];
  const [rows, setRows] = useState<T[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Ask for one extra row to know whether a next page exists.
      const page = await fetchPage(
        (status || undefined) as OperationStatusCode | undefined,
        offset,
        PAGE_SIZE + 1
      );
      setRows(page);
    } catch (err) {
      setError(errorMessage(err, `Failed to load ${meta.plural.toLowerCase()}`));
    } finally {
      setLoading(false);
    }
  }, [fetchPage, status, offset, meta.plural]);

  useEffect(() => {
    load();
  }, [load]);

  const term = search.trim().toLowerCase();
  const visible = rows
    .slice(0, PAGE_SIZE)
    .filter(
      (row) =>
        !term ||
        docRef(kind, row.id).toLowerCase().includes(term) ||
        (searchText?.(row).toLowerCase().includes(term) ?? false)
    );

  const allColumns: Column<T>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (row) => (
        <button
          onClick={() => navigate(`${meta.path}/${row.id}`)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontWeight: 700,
            fontFamily: 'monospace',
            color: 'var(--color-primary)',
          }}
        >
          {docRef(kind, row.id)}
        </button>
      ),
    },
    ...columns,
    { key: 'created_at', header: 'Created', render: (row) => formatDateTime(row.created_at) },
    { key: 'status', header: 'Status', render: (row) => <OperationStatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'inline-flex', gap: '6px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(`${meta.path}/${row.id}`)}
            title="View details"
          >
            <Eye size={14} /> View
          </button>
          {editable && !isTerminal(row.status) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate(`${meta.path}/${row.id}/edit`)}
              title="Edit"
            >
              <Edit3 size={14} /> Edit
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">{meta.plural}</h2>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate(`${meta.path}/new`)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} /> New {meta.label}
        </button>
      </div>

      <div
        className="card"
        style={{
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Search ${meta.plural.toLowerCase()} on this page...`}
        />
        <FilterDropdown
          label="Status"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setOffset(0);
          }}
          allLabel="All Statuses"
          options={STATUS_OPTIONS}
        />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <DataTable
          columns={allColumns}
          data={visible}
          keyExtractor={(row) => row.id}
          loading={loading}
          emptyTitle={`No ${meta.plural.toLowerCase()} found`}
          emptyDescription={
            status || term
              ? 'No records match the current filters.'
              : `Create a ${meta.label.toLowerCase()} to get started.`
          }
          emptyActionLabel={status || term ? undefined : `New ${meta.label}`}
          onEmptyAction={status || term ? undefined : () => navigate(`${meta.path}/new`)}
          pagination={{
            offset,
            limit: PAGE_SIZE,
            hasMore: rows.length > PAGE_SIZE,
            onPageChange: setOffset,
          }}
        />
      )}
    </div>
  );
}
