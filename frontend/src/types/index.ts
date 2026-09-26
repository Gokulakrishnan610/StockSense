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
