import { api } from '../../services/api';
import type { OperationStatusCode } from '../../types';

export type LineDocKind = 'receipt' | 'delivery' | 'transfer';

export interface LineDocument {
  id: string;
  status: OperationStatusCode;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  supplier?: string;
}

export interface LineItem {
  id: string;
  product_id: string;
  location_id: string;
  destination_location_id?: string;
  quantity: string;
}

export interface LineInput {
  product_id: string;
  location_id: string;
  destination_location_id: string;
  quantity: string;
}

interface LineDocApi {
  get: (id: string) => Promise<LineDocument>;
  items: (id: string) => Promise<LineItem[]>;
  create: (header: { supplier: string; notes: string }) => Promise<LineDocument>;
  update: (id: string, header: { supplier: string; notes: string }) => Promise<LineDocument>;
  addItem: (id: string, line: LineInput) => Promise<unknown>;
  removeItem: (id: string, itemId: string) => Promise<void>;
  validate: (id: string) => Promise<LineDocument>;
  cancel: (id: string) => Promise<LineDocument>;
}

/**
 * Uniform adapter over the receipt, delivery and transfer endpoints. Transfer
 * lines expose their source as `location_id` so forms can share one line model.
 */
export const lineApi: Record<LineDocKind, LineDocApi> = {
  receipt: {
    get: (id) => api.getReceipt(id),
    items: (id) => api.getReceiptItems(id),
    create: (h) => api.createReceipt(h),
    update: (id, h) => api.updateReceipt(id, h),
    addItem: (id, l) =>
      api.addReceiptItem(id, {
        product_id: l.product_id,
        location_id: l.location_id,
        quantity: l.quantity,
      }),
    removeItem: (id, itemId) => api.removeReceiptItem(id, itemId),
    validate: (id) => api.validateReceipt(id),
    cancel: (id) => api.setReceiptStatus(id, 'CANCELED'),
  },
  delivery: {
    get: (id) => api.getDelivery(id),
    items: (id) => api.getDeliveryItems(id),
    create: (h) => api.createDelivery({ notes: h.notes }),
    update: (id, h) => api.updateDelivery(id, { notes: h.notes }),
    addItem: (id, l) =>
      api.addDeliveryItem(id, {
        product_id: l.product_id,
        location_id: l.location_id,
        quantity: l.quantity,
      }),
    removeItem: (id, itemId) => api.removeDeliveryItem(id, itemId),
    validate: (id) => api.validateDelivery(id),
    cancel: (id) => api.cancelDelivery(id),
  },
  transfer: {
    get: (id) => api.getTransfer(id),
    items: async (id) =>
      (await api.getTransferItems(id)).map((item) => ({
        id: item.id,
        product_id: item.product_id,
        location_id: item.source_location_id,
        destination_location_id: item.destination_location_id,
        quantity: item.quantity,
      })),
    create: (h) => api.createTransfer({ notes: h.notes }),
    update: (id, h) => api.updateTransfer(id, { notes: h.notes }),
    addItem: (id, l) =>
      api.addTransferItem(id, {
        product_id: l.product_id,
        source_location_id: l.location_id,
        destination_location_id: l.destination_location_id,
        quantity: l.quantity,
      }),
    removeItem: (id, itemId) => api.removeTransferItem(id, itemId),
    validate: (id) => api.validateTransfer(id),
    cancel: (id) => api.setTransferStatus(id, 'CANCELED'),
  },
};

export interface WorkflowStep {
  /** Status the document is in when this action is offered. */
  from: OperationStatusCode;
  label: string;
  run: (id: string) => Promise<LineDocument>;
}

/** Status-advancing actions offered before validation; the backend enforces order. */
export const workflowSteps: Record<LineDocKind, WorkflowStep[]> = {
  receipt: [
    { from: 'DRAFT', label: 'Mark as Waiting', run: (id) => api.setReceiptStatus(id, 'WAITING') },
    { from: 'WAITING', label: 'Mark as Ready', run: (id) => api.setReceiptStatus(id, 'READY') },
  ],
  delivery: [
    { from: 'DRAFT', label: 'Pick', run: (id) => api.pickDelivery(id) },
    { from: 'WAITING', label: 'Pack', run: (id) => api.packDelivery(id) },
  ],
  transfer: [
    { from: 'DRAFT', label: 'Mark as Waiting', run: (id) => api.setTransferStatus(id, 'WAITING') },
    { from: 'WAITING', label: 'Mark as Ready', run: (id) => api.setTransferStatus(id, 'READY') },
  ],
};

export const stepLabels: Record<LineDocKind, Array<{ status: OperationStatusCode; label: string }>> = {
  receipt: [
    { status: 'DRAFT', label: 'Draft' },
    { status: 'WAITING', label: 'Waiting' },
    { status: 'READY', label: 'Ready' },
    { status: 'DONE', label: 'Done' },
  ],
  delivery: [
    { status: 'DRAFT', label: 'Draft' },
    { status: 'WAITING', label: 'Picked (Waiting)' },
    { status: 'READY', label: 'Packed (Ready)' },
    { status: 'DONE', label: 'Done' },
  ],
  transfer: [
    { status: 'DRAFT', label: 'Draft' },
    { status: 'WAITING', label: 'Waiting' },
    { status: 'READY', label: 'Ready' },
    { status: 'DONE', label: 'Done' },
  ],
};

/** Runs the remaining workflow steps (e.g. Pick then Pack) until the document is Ready. */
export async function advanceToReady(kind: LineDocKind, id: string) {
  let doc = await lineApi[kind].get(id);
  for (const step of workflowSteps[kind]) {
    if (doc.status === step.from) doc = await step.run(id);
  }
  return doc;
}
