import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/api';
import type {
  Category,
  Location,
  OperationStatusCode,
  Product,
  ProductStock,
  Warehouse,
} from '../../types';

export type DocKind = 'receipt' | 'delivery' | 'transfer' | 'adjustment';

export const DOC_KINDS: Record<
  DocKind,
  { label: string; plural: string; path: string; prefix: string }
> = {
  receipt: { label: 'Receipt', plural: 'Receipts', path: '/operations/receipts', prefix: 'REC' },
  delivery: {
    label: 'Delivery Order',
    plural: 'Delivery Orders',
    path: '/operations/deliveries',
    prefix: 'DEL',
  },
  transfer: {
    label: 'Internal Transfer',
    plural: 'Internal Transfers',
    path: '/operations/transfers',
    prefix: 'TRF',
  },
  adjustment: {
    label: 'Inventory Adjustment',
    plural: 'Inventory Adjustments',
    path: '/operations/adjustments',
    prefix: 'ADJ',
  },
};

export const STATUS_LABELS: Record<OperationStatusCode, string> = {
  DRAFT: 'Draft',
  WAITING: 'Waiting',
  READY: 'Ready',
  DONE: 'Done',
  CANCELED: 'Canceled',
};

export const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as OperationStatusCode[]).map(
  (value) => ({ value, label: STATUS_LABELS[value] })
);

export const isTerminal = (status: OperationStatusCode) =>
  status === 'DONE' || status === 'CANCELED';

/** Human-readable document reference derived from the backend UUID. */
export const docRef = (kind: DocKind, id: string) =>
  `${DOC_KINDS[kind].prefix}-${id.slice(0, 8).toUpperCase()}`;

export const formatQty = (value: string | number | null | undefined, unit?: string) => {
  const num = Number(value ?? 0);
  const text = num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return unit ? `${text} ${unit}` : text;
};

export const formatSignedQty = (value: string | number, unit?: string) => {
  const num = Number(value);
  return `${num > 0 ? '+' : ''}${formatQty(num, unit)}`;
};

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Matches the backend quantity rule: positive, at most 4 decimal places. */
export const QUANTITY_PATTERN = /^\d{1,14}(\.\d{1,4})?$/;

export const quantityError = (value: string, allowZero = false): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return 'Quantity is required';
  if (!QUANTITY_PATTERN.test(trimmed)) return 'Use a number with up to 4 decimal places';
  if (!allowZero && Number(trimmed) <= 0) return 'Quantity must be greater than zero';
  return null;
};

export const errorMessage = (err: unknown, fallback = 'Something went wrong') => {
  const e = err as { message?: string; errors?: Array<{ field: string; message: string }> };
  if (e?.errors?.length) {
    return e.errors.map((item) => `${item.field.replace(/^body\./, '')}: ${item.message}`).join('; ');
  }
  return e?.message || fallback;
};

export async function fetchAllPages<T>(fetchPage: (offset: number, limit: number) => Promise<T[]>) {
  const limit = 100;
  const rows: T[] = [];
  for (let offset = 0; ; offset += limit) {
    const page = await fetchPage(offset, limit);
    rows.push(...page);
    if (page.length < limit) return rows;
  }
}

export interface Catalog {
  products: Product[];
  locations: Location[];
  warehouses: Warehouse[];
  categories: Category[];
  productById: Map<string, Product>;
  locationById: Map<string, Location>;
  warehouseById: Map<string, Warehouse>;
  productLabel: (id: string) => string;
  locationLabel: (id: string | null | undefined) => string;
  unitOf: (productId: string) => string;
}

/** Loads the catalog reference data used to label operation lines and ledger rows. */
export function useCatalog() {
  const [data, setData] = useState<{
    products: Product[];
    locations: Location[];
    warehouses: Warehouse[];
    categories: Category[];
  }>({ products: [], locations: [], warehouses: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [products, locations, warehouses, categories] = await Promise.all([
        fetchAllPages((offset, limit) => api.getProducts({ offset, limit })),
        fetchAllPages((offset, limit) => api.getLocations(undefined, offset, limit)),
        fetchAllPages((offset, limit) => api.getWarehouses(offset, limit)),
        fetchAllPages((offset, limit) => api.getCategories(offset, limit)),
      ]);
      setData({ products, locations, warehouses, categories });
    } catch (err) {
      setError(errorMessage(err, 'Failed to load products and locations'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const catalog = useMemo<Catalog>(() => {
    const productById = new Map(data.products.map((p) => [p.id, p]));
    const locationById = new Map(data.locations.map((l) => [l.id, l]));
    const warehouseById = new Map(data.warehouses.map((w) => [w.id, w]));
    return {
      ...data,
      productById,
      locationById,
      warehouseById,
      productLabel: (id) => {
        const product = productById.get(id);
        return product ? `${product.name} (${product.sku})` : id.slice(0, 8);
      },
      locationLabel: (id) => {
        if (!id) return '—';
        const location = locationById.get(id);
        if (!location) return id.slice(0, 8);
        const warehouse = warehouseById.get(location.warehouse_id);
        return warehouse ? `${warehouse.name} / ${location.name}` : location.name;
      },
      unitOf: (productId) => productById.get(productId)?.unit_of_measure ?? '',
    };
  }, [data]);

  return { catalog, loading, error, reload: load };
}

/**
 * Caches per-product location balances from the backend so forms can show the
 * available quantity. Display only — the backend re-checks stock on validation.
 */
export function useStockLookup() {
  const [stock, setStock] = useState<Record<string, ProductStock[]>>({});
  const requested = useRef(new Set<string>());

  const ensure = useCallback((productId: string, force = false) => {
    if (!productId || (!force && requested.current.has(productId))) return;
    requested.current.add(productId);
    api
      .getProductStock(productId)
      .then((rows) => setStock((prev) => ({ ...prev, [productId]: rows })))
      .catch(() => setStock((prev) => ({ ...prev, [productId]: [] })));
  }, []);

  const available = useCallback(
    (productId: string, locationId: string): number | undefined => {
      const rows = stock[productId];
      if (!rows || !locationId) return undefined;
      const row = rows.find((r) => r.location_id === locationId);
      return row ? Number(row.quantity) : 0;
    },
    [stock]
  );

  return { ensure, available };
}
