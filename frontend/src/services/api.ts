import type {
  Adjustment,
  AdjustmentInput,
  AuthToken,
  Delivery,
  DeliveryItem,
  LedgerEntry,
  LedgerFilter,
  LocationItemInput,
  LowStockAlert,
  OperationSummary,
  OperationStatusCode,
  Receipt,
  ReceiptItem,
  Transfer,
  TransferItem,
  TransferItemInput,
  Category,
  CategoryInput,
  Location,
  LocationInput,
  Product,
  ProductCreateInput,
  ProductInput,
  ProductStock,
  ReorderRule,
  ReorderRuleInput,
  Warehouse,
  WarehouseInput,
  UserProfile,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem('stocksense_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json().catch(() => ({}));

    // An expired or revoked session: return to the login page instead of
    // leaving every screen showing authentication errors.
    if (response.status === 401 && token && !endpoint.startsWith('/auth/')) {
      localStorage.removeItem('stocksense_token');
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }

    if (!response.ok) {
      const error = new Error(data.message || 'API request failed') as Error & {
        status?: number;
        code?: string;
        errors?: Array<{ field: string; message: string }>;
      };
      error.status = response.status;
      error.code = data.code || 'UNKNOWN_ERROR';
      error.errors = data.errors;
      throw error;
    }

    return data as T;
  }

  // Auth endpoints
  async signup(payload: {
    login_id: string;
    email: string;
    name: string;
    password: string;
  }): Promise<UserProfile> {
    return this.request<UserProfile>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async login(payload: { login_id: string; password: string }): Promise<AuthToken> {
    return this.request<AuthToken>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyOtp(
    email: string,
    otp: string
  ): Promise<{ reset_token: string; expires_in: number }> {
    return this.request<{ reset_token: string; expires_in: number }>(
      '/auth/verify-otp',
      {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      }
    );
  }

  async resetPassword(
    reset_token: string,
    new_password: string
  ): Promise<void> {
    return this.request<void>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ reset_token, new_password }),
    });
  }

  async logout(): Promise<void> {
    return this.request<void>('/auth/logout', {
      method: 'POST',
    });
  }

  async getMe(): Promise<UserProfile> {
    return this.request<UserProfile>('/auth/me', {
      method: 'GET',
    });
  }

  // Categories
  async getCategories(offset = 0, limit = 100): Promise<Category[]> {
    return this.request<Category[]>(`/categories?offset=${offset}&limit=${limit}`);
  }

  async getCategory(id: string): Promise<Category> {
    return this.request<Category>(`/categories/${id}`);
  }

  async createCategory(data: CategoryInput): Promise<Category> {
    return this.request<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: CategoryInput): Promise<Category> {
    return this.request<Category>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string): Promise<void> {
    return this.request<void>(`/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // Warehouses
  async getWarehouses(offset = 0, limit = 100): Promise<Warehouse[]> {
    return this.request<Warehouse[]>(`/warehouses?offset=${offset}&limit=${limit}`);
  }

  async getWarehouse(id: string): Promise<Warehouse> {
    return this.request<Warehouse>(`/warehouses/${id}`);
  }

  async createWarehouse(data: WarehouseInput): Promise<Warehouse> {
    return this.request<Warehouse>('/warehouses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWarehouse(id: string, data: WarehouseInput): Promise<Warehouse> {
    return this.request<Warehouse>(`/warehouses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Locations
  async getLocations(
    warehouseId?: string,
    offset = 0,
    limit = 100
  ): Promise<Location[]> {
    const params = new URLSearchParams({
      offset: offset.toString(),
      limit: limit.toString(),
    });
    if (warehouseId) params.append('warehouse_id', warehouseId);

    return this.request<Location[]>(`/locations?${params.toString()}`);
  }

  async getLocation(id: string): Promise<Location> {
    return this.request<Location>(`/locations/${id}`);
  }

  async createLocation(data: LocationInput): Promise<Location> {
    return this.request<Location>('/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLocation(id: string, data: LocationInput): Promise<Location> {
    return this.request<Location>(`/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Products
  async getProducts(params?: {
    search?: string;
    category_id?: string;
    warehouse_id?: string;
    location_id?: string;
    offset?: number;
    limit?: number;
  }): Promise<Product[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.category_id) query.append('category_id', params.category_id);
    if (params?.warehouse_id) query.append('warehouse_id', params.warehouse_id);
    if (params?.location_id) query.append('location_id', params.location_id);
    query.append('offset', (params?.offset ?? 0).toString());
    query.append('limit', (params?.limit ?? 100).toString());

    return this.request<Product[]>(`/products?${query.toString()}`);
  }

  async getProduct(id: string): Promise<Product> {
    return this.request<Product>(`/products/${id}`);
  }

  async createProduct(data: ProductCreateInput): Promise<Product> {
    return this.request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: ProductInput): Promise<Product> {
    return this.request<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getProductStock(
    productId: string,
    warehouseId?: string,
    locationId?: string
  ): Promise<ProductStock[]> {
    const query = new URLSearchParams();
    if (warehouseId) query.append('warehouse_id', warehouseId);
    if (locationId) query.append('location_id', locationId);

    return this.request<ProductStock[]>(
      `/products/${productId}/stock?${query.toString()}`
    );
  }

  // Reorder Rules
  async getReorderRules(
    productId?: string,
    offset = 0,
    limit = 100
  ): Promise<ReorderRule[]> {
    const query = new URLSearchParams({
      offset: offset.toString(),
      limit: limit.toString(),
    });
    if (productId) query.append('product_id', productId);

    return this.request<ReorderRule[]>(`/reorder-rules?${query.toString()}`);
  }

  async createReorderRule(data: ReorderRuleInput): Promise<ReorderRule> {
    return this.request<ReorderRule>('/reorder-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateReorderRule(
    id: string,
    data: ReorderRuleInput
  ): Promise<ReorderRule> {
    return this.request<ReorderRule>(`/reorder-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ---------------------------------------------------------------------------
  // Operations (Member 2). Stock is changed only by the backend validate calls.
  // ---------------------------------------------------------------------------

  private listQuery(status?: OperationStatusCode, offset = 0, limit = 100): string {
    const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    if (status) query.append('status', status);
    return query.toString();
  }

  private post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private put<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) });
  }

  private remove(endpoint: string): Promise<void> {
    return this.request<void>(endpoint, { method: 'DELETE' });
  }

  // Receipts
  async getReceipts(status?: OperationStatusCode, offset = 0, limit = 100): Promise<Receipt[]> {
    return this.request<Receipt[]>(`/receipts?${this.listQuery(status, offset, limit)}`);
  }

  async getReceipt(id: string): Promise<Receipt> {
    return this.request<Receipt>(`/receipts/${id}`);
  }

  async createReceipt(data: { supplier: string; notes: string }): Promise<Receipt> {
    return this.post<Receipt>('/receipts', data);
  }

  async updateReceipt(id: string, data: { supplier: string; notes: string }): Promise<Receipt> {
    return this.put<Receipt>(`/receipts/${id}`, data);
  }

  async getReceiptItems(id: string): Promise<ReceiptItem[]> {
    return this.request<ReceiptItem[]>(`/receipts/${id}/items`);
  }

  async addReceiptItem(id: string, data: LocationItemInput): Promise<ReceiptItem> {
    return this.post<ReceiptItem>(`/receipts/${id}/items`, data);
  }

  async removeReceiptItem(id: string, itemId: string): Promise<void> {
    return this.remove(`/receipts/${id}/items/${itemId}`);
  }

  async setReceiptStatus(id: string, status: OperationStatusCode): Promise<Receipt> {
    return this.post<Receipt>(`/receipts/${id}/status`, { status });
  }

  async validateReceipt(id: string): Promise<Receipt> {
    return this.post<Receipt>(`/receipts/${id}/validate`);
  }

  // Delivery orders
  async getDeliveries(status?: OperationStatusCode, offset = 0, limit = 100): Promise<Delivery[]> {
    return this.request<Delivery[]>(`/deliveries?${this.listQuery(status, offset, limit)}`);
  }

  async getDelivery(id: string): Promise<Delivery> {
    return this.request<Delivery>(`/deliveries/${id}`);
  }

  async createDelivery(data: { notes: string }): Promise<Delivery> {
    return this.post<Delivery>('/deliveries', data);
  }

  async updateDelivery(id: string, data: { notes: string }): Promise<Delivery> {
    return this.put<Delivery>(`/deliveries/${id}`, data);
  }

  async getDeliveryItems(id: string): Promise<DeliveryItem[]> {
    return this.request<DeliveryItem[]>(`/deliveries/${id}/items`);
  }

  async addDeliveryItem(id: string, data: LocationItemInput): Promise<DeliveryItem> {
    return this.post<DeliveryItem>(`/deliveries/${id}/items`, data);
  }

  async removeDeliveryItem(id: string, itemId: string): Promise<void> {
    return this.remove(`/deliveries/${id}/items/${itemId}`);
  }

  async pickDelivery(id: string): Promise<Delivery> {
    return this.post<Delivery>(`/deliveries/${id}/pick`);
  }

  async packDelivery(id: string): Promise<Delivery> {
    return this.post<Delivery>(`/deliveries/${id}/pack`);
  }

  async cancelDelivery(id: string): Promise<Delivery> {
    return this.post<Delivery>(`/deliveries/${id}/cancel`);
  }

  async validateDelivery(id: string): Promise<Delivery> {
    return this.post<Delivery>(`/deliveries/${id}/validate`);
  }

  // Internal transfers
  async getTransfers(status?: OperationStatusCode, offset = 0, limit = 100): Promise<Transfer[]> {
    return this.request<Transfer[]>(`/transfers?${this.listQuery(status, offset, limit)}`);
  }

  async getTransfer(id: string): Promise<Transfer> {
    return this.request<Transfer>(`/transfers/${id}`);
  }

  async createTransfer(data: { notes: string }): Promise<Transfer> {
    return this.post<Transfer>('/transfers', data);
  }

  async updateTransfer(id: string, data: { notes: string }): Promise<Transfer> {
    return this.put<Transfer>(`/transfers/${id}`, data);
  }

  async getTransferItems(id: string): Promise<TransferItem[]> {
    return this.request<TransferItem[]>(`/transfers/${id}/items`);
  }

  async addTransferItem(id: string, data: TransferItemInput): Promise<TransferItem> {
    return this.post<TransferItem>(`/transfers/${id}/items`, data);
  }

  async removeTransferItem(id: string, itemId: string): Promise<void> {
    return this.remove(`/transfers/${id}/items/${itemId}`);
  }

  async setTransferStatus(id: string, status: OperationStatusCode): Promise<Transfer> {
    return this.post<Transfer>(`/transfers/${id}/status`, { status });
  }

  async validateTransfer(id: string): Promise<Transfer> {
    return this.post<Transfer>(`/transfers/${id}/validate`);
  }

  // Inventory adjustments
  async getAdjustments(
    status?: OperationStatusCode,
    offset = 0,
    limit = 100
  ): Promise<Adjustment[]> {
    return this.request<Adjustment[]>(`/adjustments?${this.listQuery(status, offset, limit)}`);
  }

  async getAdjustment(id: string): Promise<Adjustment> {
    return this.request<Adjustment>(`/adjustments/${id}`);
  }

  async createAdjustment(data: AdjustmentInput): Promise<Adjustment> {
    return this.post<Adjustment>('/adjustments', data);
  }

  async cancelAdjustment(id: string): Promise<Adjustment> {
    return this.post<Adjustment>(`/adjustments/${id}/cancel`);
  }

  async validateAdjustment(id: string): Promise<Adjustment> {
    return this.post<Adjustment>(`/adjustments/${id}/validate`);
  }

  // Stock ledger / move history
  async getLedger(filter: LedgerFilter = {}): Promise<LedgerEntry[]> {
    const query = new URLSearchParams();
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.append(key, String(value));
    });
    return this.request<LedgerEntry[]>(`/inventory/ledger?${query.toString()}`);
  }

  // Inventory overview
  async getOperationSummary(): Promise<OperationSummary> {
    return this.request<OperationSummary>('/operations/summary');
  }

  async getInventoryStock(
    params: { warehouse_id?: string; location_id?: string; offset?: number; limit?: number } = {}
  ): Promise<ProductStock[]> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.append(key, String(value));
    });
    return this.request<ProductStock[]>(`/inventory/stock?${query.toString()}`);
  }

  async getLowStockAlerts(offset = 0, limit = 100): Promise<LowStockAlert[]> {
    return this.request<LowStockAlert[]>(
      `/inventory/alerts/low-stock?offset=${offset}&limit=${limit}`
    );
  }
}

export const api = new ApiService();
