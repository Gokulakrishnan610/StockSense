import type {
  AuthToken,
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
}

export const api = new ApiService();
