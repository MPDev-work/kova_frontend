import type { AppliedCoupon, CartStoreGroup } from '../types/marketplace';

export interface BuyNowItemPayload {
  product_id: number;
  variant_id: number | null;
  quantity: number;
  product_name: string;
  product_slug: string;
  product_image: string | null;
  variant_name: string | null;
  unit_price: number;
  free_shipping: boolean;
  store: {
    id: number;
    name: string;
    slug: string;
    logo: string | null;
    is_verified?: boolean;
  };
}

export type CheckoutSelection =
  | {
      mode: 'buy_now';
      item: BuyNowItemPayload;
    }
  | {
      mode: 'cart_items';
      cart_item_ids: number[];
    };

const STORAGE_KEY = 'kova_checkout_selection';

export function saveCheckoutSelection(selection: CheckoutSelection): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Ignore storage quota errors
  }
}

export function readCheckoutSelection(): CheckoutSelection | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutSelection;
    if (
      parsed &&
      parsed.mode === 'buy_now' &&
      parsed.item &&
      Number(parsed.item.product_id) > 0
    ) {
      return parsed;
    }
    if (
      parsed &&
      parsed.mode === 'cart_items' &&
      Array.isArray(parsed.cart_item_ids)
    ) {
      return {
        mode: 'cart_items',
        cart_item_ids: parsed.cart_item_ids
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearCheckoutSelection(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function buildBuyNowStoreGroup(
  item: BuyNowItemPayload,
): CartStoreGroup {
  const lineSubtotal = Math.round(item.unit_price * item.quantity * 100) / 100;
  return {
    store: {
      id: item.store.id,
      name: item.store.name,
      slug: item.store.slug,
      logo: item.store.logo,
    },
    items: [
      {
        id: -item.product_id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_slug: item.product_slug,
        product_image: item.product_image,
        variant_id: item.variant_id,
        variant_name: item.variant_name,
        unit_price: item.unit_price,
        quantity: item.quantity,
        subtotal: lineSubtotal,
        stock_available: item.quantity,
        free_shipping: item.free_shipping,
      },
    ],
    store_subtotal: lineSubtotal,
    all_free_shipping: item.free_shipping,
  };
}

export function filterStoresByCartItemIds(
  stores: CartStoreGroup[],
  selectedIds: Set<number>,
): {
  stores: CartStoreGroup[];
  totalItems: number;
  subtotal: number;
} {
  const filtered: CartStoreGroup[] = [];
  let totalItems = 0;
  let subtotal = 0;

  for (const group of stores) {
    const pickedItems = group.items.filter((i) => selectedIds.has(i.id));
    if (pickedItems.length === 0) continue;

    const groupSubtotal =
      Math.round(
        pickedItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0) *
          100,
      ) / 100;
    const allFree = pickedItems.every((i) => Boolean(i.free_shipping));
    const groupQty = pickedItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0,
    );

    filtered.push({
      ...group,
      items: pickedItems,
      store_subtotal: groupSubtotal,
      all_free_shipping: allFree,
    });
    totalItems += groupQty;
    subtotal += groupSubtotal;
  }

  return {
    stores: filtered,
    totalItems,
    subtotal: Math.round(subtotal * 100) / 100,
  };
}

export function computeCouponForSelection(
  appliedCoupon: AppliedCoupon | null,
  activeStores: CartStoreGroup[],
  activeSubtotal: number,
  shippingByStore?: Record<number, number>,
  totalShipping = 0,
): { eligible: boolean; discount: number } {
  if (!appliedCoupon || activeStores.length === 0) {
    return { eligible: false, discount: 0 };
  }

  let eligibleSubtotal = activeSubtotal;

  if (appliedCoupon.store_id) {
    const targetGroup = activeStores.find(
      (g) => g.store.id === appliedCoupon.store_id,
    );
    if (!targetGroup) {
      return { eligible: false, discount: 0 };
    }
    eligibleSubtotal = Number(targetGroup.store_subtotal || 0);
    if (
      appliedCoupon.min_order_amount &&
      eligibleSubtotal < appliedCoupon.min_order_amount
    ) {
      return { eligible: false, discount: 0 };
    }
  } else if (
    appliedCoupon.min_order_amount &&
    activeSubtotal < appliedCoupon.min_order_amount
  ) {
    return { eligible: false, discount: 0 };
  }

  if (appliedCoupon.discount_type === 'free_shipping') {
    const waived = appliedCoupon.store_id
      ? shippingByStore?.[appliedCoupon.store_id] || 0
      : totalShipping;
    const discount =
      appliedCoupon.max_discount_amount && appliedCoupon.max_discount_amount > 0
        ? Math.min(waived, appliedCoupon.max_discount_amount)
        : waived;
    return { eligible: true, discount: Math.round(discount * 100) / 100 };
  }

  let discount = 0;
  if (appliedCoupon.discount_type === 'percentage') {
    discount = (eligibleSubtotal * appliedCoupon.discount_value) / 100;
  } else if (appliedCoupon.discount_type === 'fixed_amount') {
    discount = appliedCoupon.discount_value;
  }

  if (
    appliedCoupon.max_discount_amount &&
    appliedCoupon.max_discount_amount > 0
  ) {
    discount = Math.min(discount, appliedCoupon.max_discount_amount);
  }

  discount = Math.min(discount, eligibleSubtotal);
  return { eligible: true, discount: Math.round(discount * 100) / 100 };
}
