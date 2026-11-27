import type { SellerOrderItem } from '../services/dashboardApi';
import type { ChildOrderRecord, OrderRecord } from '../types/marketplace';

/**
 * Convert a customer OrderRecord + store ChildOrderRecord into a SellerOrderItem
 * so customers can generate, download, print, and chat-share the exact same 80mm POS receipt.
 */
export function buildReceiptOrderFromCustomerOrder(
  order: OrderRecord,
  pkg: ChildOrderRecord,
): SellerOrderItem {
  return {
    id: pkg.id,
    store_id: pkg.store_id ?? undefined,
    order_number: order.order_number,
    parent_order_number: order.order_number,
    child_order_number: pkg.order_number,
    customer_name:
      order.customer_name || order.shipping_address?.full_name || 'Customer',
    customer_email: order.customer_email,
    customer_phone: order.customer_phone || order.shipping_address?.phone,
    shipping_address: order.shipping_address,
    shipping_method_name: pkg.shipping_method_name ?? null,
    shipping_carrier: pkg.shipping_carrier ?? null,
    tracking_number: pkg.tracking_number ?? null,
    subtotal_amount: pkg.subtotal_amount,
    shipping_amount: pkg.shipping_amount,
    discount_amount: pkg.discount_amount,
    total_amount: pkg.total_amount,
    currency: pkg.currency || order.currency || 'USD',
    payment_method: order.payment_method,
    payment_status: pkg.payment_status || order.payment_status,
    status: pkg.status || order.status,
    created_at: order.created_at,
    items: (pkg.items || []).map((item) => ({
      id: item.id,
      product_name: item.product_name,
      product_sku: item.product_sku ?? null,
      unit_price: item.unit_price,
      quantity: item.quantity,
      total: item.total,
    })),
  };
}
