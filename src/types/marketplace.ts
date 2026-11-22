export interface PlatformSettings {
  site_name?: string;
  currency?: string;
  khr_exchange_rate?: number;
  exchange_rate_khr?: number;
  services?: {
    google_oauth_enabled: boolean;
    cloudinary_enabled: boolean;
    bakong_environment: string;
  };
  [key: string]: unknown;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  image?: string | null;
  parent_id?: number | null;
  children?: Category[];
  products_count?: number;
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
  logo?: string | null;
  products_count?: number;
}

export interface Province {
  id: number;
  name: string;
  khmer_name?: string | null;
  code?: string | null;
}

export interface Store {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  logo?: string | null;
  banner?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  status: string;
  is_verified: boolean;
  policies?: string | null;
  products_count?: number;
  reviews_count?: number;
  shipping_methods?: ShippingMethod[];
}

export interface ProductVariant {
  id: number;
  name: string;
  sku?: string | null;
  price: number;
  stock_quantity: number;
  image_url?: string | null;
  attributes?: Record<string, string> | null;
}

export interface Product {
  id: number;
  slug: string;
  sku?: string | null;
  name: string;
  description?: string | null;
  short_description?: string | null;
  regular_price: number;
  discount_price: number | null;
  price: number;
  discount_percent: number;
  stock_quantity: number;
  in_stock: boolean;
  is_featured: boolean;
  free_shipping: boolean;
  has_free_delivery: boolean;
  image: string | null;
  gallery: string[];
  store_id: number;
  store_name: string;
  store_slug: string;
  store_logo: string | null;
  store_verified: boolean;
  category_id: number | null;
  category_name: string;
  category_slug: string;
  brand_id: number | null;
  brand_name: string;
  rating: number;
  reviews_count: number;
  variants: ProductVariant[];
  specifications: Record<string, string>;
}

export interface CartItem {
  id: number;
  product_id: number;
  product_name: string;
  product_slug: string;
  product_image: string | null;
  variant_id: number | null;
  variant_name: string | null;
  unit_price: number;
  quantity: number;
  subtotal: number;
  stock_available: number;
  free_shipping?: boolean;
}

export interface CartStoreGroup {
  store: {
    id: number;
    name: string;
    slug: string;
    logo: string | null;
  };
  items: CartItem[];
  store_subtotal: number;
  all_free_shipping?: boolean;
}

export interface CartSummary {
  cart_id: number | null;
  total_items: number;
  total_amount: number;
  stores: CartStoreGroup[];
}

export interface ShippingRate {
  id: number;
  province?: string;
  rate?: number | string;
  base_fee?: number | string;
  free_shipping_threshold?: number | string | null;
  estimated_days?: string | null;
}

export interface ShippingMethod {
  id: number;
  store_id: number | null;
  name: string;
  description?: string | null;
  calculation_type?: 'fixed' | 'weight_based' | 'free' | 'distance_based';
  base_cost?: number | string;
  cost_per_kg?: number | string | null;
  free_shipping_threshold?: number | string | null;
  estimated_delivery_days?: string | null;
  base_fee?: number | string;
  rates?: ShippingRate[];
}

export interface PromotionStoreInfo {
  id: number;
  name: string;
  slug: string;
  logo?: string | null;
  is_verified?: boolean;
}

export interface Promotion {
  id: number;
  store_id: number | null;
  code: string;
  name: string;
  description?: string | null;
  discount_type: 'percentage' | 'fixed_amount' | 'free_shipping';
  discount_value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  end_date?: string | null;
  store?: PromotionStoreInfo | null;
}

export interface AppliedCoupon {
  id: number;
  store_id?: number | null;
  store?: PromotionStoreInfo | null;
  code: string;
  name: string;
  discount_type: 'percentage' | 'fixed_amount' | 'free_shipping';
  discount_value: number;
  min_order_amount?: number | null;
  max_discount_amount: number | null;
}

export interface BakongKhqrData {
  bill_number: string;
  amount: number;
  currency: string;
  khqr_payload: string;
  qr_md5: string;
  expires_at: string;
  payment_status: string;
}

export interface OrderItemRecord {
  id: number;
  product_id: number | null;
  product_name: string;
  product_sku?: string | null;
  unit_price: number;
  quantity: number;
  subtotal: number;
  total: number;
  image?: string | null;
}

export interface ChildOrderRecord {
  id: number;
  order_number: string;
  store_id: number | null;
  store: {
    id: number;
    name: string;
    slug: string;
    logo: string | null;
    is_verified?: boolean;
  } | null;
  shipping_method_name?: string | null;
  shipping_carrier?: string | null;
  tracking_number?: string | null;
  subtotal_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  payment_status: string;
  status: string;
  items: OrderItemRecord[];
  khqr?: BakongKhqrData | null;
}

export interface OrderRecord {
  id: number;
  order_number: string;
  checkout_session_token?: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: {
    full_name: string;
    phone: string;
    address_line_1: string;
    address_line_2?: string | null;
    province: string;
    district?: string | null;
    commune?: string | null;
  };
  payment_method: string;
  subtotal_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  payment_status: string;
  status: string;
  notes?: string | null;
  created_at: string;
  children: ChildOrderRecord[];
  status_histories?: {
    id: number;
    status: string;
    notes?: string | null;
    created_at: string;
  }[];
}

export interface Address {
  id: number;
  type: 'shipping' | 'billing' | 'both';
  full_name: string;
  phone: string;
  address_line_1: string;
  address_line_2?: string | null;
  province: string;
  district?: string | null;
  commune?: string | null;
  postal_code?: string | null;
  is_default: boolean;
}

export interface ReviewItem {
  id: number;
  product_id: number;
  order_item_id?: number | null;
  product_name?: string;
  product_image?: string | null;
  author: string;
  author_avatar?: string | null;
  rating: number;
  title?: string | null;
  comment: string;
  is_verified_purchase: boolean;
  created_at: string;
}

export interface SupportTicketMessage {
  id: number;
  message: string;
  attachments?: string[] | null;
  is_admin_reply: boolean;
  created_at: string;
  user?: { id: number; name: string; avatar?: string | null } | null;
}

export interface SupportTicket {
  id: number;
  ticket_number: string;
  user_id?: number;
  store_id?: number | null;
  order_id?: number | null;
  subject: string;
  message: string;
  attachments?: string[] | null;
  priority: string;
  status: string;
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
  latest_message?: SupportTicketMessage | null;
  messages?: SupportTicketMessage[];
}

export interface UserNotificationItem {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body?: string | null;
  avatar_url?: string | null;
  action_url?: string | null;
  data?: {
    ticket_id?: number;
    store_id?: number;
    order_id?: number;
    order_number?: string | null;
    total_amount?: number;
    payment_method?: string;
    sender_name?: string | null;
  } | null;
  read_at?: string | null;
  created_at: string;
}

export interface StoreApplication {
  id: number;
  store_name: string;
  store_description?: string | null;
  store_address: string;
  phone: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  email_verified_at: string | null;
  phone_verified_at?: string | null;
  created_at?: string | null;
  status?: string;
  roles: string[];
  store?: Store | null;
  store_application?: StoreApplication | null;
}
