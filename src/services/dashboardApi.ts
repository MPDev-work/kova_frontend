import { apiRequest } from './api';
import type { ChatMessageMetadata } from '../types/marketplace';

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

export interface DashboardDateRangeParams {
  range?: 'today' | '7d' | '30d' | 'ytd' | 'all' | 'custom';
  start_date?: string;
  end_date?: string;
}

export interface DashboardRangeMeta {
  key: 'today' | '7d' | '30d' | 'ytd' | 'all' | 'custom';
  start_date: string | null;
  end_date: string | null;
  label: string;
  is_filtered: boolean;
}

export interface DashboardTrendPoint {
  label: string;
  primary: number;
  secondary: number;
}

export interface AdminDashboardData {
  range?: DashboardRangeMeta;
  metrics: {
    total_gross_revenue: number;
    total_platform_commission: number;
    total_orders: number;
    total_stores: number;
    total_stores_all?: number;
    total_customers: number;
    total_customers_all?: number;
    total_products: number;
    total_products_all?: number;
    pending_store_applications: number;
    pending_store_applications_all?: number;
    pending_payments_count: number;
    successful_payments_count?: number;
    failed_payments_count?: number;
    successful_payments_volume: number;
  };
  trend?: DashboardTrendPoint[];
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

export interface SellerFollowerStats {
  total_followers: number;
  new_last_30_days: number;
  ordering_followers: number;
}

export interface SellerFollowerItem {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  status?: string;
  followed_at?: string | null;
  orders_count: number;
  total_spent: number;
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
  is_secret?: boolean;
  has_value?: boolean;
  masked_value?: string | null;
  expires_at?: string | null;
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

export interface AdminShippingMethod {
  id: number;
  store_id?: number | null;
  name: string;
  description?: string | null;
  calculation_type: 'fixed' | 'weight_based' | 'free' | 'distance_based';
  base_cost: number | string;
  cost_per_kg?: number | string | null;
  free_shipping_threshold?: number | string | null;
  estimated_delivery_days?: string | null;
  is_active: boolean;
  rates?: { id: number; province: string; rate: number | string }[];
}

export interface AdminShippingStats {
  active_methods: number;
  total_methods: number;
  pending_dispatch: number;
  in_transit: number;
  delivered: number;
}

export interface AdminShipmentItem {
  id: number;
  order_number: string;
  child_order_number?: string;
  customer_name: string;
  customer_phone?: string | null;
  shipping_address?: { province?: string; district?: string } | null;
  shipping_method_name?: string | null;
  shipping_carrier?: string | null;
  tracking_number?: string | null;
  status: string;
  created_at: string;
  store?: {
    id: number;
    name: string;
    slug: string;
    is_verified?: boolean;
  } | null;
}

export const adminApi = {
  async getDashboard(params?: DashboardDateRangeParams) {
    const qs = new URLSearchParams();
    if (params?.range) qs.set('range', params.range);
    if (params?.start_date) qs.set('start_date', params.start_date);
    if (params?.end_date) qs.set('end_date', params.end_date);
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<AdminDashboardData>(`/admin/dashboard${q}`);
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

  async getTickets(params?: {
    status?: string;
    scope?: 'all' | 'platform' | 'store';
    search?: string;
    page?: number;
    per_page?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.scope && params.scope !== 'all') qs.set('scope', params.scope);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<{
      stats: DashboardTicketStats;
      tickets: PaginatedResult<DashboardTicketItem> | DashboardTicketItem[];
    }>(`/admin/tickets${q}`);
    return {
      stats: res.data.stats,
      tickets: normalizePaginated(res.data.tickets),
    };
  },

  async getTicket(id: number) {
    const res = await apiRequest<DashboardTicketItem>(`/admin/tickets/${id}`);
    return res.data;
  },

  async replyTicket(
    id: number,
    message: string,
    attachments?: string[],
    metadata?: ChatMessageMetadata | null,
  ) {
    const res = await apiRequest<{
      message: DashboardTicketMessage;
      ticket: DashboardTicketItem;
    }>(`/admin/tickets/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        attachments:
          attachments && attachments.length > 0 ? attachments : undefined,
        metadata: metadata ?? undefined,
      }),
    });
    return res.data;
  },

  async updateTicketStatus(
    id: number,
    status: 'open' | 'in_progress' | 'resolved' | 'closed',
  ) {
    const res = await apiRequest<DashboardTicketItem>(`/admin/tickets/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    return res.data;
  },

  async bulkTicketAction(
    action: 'mark_read' | 'delete' | 'block' | 'unblock',
    ticketIds: number[],
  ) {
    return apiRequest<{ affected_ids: number[] }>('/admin/tickets/bulk-action', {
      method: 'POST',
      body: JSON.stringify({ action, ticket_ids: ticketIds }),
    });
  },

  async markAllTicketsRead() {
    return apiRequest<null>('/admin/tickets/mark-all-read', {
      method: 'POST',
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

  async uploadBrandingAsset(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'branding');
    const res = await apiRequest<{ id: number; secure_url: string }>('/media/upload', {
      method: 'POST',
      body: fd,
      isFormData: true,
    });
    return res.data;
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

  async getShipping(params?: { status?: string; search?: string }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<{
      stats: AdminShippingStats;
      methods: AdminShippingMethod[];
      shipments: AdminShipmentItem[];
    }>(`/admin/shipping${q}`);
    return res.data;
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
    return apiRequest<AdminShippingMethod>('/admin/shipping', {
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
    return apiRequest<AdminShippingMethod>(`/admin/shipping/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteShippingMethod(id: number) {
    return apiRequest<null>(`/admin/shipping/${id}`, { method: 'DELETE' });
  },

  async updateShipment(
    id: number,
    payload: {
      status: 'processing' | 'shipped' | 'delivered' | 'completed';
      tracking_number?: string;
      shipping_carrier?: string;
      notes?: string;
    },
  ) {
    return apiRequest<AdminShipmentItem>(`/admin/shipping/shipments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async uploadMedia(file: File, folder: 'categories' | 'products' | 'stores') {
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
  range?: DashboardRangeMeta;
  financials: {
    gross_sales: number;
    platform_commission: number;
    net_earnings: number;
    available_balance: number;
    lifetime_available_balance?: number;
    paid_payouts: number;
    pending_payouts: number;
  };
  orders: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    cancelled?: number;
  };
  inventory: {
    total_products: number;
    published_products?: number;
    new_products?: number;
    low_stock_count: number;
    out_of_stock_count?: number;
  };
  trend?: DashboardTrendPoint[];
  category_breakdown?: {
    category_name: string;
    orders_count: number;
    units_sold: number;
    revenue: number;
    percent: number;
  }[];
  top_products: {
    product_id: number;
    product_name: string;
    total_sold: number | string;
    revenue: number | string;
  }[];
  recent_orders?: {
    id: number;
    order_number: string;
    child_order_number?: string;
    customer_name: string;
    total_amount: number | string;
    currency: string;
    payment_status: string;
    status: string;
    created_at: string;
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
  province?: string | null;
  district?: string | null;
  commune?: string | null;
  google_maps_url?: string | null;
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
  subcategory_id?: number | null;
  description?: string | null;
  short_description?: string | null;
  regular_price: number | string;
  discount_price?: number | string | null;
  stock_quantity: number;
  low_stock_threshold?: number;
  weight?: number | string | null;
  dimensions?: Record<string, string | number> | null;
  video_url?: string | null;
  specifications?: Record<string, string> | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  status: 'draft' | 'published' | 'archived';
  is_featured?: boolean;
  free_shipping?: boolean;
  reviews_avg_rating?: number | string | null;
  reviews_count?: number;
  created_at: string;
  updated_at?: string | null;
  primary_image?: { image_url: string } | null;
  images?: {
    id?: number;
    media_id?: number | null;
    image_url: string;
    is_primary?: boolean;
    sort_order?: number;
  }[];
  category?: { id: number; name: string } | null;
  subcategory?: { id: number; name: string } | null;
  attributes?: {
    id?: number;
    name: string;
    values?: string[] | string;
    value?: string;
  }[];
  variants?: {
    id: number;
    name: string;
    sku?: string | null;
    price: number | string;
    stock_quantity: number;
    image_url?: string | null;
    attributes?: Record<string, string> | null;
  }[];
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
  parent_order_number?: string;
  child_order_number?: string;
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
  paid_at?: string | null;
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
    verified_at?: string | null;
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
  platform_token_configured?: boolean;
  account: {
    bakong_account_id: string;
    registered_email?: string | null;
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

export interface DashboardTicketStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  platform_count?: number;
  store_count?: number;
}

export interface DashboardTicketMessage {
  id: number;
  ticket_id: number;
  user_id: number;
  message: string;
  attachments?: string[] | null;
  metadata?: ChatMessageMetadata | null;
  is_admin_reply: boolean;
  created_at: string;
  user?: {
    id: number;
    name: string;
    avatar?: string | null;
  } | null;
}

export interface DashboardTicketItem {
  id: number;
  ticket_number: string;
  user_id: number;
  store_id?: number | null;
  order_id?: number | null;
  subject: string;
  message: string;
  attachments?: string[] | null;
  priority: 'low' | 'medium' | 'high' | string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | string;
  is_unread?: boolean;
  is_blocked?: boolean;
  blocked_by_me?: boolean;
  peer_is_online?: boolean;
  peer_last_active_at?: string | null;
  created_at: string;
  updated_at: string;
  messages_count?: number;
  user?: {
    id: number;
    name: string;
    email?: string | null;
    avatar?: string | null;
  } | null;
  store?: {
    id: number;
    name: string;
    slug: string;
    logo?: string | null;
    is_verified?: boolean;
  } | null;
  order?: {
    id: number;
    order_number: string;
  } | null;
  latest_message?: DashboardTicketMessage | null;
  messages?: DashboardTicketMessage[];
}

export interface SellerReviewStats {
  total_reviews: number;
  average_rating: number;
  five_star_count: number;
  verified_count: number;
  rating_breakdown: Record<number, number>;
}

export interface SellerReviewItem {
  id: number;
  product_id: number;
  user_id: number;
  order_item_id?: number | null;
  rating: number;
  title?: string | null;
  comment: string;
  is_verified_purchase: boolean;
  status: string;
  created_at: string;
  user?: {
    id: number;
    name: string;
    email?: string | null;
    avatar?: string | null;
  } | null;
  product?: {
    id: number;
    name: string;
    slug: string;
    sku?: string | null;
    primary_image?: { image_url: string } | null;
  } | null;
  images?: { id: number; image_url: string }[];
}

export const storeOwnerApi = {
  async getDashboard(params?: DashboardDateRangeParams) {
    const qs = new URLSearchParams();
    if (params?.range) qs.set('range', params.range);
    if (params?.start_date) qs.set('start_date', params.start_date);
    if (params?.end_date) qs.set('end_date', params.end_date);
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<SellerDashboardData>(`/store-owner/dashboard${q}`);
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
    province?: string | null;
    district?: string | null;
    commune?: string | null;
    google_maps_url?: string | null;
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
    const paged = normalizePaginated(res.data);
    return {
      ...paged,
      data: paged.data.map((o) => ({
        ...o,
        order_number:
          o.parent_order_number || o.order_number.replace(/-S\d+$/, ''),
      })),
    };
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
    name?: string | null;
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
      code: string;
      name: string;
      discount_type: 'percentage' | 'fixed_amount';
      discount_value: number;
      min_order_amount: number | null;
      usage_limit: number | null;
      start_date: string | null;
      end_date: string | null;
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

  async getReviews(params?: {
    rating?: number;
    search?: string;
    page?: number;
    per_page?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.rating) qs.set('rating', String(params.rating));
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<{
      stats: SellerReviewStats;
      reviews: PaginatedResult<SellerReviewItem> | SellerReviewItem[];
    }>(`/store-owner/reviews${q}`);
    return {
      stats: res.data.stats,
      reviews: normalizePaginated(res.data.reviews),
    };
  },

  async getFollowers(params?: {
    search?: string;
    page?: number;
    per_page?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<{
      stats: SellerFollowerStats;
      followers: PaginatedResult<SellerFollowerItem> | SellerFollowerItem[];
    }>(`/store-owner/followers${q}`);
    return {
      stats: res.data.stats,
      followers: normalizePaginated(res.data.followers),
    };
  },

  async getTickets(params?: {
    status?: string;
    search?: string;
    page?: number;
    per_page?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<{
      stats: DashboardTicketStats;
      tickets: PaginatedResult<DashboardTicketItem> | DashboardTicketItem[];
    }>(`/store-owner/tickets${q}`);
    return {
      stats: res.data.stats,
      tickets: normalizePaginated(res.data.tickets),
    };
  },

  async getTicket(id: number) {
    const res = await apiRequest<DashboardTicketItem>(`/store-owner/tickets/${id}`);
    return res.data;
  },

  async replyTicket(
    id: number,
    message: string,
    attachments?: string[],
    metadata?: ChatMessageMetadata | null,
  ) {
    const res = await apiRequest<{
      message: DashboardTicketMessage;
      ticket: DashboardTicketItem;
    }>(`/store-owner/tickets/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        attachments:
          attachments && attachments.length > 0 ? attachments : undefined,
        metadata: metadata ?? undefined,
      }),
    });
    return res.data;
  },

  async updateTicketStatus(
    id: number,
    status: 'open' | 'in_progress' | 'resolved' | 'closed',
  ) {
    const res = await apiRequest<DashboardTicketItem>(
      `/store-owner/tickets/${id}/status`,
      {
        method: 'PUT',
        body: JSON.stringify({ status }),
      },
    );
    return res.data;
  },

  async bulkTicketAction(
    action: 'mark_read' | 'delete' | 'block' | 'unblock',
    ticketIds: number[],
  ) {
    return apiRequest<{ affected_ids: number[] }>(
      '/store-owner/tickets/bulk-action',
      {
        method: 'POST',
        body: JSON.stringify({ action, ticket_ids: ticketIds }),
      },
    );
  },

  async markAllTicketsRead() {
    return apiRequest<null>('/store-owner/tickets/mark-all-read', {
      method: 'POST',
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
