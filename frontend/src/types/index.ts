export type UserRole = 'INVENTORY_MANAGER' | 'WAREHOUSE_STAFF';

export interface UserProfile {
  id: string;
  login_id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  redirect_to: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface CategoryInput {
  name: string;
}

export interface Warehouse {
  id: string;
  name: string;
  short_code: string;
  address: string;
}

export interface WarehouseInput {
  name: string;
  short_code: string;
  address?: string;
}

export interface Location {
  id: string;
  name: string;
  short_code: string;
  warehouse_id: string;
}

export interface LocationInput {
  name: string;
  short_code: string;
  warehouse_id: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category_id: string;
  unit_of_measure: string;
  initial_stock: string;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  name: string;
  sku: string;
  category_id: string;
  unit_of_measure: string;
}

export interface ProductCreateInput extends ProductInput {
  initial_stock?: string;
  initial_location_id?: string;
}

export interface ProductStock {
  product_id: string;
  location_id: string;
  warehouse_id: string;
  quantity: string;
}

export interface ReorderRule {
  id: string;
  product_id: string;
  minimum_stock: string;
  reorder_quantity: string;
}

export interface ReorderRuleInput {
  product_id: string;
  minimum_stock: string;
  reorder_quantity: string;
}

export interface ApiError {
  code: string;
  message: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export type DocumentType = 'Receipts' | 'Delivery' | 'Internal' | 'Adjustments' | 'All';
export type OperationStatus = 'Draft' | 'Waiting' | 'Ready' | 'Done' | 'Canceled' | 'All';

export interface DashboardFilter {
  documentType: DocumentType;
  status: OperationStatus;
  warehouseId?: string;
  locationId?: string;
  categoryId?: string;
}

// ---------------------------------------------------------------------------
// Operations (Member 2 API) — statuses and movement types are backend values.
// ---------------------------------------------------------------------------

export type OperationStatusCode = 'DRAFT' | 'WAITING' | 'READY' | 'DONE' | 'CANCELED';
export type MovementType = 'INITIAL' | 'RECEIPT' | 'DELIVERY' | 'TRANSFER' | 'ADJUSTMENT';

interface OperationBase {
  id: string;
  notes: string;
  status: OperationStatusCode;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Receipt extends OperationBase {
  supplier: string;
}

export type Delivery = OperationBase;
export type Transfer = OperationBase;

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  product_id: string;
  location_id: string;
  quantity: string;
}

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  product_id: string;
  location_id: string;
  quantity: string;
}

export interface TransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  source_location_id: string;
  destination_location_id: string;
  quantity: string;
}

export interface LocationItemInput {
  product_id: string;
  location_id: string;
  quantity: string;
}

export interface TransferItemInput {
  product_id: string;
  source_location_id: string;
  destination_location_id: string;
  quantity: string;
}

export interface Adjustment {
  id: string;
  product_id: string;
  location_id: string;
  counted_quantity: string;
  recorded_quantity: string | null;
  delta: string | null;
  reason: string;
  status: OperationStatusCode;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AdjustmentInput {
  product_id: string;
  location_id: string;
  counted_quantity: string;
  reason: string;
}

export interface LedgerEntry {
  id: string;
  product_id: string;
  location_id: string;
  transaction_type: MovementType;
  reference_id: string;
  quantity: string;
  before_quantity: string;
  after_quantity: string;
  from_location_id: string | null;
  to_location_id: string | null;
  user_id: string;
  user_name: string;
  created_at: string;
}

export interface LedgerFilter {
  product_id?: string;
  location_id?: string;
  warehouse_id?: string;
  category_id?: string;
  transaction_type?: MovementType;
  reference_id?: string;
  date_from?: string;
  date_to?: string;
  offset?: number;
  limit?: number;
}
