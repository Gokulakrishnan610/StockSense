import type { LedgerEntry, MovementType } from '../../types';
import { DOC_KINDS, docRef, type DocKind } from './operationUtils';

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  INITIAL: 'Opening Stock',
  RECEIPT: 'Receipt',
  DELIVERY: 'Delivery',
  TRANSFER: 'Internal Transfer',
  ADJUSTMENT: 'Adjustment',
};

export const MOVEMENT_OPTIONS = (Object.keys(MOVEMENT_LABELS) as MovementType[]).map((value) => ({
  value,
  label: MOVEMENT_LABELS[value],
}));

const MOVEMENT_KIND: Partial<Record<MovementType, DocKind>> = {
  RECEIPT: 'receipt',
  DELIVERY: 'delivery',
  TRANSFER: 'transfer',
  ADJUSTMENT: 'adjustment',
};

/** One side of a movement: a real location, or an outside party such as a vendor. */
export type MovementEnd = { locationId: string } | { external: string };

export interface MovementRow {
  key: string;
  createdAt: string;
  productId: string;
  type: MovementType;
  referenceId: string;
  reference: string;
  referencePath?: string;
  from: MovementEnd;
  to: MovementEnd;
  /** Signed stock change; transfers show the moved amount (global stock is unchanged). */
  quantity: number;
  isTransfer: boolean;
  /** True when both transfer legs were merged, so the quantity is unsigned. */
  paired: boolean;
  userName: string;
}

const referenceOf = (entry: LedgerEntry) => {
  const kind = MOVEMENT_KIND[entry.transaction_type];
  if (!kind) return { reference: 'OPENING' };
  return {
    reference: docRef(kind, entry.reference_id),
    referencePath: `${DOC_KINDS[kind].path}/${entry.reference_id}`,
  };
};

const endsOf = (entry: LedgerEntry): { from: MovementEnd; to: MovementEnd } => {
  const at = { locationId: entry.location_id };
  const qty = Number(entry.quantity);
  switch (entry.transaction_type) {
    case 'RECEIPT':
      return { from: { external: 'Vendor' }, to: at };
    case 'DELIVERY':
      return { from: at, to: { external: 'Customer' } };
    case 'INITIAL':
      return { from: { external: 'Opening balance' }, to: at };
    case 'ADJUSTMENT':
      return qty < 0
        ? { from: at, to: { external: 'Inventory loss' } }
        : { from: { external: 'Inventory gain' }, to: at };
    case 'TRANSFER':
      return {
        from: entry.from_location_id ? { locationId: entry.from_location_id } : at,
        to: entry.to_location_id ? { locationId: entry.to_location_id } : at,
      };
  }
};

/**
 * Converts location-level ledger entries into user-facing movements. A transfer
 * is stored as a negative source leg and a positive destination leg; when both
 * legs are present they are shown as one movement of the transferred amount.
 */
export function toMovementRows(entries: LedgerEntry[]): MovementRow[] {
  const rows: MovementRow[] = [];
  const pendingLegs = new Map<string, MovementRow>();

  for (const entry of entries) {
    const qty = Number(entry.quantity);
    const row: MovementRow = {
      key: entry.id,
      createdAt: entry.created_at,
      productId: entry.product_id,
      type: entry.transaction_type,
      referenceId: entry.reference_id,
      ...referenceOf(entry),
      ...endsOf(entry),
      quantity: qty,
      isTransfer: entry.transaction_type === 'TRANSFER',
      paired: false,
      userName: entry.user_name,
    };

    if (row.isTransfer) {
      const pairKey = [
        entry.reference_id,
        entry.product_id,
        entry.from_location_id,
        entry.to_location_id,
        Math.abs(qty),
      ].join('|');
      const partner = pendingLegs.get(pairKey);
      if (partner && Math.sign(partner.quantity) !== Math.sign(qty)) {
        partner.quantity = Math.abs(qty);
        partner.paired = true;
        pendingLegs.delete(pairKey);
        continue;
      }
      pendingLegs.set(pairKey, row);
    }
    rows.push(row);
  }
  return rows;
}
