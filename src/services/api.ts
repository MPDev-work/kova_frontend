import type {
  Address,
  AppliedCoupon,
  BakongKhqrData,
  CartSummary,
  Category,
  ChatMessageMetadata,
  ChildOrderRecord,
  OrderRecord,
  PlatformSettings,
  Product,
  Promotion,
  Province,
  ReviewItem,
  ShippingMethod,
  Store,
  StoreApplication,
  SupportTicket,
  UserNotificationItem,
  UserProfile,
} from '../types/marketplace';

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    '',
  ) || '/api/v1';

export const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:8000';

const TOKEN_STORAGE_KEY = 'kova_auth_token';
const USER_STORAGE_KEY = 'kova_auth_user';
const SESSION_STORAGE_KEY = 'kova_guest_session_id';

export function getAuthToken(): string | null {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export function getCachedUser(): UserProfile | null {
  if (!getAuthToken()) return null;
  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: UserProfile | null): void {
  if (user && getAuthToken()) {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export function getGuestSessionId(): string {
  let id = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!id) {
    id = `kova_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(SESSION_STORAGE_KEY, id);
  }
  return id;
}

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

interface RawEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

const TECHNICAL_ERROR_PATTERN =
  /sqlstate|pdoexception|queryexception|stack trace|undefined |syntaxerror|typeerror|referenceerror|curl error|call to a member|ensure laravel|unexpected server response|request failed \(\d+\)|internal server error|server error|http \d{3}|<!doctype|<html|vendor[\\/]|app[\\/]http/i;

export function toFriendlyErrorMessage(
  rawMessage: string | undefined | null,
  status = 0,
): string {
  const cleaned = (rawMessage || '')
    .replace(/\s*\(and \d+ more errors?\)\.?$/i, '')
    .trim();
  const lower = cleaned.toLowerCase();

  // Network / offline
  if (
    status === 0 &&
    (!cleaned ||
      /failed to fetch|networkerror|network request failed|load failed|err_connection/i.test(
        lower,
      ))
  ) {
    return "We couldn't connect right now. Please check your internet connection and try again.";
  }

  // Wrong login credentials
  if (
    lower.includes('invalid email/phone or password') ||
    lower.includes('these credentials do not match') ||
    lower === 'invalid credentials.' ||
    lower === 'invalid credentials'
  ) {
    return 'Email or phone number or password was not correct.';
  }

  // Password broker translation keys
  if (lower === 'passwords.throttled' || lower.includes('please wait before retrying')) {
    return 'Please wait a minute before requesting another reset link.';
  }
  if (lower === 'passwords.token' || lower.includes('this password reset token is invalid')) {
    return 'This reset link has expired or was already used. Please request a new one.';
  }
  if (lower === 'passwords.user' || lower.includes("we can't find a user with that email")) {
    return "We couldn't find an account with that email address.";
  }

  // Rate limits / out of attempts
  if (
    status === 429 ||
    lower === 'too many attempts.' ||
    lower === 'too many attempts' ||
    lower.includes('too many requests')
  ) {
    if (
      cleaned &&
      !TECHNICAL_ERROR_PATTERN.test(cleaned) &&
      (lower.includes('wait ') || lower.includes('sign in again'))
    ) {
      return cleaned;
    }
    return "You've tried too many times. Please wait a minute and try again.";
  }

  // Auth / session errors
  if (
    status === 401 ||
    lower === 'unauthenticated.' ||
    lower === 'unauthenticated'
  ) {
    return 'Please sign in again to continue.';
  }

  // Forbidden / role errors
  if (
    status === 403 &&
    (!cleaned ||
      lower === 'forbidden.' ||
      lower === 'forbidden' ||
      lower.includes('this action is unauthorized') ||
      lower.includes('insufficient role') ||
      lower.includes('tenant isolation'))
  ) {
    return "You don't have permission to do that.";
  }

  // Not found
  if (
    status === 404 &&
    (!cleaned ||
      lower === 'resource not found.' ||
      lower === 'not found' ||
      lower.includes('no query results') ||
      lower.includes('could not be found'))
  ) {
    return "We couldn't find what you were looking for.";
  }

  // Method not allowed
  if (status === 405) {
    return 'That action is not available right now.';
  }

  // Technical errors or raw 5xx server failures
  if (!cleaned || TECHNICAL_ERROR_PATTERN.test(cleaned)) {
    return status >= 500
      ? 'Something went wrong on our end. Please try again in a moment.'
      : 'Something went wrong. Please try again.';
  }

  if (status >= 500 && cleaned.length > 160) {
    return 'Something went wrong on our end. Please try again in a moment.';
  }

  // Soften raw Laravel default validation phrasing ("The current password field is required.")
  if (/^the .+ field /i.test(cleaned)) {
    return cleaned
      .replace(/^the (.+?) field is required\.?$/i, 'Please enter your $1.')
      .replace(
        /^the (.+?) field must be a valid email address\.?$/i,
        'Please enter a valid email address.',
      )
      .replace(
        /^the (.+?) field confirmation does not match\.?$/i,
        'The passwords do not match.',
      )
      .replace(
        /^the (.+?) field must be at least (\d+) characters\.?$/i,
        'Your $1 must be at least $2 characters long.',
      )
      .replace(
        /^the (.+?) has already been taken\.?$/i,
        'That $1 is already registered with another account.',
      )
      .replace(/_/g, ' ');
  }

  if (/^the .+ has already been taken\.?$/i.test(cleaned)) {
    return cleaned
      .replace(
        /^the (.+?) has already been taken\.?$/i,
        'That $1 is already registered with another account.',
      )
      .replace(/_/g, ' ');
  }

  return cleaned;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { isFormData?: boolean } = {},
): Promise<{ data: T; message: string }> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  headers.set('X-Session-ID', getGuestSessionId());

  if (!options.isFormData && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (err) {
    throw new ApiError(
      toFriendlyErrorMessage(
        err instanceof Error ? err.message : undefined,
        0,
      ),
      0,
    );
  }

  const text = await res.text();
  let json: RawEnvelope<T>;
  try {
    json = text ? (JSON.parse(text) as RawEnvelope<T>) : {};
  } catch {
    throw new ApiError(toFriendlyErrorMessage(undefined, res.status), res.status);
  }

  if (!res.ok || json.success === false) {
    const firstFieldError = json.errors
      ? Object.values(json.errors).flat()[0]
      : undefined;
    throw new ApiError(
      toFriendlyErrorMessage(firstFieldError || json.message, res.status),
      res.status,
      json.errors,
    );
  }

  const hasDataKey = Object.prototype.hasOwnProperty.call(json, 'data');

  return {
    data: hasDataKey ? (json.data as T) : (json as unknown as T),
    message: json.message || '',
  };
}

// ==========================================
// Response Normalizers
// ==========================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeProduct(raw: any): Product {
  const regular = Number(raw.regular_price ?? raw.price ?? 0);
  const discount =
    raw.discount_price !== null &&
    raw.discount_price !== undefined &&
    Number(raw.discount_price) > 0 &&
    Number(raw.discount_price) < regular
      ? Number(raw.discount_price)
      : null;
  const effectivePrice = discount ?? regular;
  const discountPercent =
    discount && regular > 0
      ? Math.round(((regular - discount) / regular) * 100)
      : 0;

  const primaryImg: string | null =
    raw.primary_image?.image_url ||
    raw.primaryImage?.image_url ||
    raw.images?.[0]?.image_url ||
    null;

  const galleryUrls: string[] = Array.isArray(raw.images)
    ? raw.images
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((img: any) => img?.image_url)
        .filter((u: unknown): u is string => typeof u === 'string' && u.length > 0)
    : [];

  if (primaryImg && !galleryUrls.includes(primaryImg)) {
    galleryUrls.unshift(primaryImg);
  }

  const variants = Array.isArray(raw.variants)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      raw.variants.map((v: any) => ({
        id: Number(v.id),
        name: String(v.name || 'Default'),
        sku: v.sku ?? null,
        price: Number(v.price ?? effectivePrice),
        stock_quantity: Number(v.stock_quantity ?? 0),
        image_url: v.image_url ?? primaryImg,
        attributes: v.attributes ?? null,
      }))
    : [];

  const specs: Record<string, string> = {};
  if (raw.specifications && typeof raw.specifications === 'object') {
    Object.entries(raw.specifications).forEach(([k, v]) => {
      specs[k] = String(v);
    });
  }
  if (Array.isArray(raw.attributes)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    raw.attributes.forEach((a: any) => {
      if (a?.name && a?.value) specs[String(a.name)] = String(a.value);
    });
  }

  const stock = Number(raw.stock_quantity ?? 0);

  return {
    id: Number(raw.id),
    slug: String(raw.slug || raw.id),
    sku: raw.sku ?? null,
    name: String(raw.name || ''),
    description: raw.description ?? null,
    short_description: raw.short_description ?? null,
    regular_price: regular,
    discount_price: discount,
    price: effectivePrice,
    discount_percent: discountPercent,
    stock_quantity: stock,
    in_stock: stock > 0,
    is_featured: Boolean(raw.is_featured),
    free_shipping: Boolean(raw.free_shipping),
    has_free_delivery: Boolean(raw.has_free_delivery ?? raw.free_shipping),
    image: primaryImg,
    gallery: galleryUrls,
    store_id: Number(raw.store_id ?? raw.store?.id ?? 0),
    store_name: String(raw.store?.name || 'Store'),
    store_slug: String(raw.store?.slug || raw.store_id || ''),
    store_logo: raw.store?.logo ?? null,
    store_verified: Boolean(raw.store?.is_verified),
    category_id: raw.category_id ? Number(raw.category_id) : null,
    category_name: String(raw.category?.name || 'Uncategorized'),
    category_slug: String(raw.category?.slug || ''),
    rating: raw.reviews_avg_rating
      ? Number(Number(raw.reviews_avg_rating).toFixed(1))
      : 0,
    reviews_count: Number(raw.reviews_count ?? 0),
    variants,
    specifications: specs,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeOrder(raw: any): OrderRecord {
  const childrenRaw = raw.children || raw.store_orders || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: ChildOrderRecord[] = childrenRaw.map((c: any) => ({
    id: Number(c.id),
    order_number: String(c.order_number || c.id),
    store_id: c.store_id ? Number(c.store_id) : c.store?.id ? Number(c.store.id) : null,
    store: c.store
      ? {
          id: Number(c.store.id),
          name: String(c.store.name),
          slug: String(c.store.slug || c.store.id),
          logo: c.store.logo ?? null,
          is_verified: Boolean(c.store.is_verified),
        }
      : null,
    shipping_method_name: c.shipping_method_name ?? null,
    shipping_carrier: c.shipping_carrier ?? null,
    tracking_number: c.tracking_number ?? null,
    subtotal_amount: Number(c.subtotal_amount ?? 0),
    shipping_amount: Number(c.shipping_amount ?? 0),
    discount_amount: Number(c.discount_amount ?? 0),
    total_amount: Number(c.total_amount ?? 0),
    currency: String(c.currency || 'USD'),
    payment_status: String(c.payment_status || 'pending'),
    status: String(c.status || 'pending'),
    items: Array.isArray(c.items)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        c.items.map((i: any) => ({
          id: Number(i.id),
          product_id: i.product_id ? Number(i.product_id) : null,
          product_name: String(i.product_name || ''),
          product_sku: i.product_sku ?? null,
          unit_price: Number(i.unit_price ?? 0),
          quantity: Number(i.quantity ?? 1),
          subtotal: Number(i.subtotal ?? 0),
          total: Number(i.total ?? 0),
          image:
            i.product?.primary_image?.image_url ||
            i.product?.primaryImage?.image_url ||
            null,
        }))
      : [],
    khqr: c.khqr || c.bakong_transaction || c.bakongTransaction || null,
  }));

  return {
    id: Number(raw.id ?? 0),
    order_number: String(raw.order_number || (raw.id ? raw.id : '')),
    checkout_session_token: raw.checkout_session_token ?? null,
    customer_name: String(raw.customer_name || ''),
    customer_email: String(raw.customer_email || ''),
    customer_phone: String(raw.customer_phone || ''),
    shipping_address: raw.shipping_address || {
      full_name: raw.customer_name || '',
      phone: raw.customer_phone || '',
      address_line_1: '',
      province: '',
    },
    payment_method: String(raw.payment_method || 'bakong_khqr'),
    subtotal_amount: Number(raw.subtotal_amount ?? 0),
    shipping_amount: Number(raw.shipping_amount ?? 0),
    discount_amount: Number(raw.discount_amount ?? 0),
    total_amount: Number(raw.total_amount ?? 0),
    currency: String(raw.currency || 'USD'),
    payment_status: String(raw.payment_status || 'pending'),
    status: String(raw.status || 'pending'),
    notes: raw.notes ?? null,
    created_at: String(raw.created_at || ''),
    children,
    status_histories: raw.status_histories || raw.statusHistories || [],
  };
}

// ==========================================
// API Modules
// ==========================================

export const authApi = {
  async register(payload: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    password_confirmation: string;
    role?: 'customer' | 'store_owner';
    store_name?: string;
    store_description?: string;
    store_address?: string;
    province?: string;
    district?: string;
    commune?: string;
    google_maps_url?: string;
  }) {
    const res = await apiRequest<{ user: UserProfile; token: string }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    return res;
  },

  async login(payload: { identifier: string; password: string }) {
    return apiRequest<
      | {
          requires_verification: true;
          challenge_token: string;
          channel: 'email' | 'phone';
          masked_target: string;
          available_channels: ('email' | 'phone')[];
          expires_in_seconds: number;
        }
      | {
          requires_verification?: false;
          user: UserProfile;
          token: string;
        }
    >('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async verifyLoginOtp(payload: { challenge_token: string; code: string }) {
    return apiRequest<{ user: UserProfile; token: string }>(
      '/auth/login/verify',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },

  async resendLoginOtp(payload: {
    challenge_token: string;
    channel?: 'email' | 'phone';
  }) {
    return apiRequest<{
      requires_verification: true;
      challenge_token: string;
      channel: 'email' | 'phone';
      masked_target: string;
      available_channels: ('email' | 'phone')[];
      expires_in_seconds: number;
    }>('/auth/login/resend', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async logout() {
    return apiRequest<null>('/auth/logout', { method: 'POST' });
  },

  async me() {
    return apiRequest<UserProfile>('/auth/me');
  },

  getGoogleRedirectUrl(): string {
    return `${BACKEND_URL}/api/v1/auth/google/redirect`;
  },

  async googleAuthWithToken(token: string) {
    return apiRequest<{ user: UserProfile; token: string }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  async forgotPassword(email: string) {
    return apiRequest<null>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(payload: {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) {
    return apiRequest<null>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async resendVerification() {
    return apiRequest<null>('/auth/email/verification-notification', {
      method: 'POST',
    });
  },
};

export const catalogApi = {
  async getSettings() {
    return apiRequest<PlatformSettings>('/settings');
  },

  async getCategories() {
    return apiRequest<Category[]>('/categories');
  },

  async getProvinces() {
    return apiRequest<Province[]>('/shipping/provinces');
  },

  async getStores(params?: {
    search?: string;
    verified_only?: boolean;
    per_page?: number;
  }) {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.verified_only) q.set('verified_only', '1');
    if (params?.per_page) q.set('per_page', String(params.per_page));
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await apiRequest<{ data: Store[] } | Store[]>(`/stores${qs}`);
    const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
    return list;
  },

  async getStore(slugOrId: string | number) {
    return apiRequest<Store>(`/stores/${slugOrId}`);
  },

  async getStoreProducts(slugOrId: string | number, perPage = 40) {
    const res = await apiRequest<{
      store: Store;
      products: { data: unknown[] } | unknown[];
    }>(`/stores/${slugOrId}/products?per_page=${perPage}`);
    const rawList = Array.isArray(res.data.products)
      ? res.data.products
      : res.data.products?.data || [];
    return {
      store: res.data.store,
      products: rawList.map(normalizeProduct),
    };
  },

  async getProducts(params?: {
    search?: string;
    category_id?: number;
    category?: string;
    store_id?: number;
    featured?: boolean;
    has_discount?: boolean;
    free_shipping?: boolean;
    verified_only?: boolean;
    in_stock?: boolean;
    min_price?: number;
    max_price?: number;
    sort?: string;
    page?: number;
    per_page?: number;
  }) {
    const q = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '' && v !== false) {
          q.set(k, v === true ? '1' : String(v));
        }
      });
    }
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await apiRequest<{
      data: unknown[];
      current_page?: number;
      last_page?: number;
      total?: number;
    }>(`/products${qs}`);
    const rawList = Array.isArray(res.data) ? res.data : res.data?.data || [];
    return {
      products: rawList.map(normalizeProduct),
      currentPage: Array.isArray(res.data) ? 1 : res.data?.current_page || 1,
      lastPage: Array.isArray(res.data) ? 1 : res.data?.last_page || 1,
      total: Array.isArray(res.data) ? rawList.length : res.data?.total || 0,
    };
  },

  async getProduct(slugOrId: string | number) {
    const res = await apiRequest<unknown>(`/products/${slugOrId}`);
    return normalizeProduct(res.data);
  },

  async getRelatedProducts(productId: number, limit = 5) {
    const res = await apiRequest<unknown[]>(
      `/products/${productId}/related?limit=${limit}`,
    );
    return (Array.isArray(res.data) ? res.data : []).map(normalizeProduct);
  },

  async getPromotions(storeId?: number) {
    const qs = storeId ? `?store_id=${storeId}` : '';
    const res = await apiRequest<Promotion[]>(`/promotions${qs}`);
    return Array.isArray(res.data) ? res.data : [];
  },

  async validateCoupon(
    code: string,
    subtotal?: number,
    storeSubtotals?: Record<number, number>,
  ) {
    const body: Record<string, unknown> = { code };
    if (subtotal !== undefined) body.subtotal = subtotal;
    if (storeSubtotals && Object.keys(storeSubtotals).length > 0) {
      body.store_subtotals = storeSubtotals;
    }
    return apiRequest<AppliedCoupon>('/promotions/validate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

export const cartApi = {
  async getCart() {
    const res = await apiRequest<CartSummary>('/cart');
    return res.data;
  },

  async addItem(payload: {
    product_id: number;
    variant_id?: number | null;
    quantity: number;
  }) {
    const res = await apiRequest<{ cart: CartSummary }>('/cart/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data.cart;
  },

  async updateItem(cartItemId: number, quantity: number) {
    const res = await apiRequest<CartSummary>(`/cart/items/${cartItemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    });
    return res.data;
  },

  async removeItem(cartItemId: number) {
    const res = await apiRequest<CartSummary>(`/cart/items/${cartItemId}`, {
      method: 'DELETE',
    });
    return res.data;
  },

  async removeItems(itemIds: number[]) {
    const res = await apiRequest<CartSummary>('/cart/items/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ item_ids: itemIds }),
    });
    return res.data;
  },

  async clearCart() {
    await apiRequest<null>('/cart/clear', { method: 'DELETE' });
  },

  async syncGuestCart() {
    const res = await apiRequest<CartSummary>('/cart/sync', {
      method: 'POST',
      body: JSON.stringify({ session_id: getGuestSessionId() }),
    });
    return res.data;
  },
};

export const wishlistApi = {
  async getWishlist() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiRequest<any[]>('/wishlist');
    const items = Array.isArray(res.data) ? res.data : [];
    return items
      .map((item) => (item.product ? normalizeProduct(item.product) : null))
      .filter((p): p is Product => Boolean(p));
  },

  async toggle(productId: number) {
    return apiRequest<{ is_in_wishlist: boolean }>('/wishlist/toggle', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId }),
    });
  },
};

export const checkoutApi = {
  async getStoreShippingMethods(storeId: number) {
    const res = await apiRequest<ShippingMethod[]>(
      `/shipping/stores/${storeId}/methods`,
    );
    return Array.isArray(res.data) ? res.data : [];
  },

  async checkout(payload: {
    shipping_address: {
      full_name: string;
      phone: string;
      address_line_1: string;
      address_line_2?: string | null;
      province: string;
      district?: string | null;
      commune?: string | null;
      postal_code?: string | null;
    };
    payment_method: 'bakong_khqr' | 'cod';
    coupon_code?: string | null;
    notes?: string | null;
    shipping_methods?: Record<number, number>;
    cart_item_ids?: number[];
    buy_now_item?: {
      product_id: number;
      variant_id?: number | null;
      quantity: number;
    };
  }) {
    const res = await apiRequest<{ order: unknown }>('/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeOrder(res.data.order);
  },

  async checkBakongStatus(billNumberOrMd5: string) {
    return apiRequest<{
      payment_status: 'pending' | 'successful' | 'expired';
      amount: number;
      currency: string;
      verified_at?: string;
      seconds_remaining?: number;
      order_number?: string;
      parent_order_number?: string;
      parent_order_status?: string;
    }>(`/payments/bakong/${encodeURIComponent(billNumberOrMd5)}/status`);
  },

  async cancelCheckoutSession(sessionToken: string) {
    return apiRequest<null>(
      `/checkout/sessions/${encodeURIComponent(sessionToken)}/cancel`,
      {
        method: 'POST',
      },
    );
  },
};

export const orderApi = {
  async getOrders(perPage = 20) {
    const res = await apiRequest<{ data: unknown[] } | unknown[]>(
      `/orders?per_page=${perPage}`,
    );
    const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
    return list.map(normalizeOrder);
  },

  async getOrder(orderNumberOrId: string | number) {
    const res = await apiRequest<unknown>(`/orders/${orderNumberOrId}`);
    return normalizeOrder(res.data);
  },

  async cancelOrder(
    orderId: number,
    reason: string,
    restoreToCart = false,
  ) {
    return apiRequest<{ cart?: CartSummary } | null>(
      `/orders/${orderId}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({
          reason,
          restore_to_cart: restoreToCart,
        }),
      },
    );
  },

  async getOrderKhqr(orderNumberOrId: string | number, refresh = false) {
    const res = await apiRequest<unknown>(`/orders/${orderNumberOrId}/khqr`, {
      method: 'POST',
      body: JSON.stringify({ refresh }),
    });
    return normalizeOrder(res.data);
  },
};

export const customerApi = {
  async updateProfile(payload: { name?: string; phone?: string | null }) {
    return apiRequest<UserProfile>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async uploadAvatar(file: File) {
    const fd = new FormData();
    fd.append('avatar', file);
    return apiRequest<{ avatar_url: string }>('/users/avatar', {
      method: 'POST',
      body: fd,
      isFormData: true,
    });
  },

  async uploadMedia(
    file: File,
    folder: 'users' | 'reviews' | 'documents' = 'reviews',
  ) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder);
    return apiRequest<{ id: number; secure_url: string }>('/media/upload', {
      method: 'POST',
      body: fd,
      isFormData: true,
    });
  },

  async changePassword(payload: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }) {
    return apiRequest<null>('/users/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async sendVerificationCode(channel: 'email' | 'phone', phone?: string) {
    return apiRequest<{
      channel?: 'email' | 'phone';
      target?: string;
      expires_in_seconds?: number;
      already_verified?: boolean;
    }>('/users/verify/send', {
      method: 'POST',
      body: JSON.stringify({
        channel,
        phone: phone?.trim() || undefined,
      }),
    });
  },

  async confirmVerificationCode(channel: 'email' | 'phone', code: string) {
    return apiRequest<{
      email_verified_at: string | null;
      phone_verified_at: string | null;
      phone: string | null;
    }>('/users/verify/confirm', {
      method: 'POST',
      body: JSON.stringify({ channel, code }),
    });
  },

  async sendContactChangeCode(channel: 'email' | 'phone', value: string) {
    return apiRequest<{
      channel: 'email' | 'phone';
      target: string;
      sent_to?: string;
      expires_in_seconds: number;
    }>('/users/contact/change/send', {
      method: 'POST',
      body: JSON.stringify({ channel, value: value.trim() }),
    });
  },

  async confirmContactChangeCode(channel: 'email' | 'phone', code: string) {
    return apiRequest<UserProfile>('/users/contact/change/confirm', {
      method: 'POST',
      body: JSON.stringify({ channel, code: code.trim() }),
    });
  },

  async sendSecurityActionCode(
    action: 'deactivate' | 'delete',
    channel: 'email' | 'phone',
  ) {
    return apiRequest<{
      action: 'deactivate' | 'delete';
      channel: 'email' | 'phone';
      target: string;
      expires_in_seconds: number;
    }>('/users/security/action-code', {
      method: 'POST',
      body: JSON.stringify({ action, channel }),
    });
  },

  async deactivateAccount(code: string) {
    return apiRequest<null>('/users/deactivate', {
      method: 'POST',
      body: JSON.stringify({ code: code.trim() }),
    });
  },

  async deleteAccount(code: string) {
    return apiRequest<{
      deletion_scheduled_at: string;
      grace_period_days: number;
    }>('/users/delete-account', {
      method: 'DELETE',
      body: JSON.stringify({ code: code.trim() }),
    });
  },

  async getAddresses() {
    const res = await apiRequest<Address[]>('/customer/addresses');
    return Array.isArray(res.data) ? res.data : [];
  },

  async createAddress(payload: Omit<Address, 'id'>) {
    const res = await apiRequest<Address>('/customer/addresses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async updateAddress(id: number, payload: Omit<Address, 'id'>) {
    const res = await apiRequest<Address>(`/customer/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async setDefaultAddress(id: number) {
    return apiRequest<Address>(`/customer/addresses/${id}/default`, {
      method: 'PUT',
    });
  },

  async deleteAddress(id: number) {
    return apiRequest<null>(`/customer/addresses/${id}`, {
      method: 'DELETE',
    });
  },

  async getMyReviews() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiRequest<{ data: any[] } | any[]>('/customer/reviews');
    const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return list.map((r: any): ReviewItem => ({
      id: Number(r.id),
      product_id: Number(r.product_id),
      order_item_id: r.order_item_id ? Number(r.order_item_id) : null,
      product_name: r.product?.name,
      product_image:
        r.product?.primary_image?.image_url ||
        r.product?.primaryImage?.image_url ||
        null,
      author: r.user?.name || 'Customer',
      author_avatar: r.user?.avatar ?? null,
      rating: Number(r.rating),
      title: r.title ?? null,
      comment: String(r.comment || ''),
      is_verified_purchase: Boolean(r.is_verified_purchase),
      created_at: String(r.created_at || ''),
    }));
  },

  async getProductReviews(productId: number) {
    const res = await apiRequest<{
      stats: { total_reviews: number; average_rating: number };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reviews: { data: any[] };
    }>(`/reviews/products/${productId}`);
    const list = res.data?.reviews?.data || [];
    return {
      stats: res.data?.stats || { total_reviews: 0, average_rating: 0 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reviews: list.map((r: any): ReviewItem => ({
        id: Number(r.id),
        product_id: Number(r.product_id),
        author: r.user?.name || 'Customer',
        author_avatar: r.user?.avatar ?? null,
        rating: Number(r.rating),
        title: r.title ?? null,
        comment: String(r.comment || ''),
        is_verified_purchase: Boolean(r.is_verified_purchase),
        created_at: String(r.created_at || ''),
      })),
    };
  },

  async createReview(payload: {
    product_id: number;
    order_item_id?: number | null;
    rating: number;
    title?: string;
    comment: string;
    image_urls?: string[];
  }) {
    return apiRequest<unknown>('/reviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteReview(reviewId: number) {
    return apiRequest<null>(`/reviews/${reviewId}`, {
      method: 'DELETE',
    });
  },

  async getTickets() {
    const res = await apiRequest<{ data: SupportTicket[] } | SupportTicket[]>(
      '/customer/tickets',
    );
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },

  async getTicket(id: number) {
    const res = await apiRequest<SupportTicket>(`/customer/tickets/${id}`);
    return res.data;
  },

  async createTicket(payload: {
    subject?: string;
    message?: string;
    attachments?: string[];
    priority?: 'low' | 'medium' | 'high';
    store_id?: number | null;
    order_id?: number | null;
  }) {
    const res = await apiRequest<SupportTicket>('/customer/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async startConversation(payload: {
    store_id?: number | null;
    order_id?: number | null;
  }) {
    const res = await apiRequest<SupportTicket>('/customer/tickets/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async replyTicket(
    id: number,
    message: string,
    attachments?: string[],
    metadata?: ChatMessageMetadata | null,
  ) {
    return apiRequest<unknown>(`/customer/tickets/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
        metadata: metadata ?? undefined,
      }),
    });
  },

  async bulkTicketAction(
    action: 'mark_read' | 'delete' | 'block' | 'unblock',
    ticketIds: number[],
  ) {
    return apiRequest<{ affected_ids: number[] }>('/customer/tickets/bulk-action', {
      method: 'POST',
      body: JSON.stringify({ action, ticket_ids: ticketIds }),
    });
  },

  async markAllTicketsRead() {
    return apiRequest<null>('/customer/tickets/mark-all-read', {
      method: 'POST',
    });
  },

  async uploadChatImage(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'messages');
    const res = await apiRequest<{ id: number; secure_url: string }>(
      '/media/upload',
      {
        method: 'POST',
        body: fd,
        isFormData: true,
      },
    );
    return res.data.secure_url;
  },

  async getNotifications(limit = 30) {
    const res = await apiRequest<{
      unread_count: number;
      notifications: UserNotificationItem[];
    }>(`/notifications?limit=${limit}`);
    return {
      unread_count: Number(res.data?.unread_count || 0),
      notifications: Array.isArray(res.data?.notifications)
        ? res.data.notifications
        : [],
    };
  },

  async markNotificationRead(id: number) {
    return apiRequest<UserNotificationItem>(`/notifications/${id}/read`, {
      method: 'POST',
    });
  },

  async markAllNotificationsRead() {
    return apiRequest<null>('/notifications/read-all', {
      method: 'POST',
    });
  },

  async deleteNotification(id: number) {
    return apiRequest<null>(`/notifications/${id}`, {
      method: 'DELETE',
    });
  },

  async clearAllNotifications() {
    return apiRequest<null>('/notifications/clear', {
      method: 'DELETE',
    });
  },

  async getMyStoreApplication() {
    const res = await apiRequest<StoreApplication | null>(
      '/store-applications/my',
    );
    return res.data;
  },

  async applyForStore(payload: {
    store_name: string;
    store_description?: string;
    store_address: string;
    province?: string;
    district?: string;
    commune?: string;
    google_maps_url?: string;
    phone: string;
    email: string;
    business_registration_number?: string;
    tax_id?: string;
  }) {
    const res = await apiRequest<StoreApplication>('/store-applications/apply', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },
};

export type { BakongKhqrData };
