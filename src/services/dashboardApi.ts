import { apiRequest } from './api';

export interface PaginatedResult<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

function normalizePaginated<T>(raw: PaginatedResult<T> | T[]): PaginatedResult<T> {
  if (Array.isArray(raw)) {
    return {
      data: raw,
      current_page: 1,
      last_page: 1,
      per_page: raw.length || 15,
      total: raw.length,
    };
  }
  return {
    data: Array.isArray(raw?.data) ? raw.data : [],
    current_page: Number(raw?.current_page ?? 1),
    last_page: Number(raw?.last_page ?? 1),
    per_page: Number(raw?.per_page ?? 15),
    total: Number(raw?.total ?? 0),
  };
}

// ==========================================
// Admin Types & API
// ==========================================

export interface AdminDashboardData {
  metrics: {
    total_gross_revenue: number;
    total_platform_commission: number;
    total_orders: number;
    total_stores: number;
    total_customers: number;
    total_products: number;
    pending_store_applications: number;
    pending_payments_count: number;
    successful_payments_volume: number;
  };
  top_stores: {
    id: number;
    name: string;
    slug: string;
    logo?: string | null;
    total_sales: number | string;
  }[];
  best_selling_products: {
    id: number;
    name: string;
    sku: string;
    store_id: number;
    units_sold: number | string;
    store?: { id: number; name: string } | null;
  }[];
}

export interface AdminStoreApplication {
  id: number;
  user_id: number;
  store_name: string;
  store_description?: string | null;
  store_address?: string | null;
  phone: string;
  email: string;
  business_registration_number?: string | null;
  tax_id?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  user?: { id: number; name: string; email: string; phone?: string | null } | null;
  reviewer?: { id: number; name: string } | null;
}

export interface AdminStoreItem {
  id: number;
  user_id: number;
  name: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  banner?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  is_verified: boolean;
  commission_rate?: number | null;
  products_count?: number;
  orders_count?: number;
  created_at: string;
  owner?: { id: number; name: string; email: string; phone?: string | null } | null;
  bakong_account?: {
    id: number;
    bakong_account_id: string;
    connection_status: string;
  } | null;
}

export interface AdminUserItem {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  status: 'active' | 'suspended' | 'deleted';
  email_verified_at?: string | null;
  created_at: string;
  roles: { id: number; name: string; slug: string }[];
  store?: { id: number; name: string; status: string } | null;
}

export interface AdminCategoryItem {
  id: number;
  name: string;
  slug: string;
  parent_id?: number | null;
  description?: string | null;
  image?: string | null;
  order?: number;
  is_active: boolean;
  commission_rate?: number | null;
  children?: AdminCategoryItem[];
}

export interface AdminBrandItem {
  id: number;
  name: string;
  slug: string;
  logo?: string | null;
  description?: string | null;
  website?: string | null;
  is_active: boolean;
  products_count?: number;
}

export interface AdminBakongOverview {
  environment: string;
  api_url: string;
  stores: {
    connected: number;
    disconnected_or_expired: number;
    not_configured: number;
  };
  transactions: {
    total_volume: number;
    successful_count: number;
    pending_count: number;
    failed_count: number;
  };
}

export interface AdminBakongAccount {
  id: number;
  store_id: number;
  bakong_account_id: string;
  registered_email: string;
  merchant_name: string;
  merchant_city?: string | null;
  connection_status: string;
  token_expires_at?: string | null;
  last_checked_at?: string | null;
  store?: { id: number; name: string; slug: string; email?: string | null } | null;
}

export interface BakongTxItem {
  id: number;
  store_id: number;
  bill_number: string;
  bakong_hash?: string | null;
  transaction_reference?: string | null;
  amount: number | string;
  currency: string;
  payment_status: string;
  verified_at?: string | null;
  created_at: string;
  store?: { id: number; name: string; slug: string } | null;
  child_order?: { id: number; order_number: string; customer_name?: string } | null;
}

export interface AdminDisputeItem {
  id: number;
  store_id?: number | null;
  user_id?: number | null;
  reason?: string | null;
  description?: string | null;
  status: string;
  admin_resolution?: string | null;
  resolved_at?: string | null;
  created_at: string;
  store?: { id: number; name: string } | null;
  user?: { id: number; name: string; email: string } | null;
  refund?: {
    id: number;
    amount?: number | string;
    status?: string;
    child_order?: { id: number; order_number: string } | null;
  } | null;
}

export interface PlatformSettingItem {
  id: number;
  group: string;
  key: string;
  value: string | null;
  type?: string;
  description?: string | null;
}

export interface AuditLogItem {
  id: number;
  action: string;
  entity_type?: string | null;
  entity_id?: number | null;
  store_id?: number | null;
  ip_address?: string | null;
  created_at: string;
  user?: { id: number; name: string; email: string } | null;
  store?: { id: number; name: string } | null;
}

export const adminApi = {
  async getDashboard() {
    const res = await apiRequest<AdminDashboardData>('/admin/dashboard');
    return res.data;
  },

  async getStoreApplications(params?: { status?: string; page?: number; per_page?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<PaginatedResult<AdminStoreApplication> | AdminStoreApplication[]>(
      `/admin/store-applications${q}`,
    );
    return normalizePaginated(res.data);
  },

  async approveApplication(id: number) {
    return apiRequest<AdminStoreApplication>(`/admin/store-applications/${id}/approve`, {
      method: 'POST',
    });
  },

  async rejectApplication(id: number, rejection_reason: string) {
    return apiRequest<AdminStoreApplication>(`/admin/store-applications/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejection_reason }),
    });
  },

  async getStores(params?: { status?: string; search?: string; page?: number; per_page?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<PaginatedResult<AdminStoreItem> | AdminStoreItem[]>(
      `/admin/stores${q}`,
    );
    return normalizePaginated(res.data);
  },

  async toggleStoreSuspension(id: number, status: 'approved' | 'suspended', reason?: string) {
    return apiRequest<AdminStoreItem>(`/admin/stores/${id}/toggle-suspension`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    });
  },

  async updateStoreCommission(id: number, commission_rate: number | null) {
    return apiRequest<AdminStoreItem>(`/admin/stores/${id}/commission`, {
      method: 'PUT',
      body: JSON.stringify({ commission_rate }),
    });
  },

  async toggleStoreVerification(id: number) {
    return apiRequest<AdminStoreItem>(`/admin/stores/${id}/toggle-verification`, {
      method: 'POST',
    });
  },

  async getCategories() {
    const res = await apiRequest<AdminCategoryItem[]>('/admin/categories');
    return Array.isArray(res.data) ? res.data : [];
  },

  async createCategory(payload: {
    name: string;
    parent_id?: number | null;
    description?: string | null;
    image?: string | null;
    order?: number;
    is_active?: boolean;
    commission_rate?: number | null;
  }) {
    return apiRequest<AdminCategoryItem>('/admin/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateCategory(
    id: number,
    payload: {
      name?: string;
      parent_id?: number | null;
      description?: string | null;
      image?: string | null;
      order?: number;
      is_active?: boolean;
      commission_rate?: number | null;
    },
  ) {
    return apiRequest<AdminCategoryItem>(`/admin/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteCategory(id: number) {
    return apiRequest<null>(`/admin/categories/${id}`, { method: 'DELETE' });
  },

  async getBrands(perPage = 50) {
    const res = await apiRequest<PaginatedResult<AdminBrandItem> | AdminBrandItem[]>(
      `/admin/brands?per_page=${perPage}`,
    );
    return normalizePaginated(res.data);
  },

  async createBrand(payload: {
    name: string;
    logo?: string | null;
    description?: string | null;
    website?: string | null;
    is_active?: boolean;
  }) {
    return apiRequest<AdminBrandItem>('/admin/brands', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateBrand(
    id: number,
    payload: {
      name?: string;
      logo?: string | null;
      description?: string | null;
      website?: string | null;
      is_active?: boolean;
    },
  ) {
    return apiRequest<AdminBrandItem>(`/admin/brands/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteBrand(id: number) {
    return apiRequest<null>(`/admin/brands/${id}`, { method: 'DELETE' });
  },

  async getUsers(params?: { role?: string; status?: string; search?: string; page?: number }) {
    const qs = new URLSearchParams();
    if (params?.role) qs.set('role', params.role);
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<PaginatedResult<AdminUserItem> | AdminUserItem[]>(
      `/admin/users${q}`,
    );
    return normalizePaginated(res.data);
  },

  async toggleUserStatus(id: number, status: 'active' | 'suspended') {
    return apiRequest<AdminUserItem>(`/admin/users/${id}/toggle-status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  async updateUserRoles(id: number, roles: string[]) {
    return apiRequest<AdminUserItem>(`/admin/users/${id}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roles }),
    });
  },

  async getBakongOverview() {
    const res = await apiRequest<AdminBakongOverview>('/admin/bakong/overview');
    return res.data;
  },

  async getBakongAccounts(page = 1) {
    const res = await apiRequest<PaginatedResult<AdminBakongAccount> | AdminBakongAccount[]>(
      `/admin/bakong/accounts?page=${page}`,
    );
    return normalizePaginated(res.data);
  },

  async getBakongTransactions(params?: { payment_status?: string; search?: string; page?: number }) {
    const qs = new URLSearchParams();
    if (params?.payment_status) qs.set('payment_status', params.payment_status);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<PaginatedResult<BakongTxItem> | BakongTxItem[]>(
      `/admin/bakong/transactions${q}`,
    );
    return normalizePaginated(res.data);
  },

  async getDisputes(params?: { status?: string; page?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<PaginatedResult<AdminDisputeItem> | AdminDisputeItem[]>(
      `/admin/disputes${q}`,
    );
    return normalizePaginated(res.data);
  },

  async resolveDispute(
    id: number,
    payload: { status: 'resolved_customer' | 'resolved_store' | 'closed'; admin_resolution: string },
  ) {
    return apiRequest<AdminDisputeItem>(`/admin/disputes/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getSettings() {
    const res = await apiRequest<Record<string, PlatformSettingItem[]>>('/admin/settings');
    return res.data || {};
  },

  async updateSettings(settings: { key: string; value: string | number | boolean | null }[]) {
    return apiRequest<PlatformSettingItem[]>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });
  },

  async getAuditLogs(params?: { action?: string; page?: number; per_page?: number }) {
    const qs = new URLSearchParams();
    if (params?.action) qs.set('action', params.action);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<PaginatedResult<AuditLogItem> | AuditLogItem[]>(
      `/admin/audit-logs${q}`,
    );
    return normalizePaginated(res.data);
  },

  async uploadMedia(file: File, folder: 'categories' | 'brands' | 'products' | 'stores') {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder);
    const res = await apiRequest<{ id: number; secure_url: string }>('/media/upload', {
      method: 'POST',
      body: fd,
      isFormData: true,
    });
    return res.data;
  },
};

// ==========================================
// Store Owner Types & API
// ==========================================

export interface SellerDashboardData {
  financials: {
    gross_sales: number;
    platform_commission: number;
    net_earnings: number;
    available_balance: number;
    paid_payouts: number;
    pending_payouts: number;
  };
  orders: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
  };
  inventory: {
    total_products: number;
    low_stock_count: number;
  };
  top_products: {
    product_id: number;
    product_name: string;
    total_sold: number | string;
    revenue: number | string;
  }[];
}

export interface SellerStoreProfile {
  id: number;
  user_id: number;
  name: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  banner?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status: string;
  is_verified: boolean;
  commission_rate?: number | null;
  announcements?: string | null;
  policies?: string | null;
  bakong_account?: {
    bakong_account_id: string;
    connection_status: string;
  } | null;
}

export interface SellerProductItem {
  id: number;
  name: string;
  slug: string;
  sku: string;
  category_id?: number | null;
  brand_id?: number | null;
  description?: string | null;
  short_description?: string | null;
  regular_price: number | string;
  discount_price?: number | string | null;
  stock_quantity: number;
  low_stock_threshold?: number;
  status: 'draft' | 'published' | 'archived';
  is_featured?: boolean;
  free_shipping?: boolean;
  created_at: string;
  primary_image?: { image_url: string } | null;
  images?: { id?: number; media_id?: number | null; image_url: string; is_primary?: boolean; sort_order?: number }[];
  category?: { id: number; name: string } | null;
  brand?: { id: number; name: string } | null;
}

export interface InventoryMovementItem {
  id: number;
  product_id: number;
  quantity_change: number;
  type: string;
  notes?: string | null;
  created_at: string;
  product?: { id: number; name: string; sku: string } | null;
  variant?: { id: number; name: string; sku: string } | null;
}

export interface SellerOrderItem {
  id: number;
  order_number: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  shipping_address?: {
    full_name?: string;
    phone?: string;
    address_line_1?: string;
    commune?: string | null;
    district?: string | null;
    province?: string;
  } | null;
  shipping_method_name?: string | null;
  shipping_carrier?: string | null;
  tracking_number?: string | null;
  subtotal_amount: number | string;
  shipping_amount: number | string;
  discount_amount: number | string;
  total_amount: number | string;
  currency: string;
  payment_method?: string;
  payment_status: string;
  status: string;
  created_at: string;
  items?: {
    id: number;
    product_name: string;
    product_sku?: string | null;
    unit_price: number | string;
    quantity: number;
    total: number | string;
  }[];
  bakong_transaction?: {
    bill_number: string;
    payment_status: string;
    amount: number | string;
  } | null;
}

export interface SellerShippingMethod {
  id: number;
  name: string;
  description?: string | null;
  calculation_type: 'fixed' | 'weight_based' | 'free' | 'distance_based';
  base_cost: number | string;
  cost_per_kg?: number | string | null;
  free_shipping_threshold?: number | string | null;
  estimated_delivery_days?: string | null;
  is_active: boolean;
}

export interface SellerPromotionItem {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  discount_type: 'percentage' | 'fixed_amount' | 'free_shipping';
  discount_value: number | string;
  min_order_amount?: number | string | null;
  max_discount_amount?: number | string | null;
  usage_limit?: number | null;
  used_count?: number;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
}

export interface SellerBakongStatus {
  is_connected: boolean;
  is_enabled: boolean;
  connection_status: string;
  account: {
    bakong_account_id: string;
    registered_email: string;
    merchant_name: string;
    merchant_city?: string | null;
    merchant_category_code?: string | null;
    has_token?: boolean;
    token_masked?: string | null;
    token_expires_at?: string | null;
    last_checked_at?: string | null;
  } | null;
}

export interface SellerPayoutItem {
  id: number;
  payout_reference: string;
  amount: number | string;
  status: string;
  payment_method: string;
  created_at: string;
}

export const storeOwnerApi = {
  async getDashboard() {
    const res = await apiRequest<SellerDashboardData>('/store-owner/dashboard');
    return res.data;
  },

  async getProfile() {
    const res = await apiRequest<SellerStoreProfile>('/store-owner/profile');
    return res.data;
  },

  async updateProfile(payload: {
    name?: string;
    description?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    announcements?: string | null;
    policies?: string | null;
  }) {
    return apiRequest<SellerStoreProfile>('/store-owner/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async updateBranding(payload: { logo?: File; banner?: File }) {
    const fd = new FormData();
    if (payload.logo) fd.append('logo', payload.logo);
    if (payload.banner) fd.append('banner', payload.banner);
    return apiRequest<{ logo: string | null; banner: string | null }>(
      '/store-owner/branding',
      {
        method: 'POST',
        body: fd,
        isFormData: true,
      },
    );
  },

  async getProducts(params?: { status?: string; search?: string; page?: number; per_page?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<PaginatedResult<SellerProductItem> | SellerProductItem[]>(
      `/store-owner/products${q}`,
    );
    return normalizePaginated(res.data);
  },

  async getProduct(id: number) {
    const res = await apiRequest<SellerProductItem>(`/store-owner/products/${id}`);
    return res.data;
  },

  async createProduct(payload: {
    name: string;
    sku: string;
    category_id?: number | null;
    brand_id?: number | null;
    description?: string | null;
    short_description?: string | null;
    regular_price: number;
    discount_price?: number | null;
    stock_quantity: number;
    low_stock_threshold?: number;
    status: 'draft' | 'published' | 'archived';
    is_featured?: boolean;
    free_shipping?: boolean;
    images?: { image_url: string; media_id?: number | null; sort_order: number; is_primary: boolean }[];
  }) {
    return apiRequest<SellerProductItem>('/store-owner/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateProduct(
    id: number,
    payload: {
      name?: string;
      sku?: string;
      category_id?: number | null;
      brand_id?: number | null;
      description?: string | null;
      short_description?: string | null;
      regular_price?: number;
      discount_price?: number | null;
      stock_quantity?: number;
      low_stock_threshold?: number;
      status?: 'draft' | 'published' | 'archived';
      is_featured?: boolean;
      free_shipping?: boolean;
      images?: {
        id?: number;
        image_url: string;
        media_id?: number | null;
        sort_order: number;
        is_primary: boolean;
      }[];
    },
  ) {
    return apiRequest<SellerProductItem>(`/store-owner/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteProduct(id: number) {
    return apiRequest<null>(`/store-owner/products/${id}`, { method: 'DELETE' });
  },

  async getInventoryMovements(page = 1) {
    const res = await apiRequest<PaginatedResult<InventoryMovementItem> | InventoryMovementItem[]>(
      `/store-owner/inventory/movements?page=${page}`,
    );
    return normalizePaginated(res.data);
  },

  async adjustStock(payload: {
    product_id: number;
    quantity_change: number;
    type: 'restock' | 'adjustment';
    notes?: string;
  }) {
    return apiRequest<{ movement: InventoryMovementItem; current_stock: number }>(
      '/store-owner/inventory/adjust',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },

  async getOrders(params?: { status?: string; payment_status?: string; search?: string; page?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.payment_status) qs.set('payment_status', params.payment_status);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<PaginatedResult<SellerOrderItem> | SellerOrderItem[]>(
      `/store-owner/orders${q}`,
    );
    return normalizePaginated(res.data);
  },

  async updateOrderStatus(
    id: number,
    payload: {
      status: 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled';
      tracking_number?: string;
      shipping_carrier?: string;
      notes?: string;
    },
  ) {
    return apiRequest<SellerOrderItem>(`/store-owner/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async getShippingMethods() {
    const res = await apiRequest<SellerShippingMethod[]>('/store-owner/shipping');
    return Array.isArray(res.data) ? res.data : [];
  },

  async createShippingMethod(payload: {
    name: string;
    description?: string | null;
    calculation_type: 'fixed' | 'weight_based' | 'free' | 'distance_based';
    base_cost: number;
    free_shipping_threshold?: number | null;
    estimated_delivery_days?: string | null;
    is_active?: boolean;
  }) {
    return apiRequest<SellerShippingMethod>('/store-owner/shipping', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateShippingMethod(
    id: number,
    payload: Partial<{
      name: string;
      description: string | null;
      calculation_type: 'fixed' | 'weight_based' | 'free' | 'distance_based';
      base_cost: number;
      free_shipping_threshold: number | null;
      estimated_delivery_days: string | null;
      is_active: boolean;
    }>,
  ) {
    return apiRequest<SellerShippingMethod>(`/store-owner/shipping/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteShippingMethod(id: number) {
    return apiRequest<null>(`/store-owner/shipping/${id}`, { method: 'DELETE' });
  },

  async getPromotions(page = 1) {
    const res = await apiRequest<PaginatedResult<SellerPromotionItem> | SellerPromotionItem[]>(
      `/store-owner/promotions?page=${page}`,
    );
    return normalizePaginated(res.data);
  },

  async createPromotion(payload: {
    code: string;
    name: string;
    description?: string | null;
    discount_type: 'percentage' | 'fixed_amount' | 'free_shipping';
    discount_value: number;
    min_order_amount?: number | null;
    max_discount_amount?: number | null;
    usage_limit?: number | null;
    start_date?: string | null;
    end_date?: string | null;
    is_active?: boolean;
  }) {
    return apiRequest<SellerPromotionItem>('/store-owner/promotions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updatePromotion(
    id: number,
    payload: Partial<{
      name: string;
      discount_value: number;
      is_active: boolean;
    }>,
  ) {
    return apiRequest<SellerPromotionItem>(`/store-owner/promotions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deletePromotion(id: number) {
    return apiRequest<null>(`/store-owner/promotions/${id}`, { method: 'DELETE' });
  },

  async getBakongStatus() {
    const res = await apiRequest<SellerBakongStatus>('/store-owner/bakong/status');
    return res.data;
  },

  async connectBakong(payload: {
    bakong_account_id: string;
    registered_email: string;
    api_token?: string;
    merchant_name: string;
    merchant_city?: string;
    merchant_category_code?: string;
  }) {
    return apiRequest<unknown>('/store-owner/bakong/connect', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async disconnectBakong() {
    return apiRequest<null>('/store-owner/bakong/disconnect', { method: 'POST' });
  },

  async toggleBakong(enabled: boolean) {
    return apiRequest<{ is_enabled: boolean }>('/store-owner/bakong/toggle', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  },

  async renewBakongToken() {
    return apiRequest<unknown>('/store-owner/bakong/renew-token', { method: 'POST' });
  },

  async checkBakongHealth() {
    return apiRequest<{ healthy?: boolean; status?: string; message?: string }>(
      '/store-owner/bakong/health',
    );
  },

  async getBakongTransactions(params?: { payment_status?: string; search?: string; page?: number }) {
    const qs = new URLSearchParams();
    if (params?.payment_status) qs.set('payment_status', params.payment_status);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<{
      stats: {
        total_volume: number;
        successful_count: number;
        pending_count: number;
        failed_count: number;
      };
      transactions: PaginatedResult<BakongTxItem> | BakongTxItem[];
    }>(`/store-owner/bakong/transactions${q}`);
    return {
      stats: res.data.stats,
      transactions: normalizePaginated(res.data.transactions),
    };
  },

  async getPayouts(page = 1) {
    const res = await apiRequest<PaginatedResult<SellerPayoutItem> | SellerPayoutItem[]>(
      `/store-owner/payouts?page=${page}`,
    );
    return normalizePaginated(res.data);
  },

  async requestPayout(payload: {
    amount: number;
    payout_method: 'bakong' | 'bank_transfer';
    payout_details?: Record<string, string>;
  }) {
    return apiRequest<SellerPayoutItem>('/store-owner/payouts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async uploadProductImage(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'products');
    const res = await apiRequest<{ id: number; secure_url: string }>('/media/upload', {
      method: 'POST',
      body: fd,
      isFormData: true,
    });
    return res.data;
  },
};
