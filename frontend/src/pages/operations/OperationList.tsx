import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Edit3, Eye, Plus } from '../../components/ui/icons';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ErrorState } from '../../components/ui/ErrorState';
import { FilterDropdown } from '../../components/ui/FilterDropdown';
import { SearchInput } from '../../components/ui/SearchInput';
import { useToast } from '../../context/ToastContext';
import { notifyOperationsChanged } from '../../layouts/useNavCounts';
import type { OperationStatusCode } from '../../types';
import { OperationStatusBadge } from './OperationComponents';
import {
  DOC_KINDS,
  STATUS_OPTIONS,
  docRef,
  errorMessage,
  formatDateTime,
  isTerminal,
  useCatalog,
  type Catalog,
  type DocKind,
} from './operationUtils';
import type { LineItem } from './operationWorkflow';
import './operations.css';

const PAGE_SIZE = 20;

interface OperationRecord {
  id: string;
  status: OperationStatusCode;
  created_at: string;
}

export interface ListContext {
  catalog: Catalog;
  /** Lines of a row, once loaded (receipts, deliveries and transfers). */
  linesOf: (id: string) => LineItem[] | undefined;
}

interface OperationListProps<T extends OperationRecord> {
  kind: DocKind;
  subtitle: string;
  fetchPage: (status: OperationStatusCode | undefined, offset: number, limit: number) => Promise<T[]>;
  columns: (ctx: ListContext) => Column<T>[];
  /** Loads the lines of each listed document, for route, warehouse and quantity columns. */
  loadLines?: (id: string) => Promise<LineItem[]>;
  /** Locations a row touches, for the warehouse filter. */
  locationIdsOf: (row: T, ctx: ListContext) => string[];
  /** Extra text matched by the search box in addition to the reference. */
  searchText?: (row: T, ctx: ListContext) => string;
  /** Status from which the row can be validated directly from the list. */
  validateFrom?: OperationStatusCode;
  validate?: (id: string) => Promise<unknown>;
  editable?: boolean;
}

export function OperationList<T extends OperationRecord>({
  kind,
  subtitle,
  fetchPage,
  columns,
  loadLines,
  locationIdsOf,
  searchText,
  validateFrom,
  validate,
  editable = true,
}: OperationListProps<T>) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { catalog } = useCatalog();
  const meta = DOC_KINDS[kind];
  const [rows, setRows] = useState<T[]>([]);
  const [lines, setLines] = useState<Record<string, LineItem[]>>({});
  const [status, setStatus] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<T | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Ask for one extra row to know whether a next page exists.
      const page = await fetchPage((status || undefined) as OperationStatusCode | undefined, offset, PAGE_SIZE + 1);
      setRows(page);
      if (loadLines) {
        const shown = page.slice(0, PAGE_SIZE);
        const loaded = await Promise.all(shown.map((row) => loadLines(row.id).catch(() => [])));
        setLines(Object.fromEntries(shown.map((row, i) => [row.id, loaded[i]])));
      }
    } catch (err) {
      setError(errorMessage(err, `Failed to load ${meta.plural.toLowerCase()}`));
    } finally {
      setLoading(false);
    }
  }, [fetchPage, loadLines, status, offset, meta.plural]);

  useEffect(() => {
    load();
  }, [load]);

  const ctx: ListContext = { catalog, linesOf: (id) => lines[id] };
  const term = search.trim().toLowerCase();
  const pageRows = rows.slice(0, PAGE_SIZE);
  const visible = pageRows
    .filter(
      (row) =>
        !warehouseId ||
        locationIdsOf(row, ctx).some((locId) => catalog.locationById.get(locId)?.warehouse_id === warehouseId)
    )
    .filter(
      (row) =>
        !term ||
        docRef(kind, row.id).toLowerCase().includes(term) ||
        (searchText?.(row, ctx).toLowerCase().includes(term) ?? false)
    );

  const runValidate = async () => {
    if (!confirming || !validate) return;
    const reference = docRef(kind, confirming.id);
    setRunning(true);
    try {
      await validate(confirming.id);
      showToast('success', `${reference} validated`, 'Stock has been updated.');
      notifyOperationsChanged();
      await load();
    } catch (err) {
      showToast('error', `${reference} not validated`, errorMessage(err));
    } finally {
      setRunning(false);
      setConfirming(null);
    }
  };

  const allColumns: Column<T>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (row) => (
        <button
          className="ref-link"
          style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
          onClick={() => navigate(`${meta.path}/${row.id}`)}
        >
          {docRef(kind, row.id)}
        </button>
      ),
    },
    ...columns(ctx),
    { key: 'status', header: 'Status', render: (row) => <OperationStatusBadge status={row.status} /> },
    {
      key: 'created_at',
      header: 'Created',
      render: (row) => (
        <span className="cell-sub" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => {
        const canValidate =
          validate && validateFrom === row.status && (!loadLines || (lines[row.id]?.length ?? 0) > 0);
        return (
          <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`${meta.path}/${row.id}`)} title="View details">
              <Eye size={14} /> View
            </button>
            {editable && !isTerminal(row.status) && (
              <button className="btn btn-secondary btn-sm" onClick={() => navigate(`${meta.path}/${row.id}/edit`)} title="Edit">
                <Edit3 size={14} /> Edit
              </button>
            )}
            {canValidate && (
              <button className="btn btn-primary btn-sm" onClick={() => setConfirming(row)}>
                <CheckCircle2 size={14} /> Validate
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const filtersActive = Boolean(status || warehouseId || term);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">{meta.plural}</h2>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate(`${meta.path}/new`)}>
          <Plus size={16} /> New {meta.label}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Search reference, ${kind === 'receipt' ? 'supplier, ' : ''}product...`}
        />
        <FilterDropdown
          value={status}
          onChange={(value) => {
            setStatus(value);
            setOffset(0);
          }}
          allLabel="Status: All"
          options={STATUS_OPTIONS.map((o) => ({ ...o, label: `Status: ${o.label}` }))}
        />
        <FilterDropdown
          value={warehouseId}
          onChange={setWarehouseId}
          allLabel="Warehouse: All"
          options={catalog.warehouses.map((w) => ({ value: w.id, label: `${w.short_code} — ${w.name}` }))}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {filtersActive && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setStatus('');
                setWarehouseId('');
                setSearch('');
                setOffset(0);
              }}
            >
              Clear
            </button>
          )}
          <span className="mono cell-sub">
            {visible.length} of {pageRows.length} on this page
          </span>
        </div>
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
            filtersActive ? 'No records match the current filters.' : `Create a ${meta.label.toLowerCase()} to get started.`
          }
          emptyActionLabel={filtersActive ? undefined : `New ${meta.label}`}
          onEmptyAction={filtersActive ? undefined : () => navigate(`${meta.path}/new`)}
          pagination={{ offset, limit: PAGE_SIZE, hasMore: rows.length > PAGE_SIZE, onPageChange: setOffset }}
        />
      )}

      <ConfirmationDialog
        isOpen={confirming !== null}
        onClose={() => !running && setConfirming(null)}
        onConfirm={runValidate}
        loading={running}
        title={confirming ? `Validate ${docRef(kind, confirming.id)}?` : ''}
        message="Stock balances and the stock ledger are updated immediately. This cannot be undone."
        confirmLabel="Validate"
        cancelLabel="Back"
      />
    </div>
  );
}
