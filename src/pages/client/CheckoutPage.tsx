import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FigmaIcon } from '../../components/FigmaIcon';
import { useStore } from '../../context/StoreContext';
import { ApiError, checkoutApi } from '../../services/api';
import { formatRiel } from '../../utils/currency';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { KhqrModal } from '../../components/KhqrModal';
import { CambodiaLocationSelector } from '../../components/CambodiaLocationSelector';
import { CheckoutSkeleton } from '../../components/Skeleton';
import {
  buildBuyNowStoreGroup,
  clearCheckoutSelection,
  computeCouponForSelection,
  filterStoresByCartItemIds,
  readCheckoutSelection,
} from '../../utils/checkoutSelection';
import type {
  Address,
  CartStoreGroup,
  ChildOrderRecord,
  ShippingMethod,
} from '../../types/marketplace';

export function CheckoutPage() {
  const {
    bootstrapping,
    isSignedIn,
    user,
    cart,
    stores,
    addresses,
    addAddress,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    khrRate,
    submitCheckout,
    cancelOrder,
    refreshCart,
    refreshOrders,
    showToast,
  } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get('mode');

  const storedSelection = useMemo(() => {
    void modeParam;
    return readCheckoutSelection();
  }, [modeParam]);

  const buyNowItem =
    storedSelection?.mode === 'buy_now' ? storedSelection.item : null;

  const {
    checkoutStores,
    checkoutTotalItems,
    checkoutSubtotal,
    selectedCartItemIds,
    isBuyNow,
  } = useMemo<{
    checkoutStores: CartStoreGroup[];
    checkoutTotalItems: number;
    checkoutSubtotal: number;
    selectedCartItemIds: number[] | undefined;
    isBuyNow: boolean;
  }>(() => {
    if (buyNowItem) {
      const group = buildBuyNowStoreGroup(buyNowItem);
      return {
        checkoutStores: [group],
        checkoutTotalItems: buyNowItem.quantity,
        checkoutSubtotal: group.store_subtotal,
        selectedCartItemIds: undefined,
        isBuyNow: true,
      };
    }

    if (
      storedSelection?.mode === 'cart_items' &&
      storedSelection.cart_item_ids.length > 0
    ) {
      const idSet = new Set(storedSelection.cart_item_ids);
      const filtered = filterStoresByCartItemIds(cart.stores, idSet);
      const activeIds = filtered.stores.flatMap((g) =>
        g.items.map((item) => item.id),
      );
      return {
        checkoutStores: filtered.stores,
        checkoutTotalItems: filtered.totalItems,
        checkoutSubtotal: filtered.subtotal,
        selectedCartItemIds: activeIds,
        isBuyNow: false,
      };
    }

    return {
      checkoutStores: cart.stores,
      checkoutTotalItems: cart.total_items,
      checkoutSubtotal: cart.total_amount,
      selectedCartItemIds: undefined,
      isBuyNow: false,
    };
  }, [
    buyNowItem,
    storedSelection,
    cart.stores,
    cart.total_items,
    cart.total_amount,
  ]);

  const checkoutStoreIdsKey = checkoutStores.map((g) => g.store.id).join(',');

  const [selectedAddrId, setSelectedAddrId] = useState<number | null>(null);
  const [showAddAddressForm, setShowAddAddressForm] = useState(false);

  const [newAddr, setNewAddr] = useState<Omit<Address, 'id'>>({
    type: 'shipping',
    full_name: user?.name || '',
    phone: user?.phone || '',
    address_line_1: '',
    address_line_2: '',
    province: 'Phnom Penh',
    district: 'Chamkar Mon',
    commune: 'Tonle Basak',
    postal_code: '',
    is_default: addresses.length === 0,
  });

  const [shippingMethodsByStore, setShippingMethodsByStore] = useState<
    Record<number, ShippingMethod[]>
  >({});
  const [selectedMethodByStore, setSelectedMethodByStore] = useState<
    Record<number, number>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [khqrOrders, setKhqrOrders] = useState<ChildOrderRecord[]>([]);
  const [khqrOpen, setKhqrOpen] = useState(false);
  const [checkoutSessionToken, setCheckoutSessionToken] = useState<
    string | null
  >(null);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string | null>(
    null,
  );
  const [couponInput, setCouponInput] = useState(appliedCoupon?.code || '');
  const [couponFeedback, setCouponFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const activeAddress =
    addresses.find((a) => a.id === selectedAddrId) ||
    addresses.find((a) => a.is_default) ||
    addresses[0] ||
    null;

  // Fetch real shipping methods per store in the active checkout selection
  useEffect(() => {
    let active = true;
    const storeIds = checkoutStoreIdsKey
      ? checkoutStoreIdsKey.split(',').map((id) => Number(id))
      : [];
    const loadMethods = async () => {
      const entries = await Promise.all(
        storeIds.map(async (storeId) => {
          try {
            const methods = await checkoutApi.getStoreShippingMethods(storeId);
            return [storeId, methods] as const;
          } catch {
            return [storeId, [] as ShippingMethod[]] as const;
          }
        }),
      );
      if (!active) return;
      const map: Record<number, ShippingMethod[]> = {};
      const defaults: Record<number, number> = {};
      entries.forEach(([storeId, methods]) => {
        map[storeId] = methods;
        if (methods[0]) defaults[storeId] = methods[0].id;
      });
      setShippingMethodsByStore(map);
      setSelectedMethodByStore((prev) => ({ ...defaults, ...prev }));
    };
    if (storeIds.length > 0) void loadMethods();
    return () => {
      active = false;
    };
  }, [checkoutStoreIdsKey]);

  const computeShippingOption = (
    method: ShippingMethod,
    storeSubtotal: number,
    allItemsFreeShipping = false,
  ) => {
    const thresholdRaw = Number(method.free_shipping_threshold ?? 0);
    const threshold = thresholdRaw > 0 ? thresholdRaw : null;

    if (method.calculation_type === 'free') {
      return {
        fee: 0,
        baseFee: 0,
        threshold: null,
        isFreeByThreshold: false,
        isFreeByProduct: false,
      };
    }

    const provinceName = activeAddress?.province?.trim().toLowerCase();
    const regionRate = provinceName
      ? method.rates?.find(
          (r) => r.province && r.province.trim().toLowerCase() === provinceName,
        )
      : undefined;

    const baseFee = Number(
      regionRate?.rate ??
        regionRate?.base_fee ??
        method.base_cost ??
        method.base_fee ??
        0,
    );

    if (allItemsFreeShipping) {
      return {
        fee: 0,
        baseFee,
        threshold,
        isFreeByThreshold: false,
        isFreeByProduct: true,
      };
    }

    if (threshold !== null && storeSubtotal >= threshold) {
      return {
        fee: 0,
        baseFee,
        threshold,
        isFreeByThreshold: true,
        isFreeByProduct: false,
      };
    }

    return {
      fee: baseFee,
      baseFee,
      threshold,
      isFreeByThreshold: false,
      isFreeByProduct: false,
    };
  };

  const subtotal = checkoutSubtotal;
  const shippingByStore = checkoutStores.reduce<Record<number, number>>(
    (acc, g) => {
      const allItemsFree =
        g.all_free_shipping ??
        (g.items.length > 0 && g.items.every((i) => Boolean(i.free_shipping)));
      if (allItemsFree) {
        acc[g.store.id] = 0;
        return acc;
      }
      const methods = shippingMethodsByStore[g.store.id] || [];
      const chosen =
        methods.find((m) => m.id === selectedMethodByStore[g.store.id]) ||
        methods[0];
      if (!chosen) {
        acc[g.store.id] = 0;
        return acc;
      }
      const { fee } = computeShippingOption(
        chosen,
        Number(g.store_subtotal || 0),
        allItemsFree,
      );
      acc[g.store.id] = fee;
      return acc;
    },
    {},
  );
  const estimatedShipping = Object.values(shippingByStore).reduce(
    (sum, fee) => sum + fee,
    0,
  );
  const { eligible: isCouponEligible, discount: effectiveCouponDiscount } =
    computeCouponForSelection(
      appliedCoupon,
      checkoutStores,
      subtotal,
      shippingByStore,
      estimatedShipping,
    );
  const total = Math.max(
    0,
    subtotal + estimatedShipping - effectiveCouponDiscount,
  );

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setApplyingCoupon(true);
    const storeSubtotals: Record<number, number> = {};
    checkoutStores.forEach((g) => {
      storeSubtotals[g.store.id] = g.store_subtotal;
    });
    const res = await applyCoupon(
      couponInput.trim(),
      checkoutStores.length > 0
        ? {
            totalAmount: subtotal,
            storeSubtotals,
          }
        : undefined,
    );
    setCouponFeedback(res);
    setApplyingCoupon(false);
  };

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await addAddress(newAddr);
      setSelectedAddrId(created.id);
      setShowAddAddressForm(false);
      setNewAddr({
        type: 'shipping',
        full_name: user?.name || '',
        phone: user?.phone || '',
        address_line_1: '',
        address_line_2: '',
        province: 'Phnom Penh',
        district: 'Chamkar Mon',
        commune: 'Tonle Basak',
        postal_code: '',
        is_default: false,
      });
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to save address.',
      );
    }
  };

  const handlePurchase = async () => {
    if (!activeAddress) {
      showToast('Please add a delivery address first.');
      setShowAddAddressForm(true);
      return;
    }

    setCheckoutError(null);
    setSubmitting(true);
    try {
      const order = await submitCheckout({
        shipping_address: {
          full_name: activeAddress.full_name,
          phone: activeAddress.phone,
          address_line_1: activeAddress.address_line_1,
          address_line_2: activeAddress.address_line_2,
          province: activeAddress.province,
          district: activeAddress.district,
          commune: activeAddress.commune,
          postal_code: activeAddress.postal_code,
        },
        payment_method: 'bakong_khqr',
        shipping_methods: selectedMethodByStore,
        coupon_code:
          appliedCoupon && isCouponEligible ? appliedCoupon.code : null,
        ...(isBuyNow && buyNowItem
          ? {
              buy_now_item: {
                product_id: buyNowItem.product_id,
                variant_id: buyNowItem.variant_id,
                quantity: buyNowItem.quantity,
              },
            }
          : selectedCartItemIds && selectedCartItemIds.length > 0
            ? { cart_item_ids: selectedCartItemIds }
            : {}),
      });

      const payableChildren = order.children.filter((c) =>
        Boolean(c.khqr?.khqr_payload),
      );
      document.body.style.overflow = 'hidden';
      setCheckoutSessionToken(order.checkout_session_token || null);
      setCreatedOrderId(order.id > 0 ? order.id : null);
      setCreatedOrderNumber(order.order_number || null);
      if (payableChildren.length > 0) {
        setKhqrOrders(payableChildren);
        setKhqrOpen(true);
      } else {
        clearCheckoutSelection();
        showToast(`Order #${order.order_number} created.`);
        navigate(`/account/orders/${order.order_number}`);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "We couldn't complete your checkout right now. Please try again.";
      setCheckoutError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (bootstrapping) {
    return <CheckoutSkeleton />;
  }

  if (!isSignedIn) {
    return (
      <div className="kova-container px-4 py-16 text-center">
        <div className="bg-white border border-[#ececec] p-10 max-w-[520px] mx-auto flex flex-col items-center gap-2.5 sm:gap-3 rounded-[24px]">
          <h1 className="text-[24px] font-semibold text-black">
            Sign in to continue checkout
          </h1>
          <p className="text-[14px] text-[#767676]">
            Your guest cart will sync automatically once you sign in.
          </p>
          <div className="flex gap-3">
            <Link
              to="/login"
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[14px] font-semibold px-6 py-3 rounded-full"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="bg-white border border-[#ececec] text-black text-[14px] font-semibold px-6 py-3 rounded-full"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (checkoutStores.length === 0 && !khqrOpen) {
    return (
      <div className="kova-container px-4 py-16 text-center">
        <div className="bg-white border border-[#ececec] p-10 max-w-[520px] mx-auto flex flex-col items-center gap-2.5 sm:gap-3 rounded-[24px]">
          <h1 className="text-[24px] font-semibold">
            {storedSelection?.mode === 'cart_items'
              ? 'No items selected for checkout'
              : 'Your cart is empty'}
          </h1>
          <p className="text-[14px] text-[#767676]">
            {storedSelection?.mode === 'cart_items'
              ? 'Return to your cart and select the products you want to purchase.'
              : 'Add products to your cart before checking out.'}
          </p>
          <div className="flex flex-wrap gap-3">
            {storedSelection?.mode === 'cart_items' && (
              <Link
                to="/cart"
                className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[14px] font-semibold px-6 py-3 rounded-full transition-colors"
              >
                Back to cart
              </Link>
            )}
            <Link
              to="/products"
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[14px] font-semibold px-6 py-3 rounded-full transition-colors"
            >
              Browse products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kova-container px-4 lg:px-6 pt-5 pb-28 md:pb-12 flex flex-col gap-5">
      <p className="text-[12px] text-[#767676]">
        {isBuyNow && buyNowItem ? (
          <>
            <Link
              to={`/product/${buyNowItem.product_slug}`}
              className="hover:text-[#ff6e20]"
            >
              {buyNowItem.product_name}
            </Link>{' '}
            &nbsp;/&nbsp; Buy Now Checkout
          </>
        ) : (
          <>
            <Link to="/cart" className="hover:text-[#ff6e20]">
              Cart
            </Link>{' '}
            &nbsp;/&nbsp; Checkout
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[32px] font-semibold text-black leading-[1.2]">
              Checkout
            </h1>
            {isBuyNow && (
              <span className="bg-[#ffefe6] text-[#ff6e20] text-[12px] font-semibold px-3 py-1 rounded-full">
                Direct Buy Now
              </span>
            )}
          </div>
          <p className="text-[14px] text-[#767676] mt-1">
            {isBuyNow
              ? 'Checking out only this product — your shopping cart remains untouched.'
              : 'Select your shipping address and delivery option, then complete payment via Bakong KHQR.'}
          </p>
        </div>

        {/* <div className="bg-white border border-[#ececec] rounded-full px-5 py-2.5 flex items-center gap-3 text-[13px]">
          <span className="bg-[#ffefe6] text-[#ff6e20] font-bold px-3 py-1 rounded-full">
            Step {khqrOpen ? '3' : '2'} of 3
          </span>
          <span className="text-[#767676] hidden sm:inline">
            {khqrOpen
              ? 'Bakong KHQR Payment'
              : 'Shipping Address & Delivery Selection'}
          </span>
        </div> */}
      </div>

      {checkoutError && (
        <div className="bg-[#fdecec] border border-[#e5322d]/30 text-[#e5322d] px-5 py-3.5 text-[13.5px] font-medium rounded-[14px]">
          {checkoutError}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-8 items-stretch">
        {/* Left: Shipping Address + Delivery Selection on the SAME page */}
        <div className="flex flex-col gap-6">
          {/* 1. Shipping Address */}
          <section className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-2.5 sm:gap-3 rounded-[24px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-semibold text-black">
                  Shipping address
                </h2>
                <p className="text-[13px] text-[#767676]">
                  Choose where you want your packages delivered.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAddressForm((v) => !v)}
                className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-[13.5px] font-semibold text-black px-4 py-2.5 rounded-full transition-colors"
              >
                {showAddAddressForm ? 'Close form' : 'Add new address'}
              </button>
            </div>

            {addresses.length === 0 ? (
              <p className="text-[13.5px] text-[#767676] bg-[#f7f7f7] p-2.5 rounded-[14px]">
                No saved addresses yet. Click &ldquo;Add new address&rdquo; to
                enter your delivery details.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {addresses.map((addr) => {
                  const selected = addr.id === activeAddress?.id;
                  return (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => setSelectedAddrId(addr.id)}
                      className={`text-left rounded-[16px] p-4 flex flex-col gap-1 transition-all ${
                        selected
                          ? 'bg-[#ffefe6] border border-[#ff6e20]'
                          : 'bg-[#f7f7f7] border border-transparent hover:border-[#ff6e20]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-[14.5px] font-semibold ${
                            selected ? 'text-[#ff6e20]' : 'text-black'
                          }`}
                        >
                          {addr.full_name}
                          {addr.is_default ? ' · Default' : ''}
                        </p>
                        {selected && (
                          <span className="text-[11px] font-semibold bg-[#ff6e20] text-white px-2.5 py-0.5 rounded-full">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] font-medium text-black">
                        {addr.phone}
                      </p>
                      <p className="text-[12.5px] text-[#767676]">
                        {[
                          addr.address_line_1,
                          addr.commune,
                          addr.district,
                          addr.province,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Add Address Form — hidden until user clicks "Add new address" */}
            {showAddAddressForm && (
              <form
                onSubmit={handleSaveNewAddress}
                className="mt-2 pt-5 border-t border-[#ececec] grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-black">
                    Full name
                  </span>
                  <input
                    type="text"
                    required
                    value={newAddr.full_name}
                    onChange={(e) =>
                      setNewAddr({ ...newAddr, full_name: e.target.value })
                    }
                    className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13.5px] outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-black">
                    Phone number
                  </span>
                  <input
                    type="text"
                    required
                    value={newAddr.phone}
                    onChange={(e) =>
                      setNewAddr({ ...newAddr, phone: e.target.value })
                    }
                    placeholder="+855 ..."
                    className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13.5px] outline-none"
                  />
                </label>
                <CambodiaLocationSelector
                  province={newAddr.province}
                  district={newAddr.district || ''}
                  commune={newAddr.commune || ''}
                  onChange={(loc) =>
                    setNewAddr({
                      ...newAddr,
                      province: loc.province,
                      district: loc.district,
                      commune: loc.commune,
                    })
                  }
                  inputClassName="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13.5px] bg-white outline-none"
                  labelClassName="text-[12px] font-medium text-black"
                />

                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-black">
                    Street address
                  </span>
                  <input
                    type="text"
                    required
                    value={newAddr.address_line_1}
                    onChange={(e) =>
                      setNewAddr({ ...newAddr, address_line_1: e.target.value })
                    }
                    placeholder="House #, Street..."
                    className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13.5px] outline-none"
                  />
                </label>
                <div className="sm:col-span-2 flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddAddressForm(false)}
                    className="bg-white border border-[#ececec] hover:border-black text-[13.5px] font-semibold text-black px-5 py-2.5 rounded-full transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13.5px] font-semibold px-6 py-2.5 rounded-full transition-colors"
                  >
                    Save address
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* 2. Delivery Method per Store Package */}
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-[20px] font-semibold text-black">
                Delivery options ({checkoutStores.length} package
                {checkoutStores.length > 1 ? 's' : ''})
              </h2>
              <p className="text-[13px] text-[#767676]">
                Choose your preferred shipping method for each store.
              </p>
            </div>

            {checkoutStores.map((group, idx) => {
              const storeMeta = stores.find((s) => s.id === group.store.id);
              const isVerified = Boolean(
                storeMeta?.is_verified ?? buyNowItem?.store.is_verified,
              );
              const methods = shippingMethodsByStore[group.store.id] || [];
              const chosenId = selectedMethodByStore[group.store.id];

              return (
                <div
                  key={group.store.id}
                  className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-3 rounded-[24px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#ececec]">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-full border border-[#ececec] bg-white overflow-hidden shrink-0 flex items-center justify-center">
                        {group.store.logo ? (
                          <img
                            src={group.store.logo}
                            alt={group.store.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FigmaIcon
                            name="home"
                            className="w-5 h-5 text-[#ff6e20]"
                          />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[15.5px] font-semibold text-black truncate">
                            Package {idx + 1} · {group.store.name}
                          </span>
                          {isVerified && (
                            <VerifiedBadge size="sm" label="Verified store" />
                          )}
                        </div>
                        <p className="text-[12px] text-[#767676]">
                          {group.items.length} item
                          {group.items.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/store/${group.store.slug}`}
                      className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#ff6e20] hover:underline shrink-0"
                    >
                      <span>Visit store</span>
                      <FigmaIcon
                        name="arrow-up-right"
                        className="w-3.5 h-3.5"
                      />
                    </Link>
                  </div>

                  {/* Items */}
                  <div className="flex flex-col gap-3">
                    {group.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3.5">
                        <div className="w-14 h-14 overflow-hidden border border-[#ececec] bg-[#f7f7f7] shrink-0 flex items-center justify-center rounded-[14px]">
                          {item.product_image ? (
                            <img
                              src={item.product_image}
                              alt={item.product_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FigmaIcon
                              name="package"
                              className="w-6 h-6 text-[#979797]"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium text-black truncate">
                            {item.product_name}
                          </p>
                          <p className="text-[12px] text-[#767676]">
                            {item.variant_name ? `${item.variant_name} · ` : ''}
                            Qty {item.quantity}
                          </p>
                        </div>
                        <p className="text-[14.5px] font-semibold text-black shrink-0">
                          ${item.subtotal.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Store Shipping Methods from Backend */}
                  {methods.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {methods.map((m) => {
                        const active = chosenId === m.id;
                        const allItemsFree =
                          group.all_free_shipping ??
                          (group.items.length > 0 &&
                            group.items.every((i) => Boolean(i.free_shipping)));
                        const {
                          fee,
                          baseFee,
                          threshold,
                          isFreeByThreshold,
                          isFreeByProduct,
                        } = computeShippingOption(
                          m,
                          Number(group.store_subtotal || 0),
                          allItemsFree,
                        );
                        const remainingForFree =
                          threshold !== null &&
                          !isFreeByThreshold &&
                          !isFreeByProduct
                            ? Math.max(
                                0,
                                threshold - Number(group.store_subtotal || 0),
                              )
                            : 0;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() =>
                              setSelectedMethodByStore((prev) => ({
                                ...prev,
                                [group.store.id]: m.id,
                              }))
                            }
                            className={`text-left rounded-[14px] p-4 flex flex-col gap-1 transition-all ${
                              active
                                ? 'bg-[#ffefe6] border border-[#ff6e20]'
                                : 'bg-[#f7f7f7] border border-transparent hover:border-[#ececec]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`text-[13.5px] font-semibold ${
                                  active ? 'text-[#ff6e20]' : 'text-black'
                                }`}
                              >
                                {m.name}
                              </span>
                              <span className="text-[13.5px] font-bold shrink-0 flex items-center gap-1.5">
                                {(isFreeByThreshold || isFreeByProduct) &&
                                  baseFee > 0 && (
                                    <span className="text-[12px] font-normal text-[#979797] line-through">
                                      ${baseFee.toFixed(2)}
                                    </span>
                                  )}
                                <span
                                  className={
                                    fee === 0 ? 'text-[#ff6e20]' : 'text-black'
                                  }
                                >
                                  {fee > 0 ? `$${fee.toFixed(2)}` : 'Free'}
                                </span>
                              </span>
                            </div>
                            {(m.estimated_delivery_days || m.description) && (
                              <span className="text-[12px] text-[#767676]">
                                {m.estimated_delivery_days || m.description}
                              </span>
                            )}
                            {isFreeByProduct ? (
                              <span className="text-[11.5px] font-medium text-[#ff6e20]">
                                Free shipping included on your items
                              </span>
                            ) : (
                              threshold !== null && (
                                <span
                                  className={`text-[11.5px] font-medium ${
                                    isFreeByThreshold
                                      ? 'text-[#ff6e20]'
                                      : 'text-[#8a8a8a]'
                                  }`}
                                >
                                  {isFreeByThreshold
                                    ? `Free delivery unlocked (over $${threshold.toFixed(2)})`
                                    : `Free delivery over $${threshold.toFixed(2)} (add $${remainingForFree.toFixed(2)} more)`}
                                </span>
                              )
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[12.5px] text-[#767676] bg-[#f7f7f7] px-4 py-3 rounded-[14px]">
                      Standard store delivery will be applied automatically.
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        </div>

        {/* Right: Order Summary + Fixed-Bottom Action Component (sticky bottom-5) */}
        <aside className="flex flex-col justify-between gap-4">
          <div className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-3 top-[116px] rounded-[24px]">
            <div className="flex items-center justify-between">
              <h2 className="text-[20px] font-semibold text-black">
                Order summary
              </h2>
              <span className="text-[12px] font-medium text-[#767676]">
                {checkoutTotalItems} item{checkoutTotalItems > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1">
              {checkoutStores.map((group) => {
                const storeMeta = stores.find((s) => s.id === group.store.id);
                const isStoreVerified = Boolean(
                  storeMeta?.is_verified ?? buyNowItem?.store.is_verified,
                );
                return (
                  <div key={group.store.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {group.store.logo && (
                          <img
                            src={group.store.logo}
                            alt={group.store.name}
                            className="w-4 h-4 rounded-full object-cover border border-[#ececec] shrink-0"
                          />
                        )}
                        <span className="text-[12px] font-semibold text-black truncate">
                          {group.store.name}
                        </span>
                        {isStoreVerified && <VerifiedBadge size="xs" />}
                      </div>
                      <Link
                        to={`/store/${group.store.slug}`}
                        className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#ff6e20] hover:underline shrink-0"
                      >
                        <span>Visit store</span>
                        <FigmaIcon name="arrow-up-right" className="w-3 h-3" />
                      </Link>
                    </div>
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 text-[12.5px] pl-5"
                      >
                        <span className="text-[#767676] truncate">
                          {item.quantity} × {item.product_name}
                        </span>
                        <span className="font-medium text-black shrink-0">
                          ${item.subtotal.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[#ececec] pt-4 flex flex-col gap-2.5 text-[14px]">
              <div className="flex justify-between">
                <span className="text-[#767676]">Subtotal</span>
                <span className="font-medium text-black">
                  ${subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#767676]">Estimated delivery</span>
                <span className="font-medium text-black">
                  ${estimatedShipping.toFixed(2)}
                </span>
              </div>
              {appliedCoupon && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#767676] flex items-center gap-2 flex-wrap">
                      <span>
                        {appliedCoupon.code}
                        {appliedCoupon.store?.name
                          ? ` (${appliedCoupon.store.name})`
                          : ' discount'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          removeCoupon();
                          setCouponFeedback(null);
                        }}
                        className="text-[11px] text-[#e5322d] hover:underline"
                      >
                        Remove
                      </button>
                    </span>
                    <span
                      className={`font-medium shrink-0 ${
                        effectiveCouponDiscount > 0
                          ? 'text-[#029500]'
                          : 'text-[#8a8a8a]'
                      }`}
                    >
                      {effectiveCouponDiscount > 0
                        ? `−$${effectiveCouponDiscount.toFixed(2)}`
                        : '$0.00'}
                    </span>
                  </div>
                  {appliedCoupon.store_id &&
                    !checkoutStores.some(
                      (g) => g.store.id === appliedCoupon.store_id,
                    ) && (
                      <p className="text-[11.5px] text-[#ff6e20]">
                        This voucher only applies to{' '}
                        {appliedCoupon.store?.name || 'another store'}.
                      </p>
                    )}
                  {appliedCoupon.store_id &&
                    appliedCoupon.min_order_amount &&
                    (() => {
                      const matched = checkoutStores.find(
                        (g) => g.store.id === appliedCoupon.store_id,
                      );
                      if (
                        !matched ||
                        matched.store_subtotal >= appliedCoupon.min_order_amount
                      ) {
                        return null;
                      }
                      const remain =
                        appliedCoupon.min_order_amount - matched.store_subtotal;
                      return (
                        <p className="text-[11.5px] text-[#ff6e20]">
                          Add ${remain.toFixed(2)} more from{' '}
                          {appliedCoupon.store?.name || 'this store'} to
                          activate voucher.
                        </p>
                      );
                    })()}
                </div>
              )}

              <form
                onSubmit={handleApplyCoupon}
                className="flex items-center justify-between h-[42px] bg-white border border-[#ececec] focus-within:border-[#ff6e20] rounded-full pl-4 pr-1 mt-1 transition-colors"
              >
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Enter discount code"
                  className="flex-1 bg-transparent text-[13px] text-black outline-none min-w-0"
                />
                <button
                  type="submit"
                  disabled={applyingCoupon || !couponInput.trim()}
                  className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-50 text-white text-[13px] font-semibold h-[34px] px-4 rounded-full transition-colors shrink-0 cursor-pointer"
                >
                  {applyingCoupon ? '...' : 'Apply'}
                </button>
              </form>

              {couponFeedback && (
                <p
                  className={`text-[12px] ${
                    couponFeedback.ok ? 'text-[#029500]' : 'text-[#e5322d]'
                  }`}
                >
                  {couponFeedback.message}
                </p>
              )}

              <div className="border-t border-[#ececec] pt-3 flex items-baseline justify-between">
                <span className="text-[15px] font-semibold text-black">
                  Total
                </span>
                <div className="text-right">
                  <p className="text-[22px] font-bold text-[#ff6e20] leading-tight">
                    ${total.toFixed(2)}
                  </p>
                  <p className="text-[12px] text-[#767676]">
                    {formatRiel(total, khrRate)}
                  </p>
                </div>
              </div>
            </div>

            {/* <div className="bg-[#f7f7f7] px-4 py-3 flex items-center justify-between gap-3 rounded-[14px]">
              <div>
                <p className="text-[12.5px] font-semibold text-black">
                  Bakong KHQR Payment
                </p>
                <p className="text-[11.5px] text-[#767676]">
                  Secure payment with KHQR
                </p>
              </div>
              <span className="bg-[#E1232E] text-white text-[11px] font-bold px-2.5 py-1 rounded-[6px] tracking-wide">
                KHQR
              </span>
            </div> */}
          </div>

          <div
            className={`${isBuyNow ? 'hidden' : ''} md:sticky md:bottom-5 z-20 bg-white/95 backdrop-blur-md border border-[#ececec] p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.08)] flex flex-col gap-2.5 rounded-[24px]`}
          >
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handlePurchase()}
              className="hidden md:block w-full bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[14.5px] font-semibold py-3.5 px-5 rounded-full transition-colors cursor-pointer"
            >
              {submitting
                ? 'Creating order...'
                : `Purchase - $${total.toFixed(2)}`}
            </button>
            <Link
              to={
                isBuyNow && buyNowItem
                  ? `/product/${buyNowItem.product_slug}`
                  : '/cart'
              }
              className="w-full text-center bg-white border border-[#ececec] hover:border-black text-black text-[14px] font-semibold py-3 px-5 rounded-full transition-colors"
            >
              Return to cart
            </Link>
          </div>
        </aside>
      </div>

      {/* Mobile Sticky Checkout Bar (docked flush above mobile bottom tab bar) */}
      {!khqrOpen &&
        (isBuyNow && buyNowItem
          ? (() => {
              const isBuyNowStoreVerified = Boolean(
                stores.find((s) => s.id === buyNowItem.store.id)?.is_verified ??
                buyNowItem.store.is_verified,
              );
              return (
                <div
                  aria-label="Instant buy checkout bar"
                  className="md:hidden fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-40 bg-white/95 backdrop-blur-[12px] rounded-t-[16px] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2.5 py-2.5 flex items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-[8px] bg-[#f7f7f7] overflow-hidden shrink-0 flex items-center justify-center">
                      {buyNowItem.product_image ? (
                        <img
                          src={buyNowItem.product_image}
                          alt={buyNowItem.product_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FigmaIcon
                          name="package"
                          className="w-5 h-5 text-[#979797]"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <p className="text-[13px] font-semibold text-black leading-snug truncate">
                        {buyNowItem.product_name}
                      </p>
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="w-4 h-4 rounded-full border border-[#ececec] bg-white overflow-hidden shrink-0 flex items-center justify-center">
                          {buyNowItem.store.logo ? (
                            <img
                              src={buyNowItem.store.logo}
                              alt={buyNowItem.store.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FigmaIcon
                              name="home"
                              className="w-2.5 h-2.5 text-[#ff6e20]"
                            />
                          )}
                        </span>
                        <span className="text-[11.5px] font-medium text-[#767676] truncate">
                          {buyNowItem.store.name}
                        </span>
                        {isBuyNowStoreVerified && (
                          <VerifiedBadge size="xs" label="Verified store" />
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handlePurchase()}
                    className="w-[38%] min-w-[132px] max-w-[220px] shrink-0 bg-[#ff6e20] hover:bg-[#e85d12] active:bg-[#d9530c] disabled:opacity-60 text-white px-4 min-h-[44px] py-1.5 rounded-full flex flex-col items-center justify-center leading-tight whitespace-nowrap transition-colors cursor-pointer"
                  >
                    {submitting ? (
                      <span className="text-[12.5px] font-semibold">
                        Ordering...
                      </span>
                    ) : (
                      <>
                        <span className="text-[11.5px] font-semibold leading-tight">
                          Buy Now - ${total.toFixed(2)}
                        </span>
                        {/* <span className="text-[13px] font-bold leading-tight tabular-nums"></span> */}
                      </>
                    )}
                  </button>
                </div>
              );
            })()
          : (() => {
              const [totalDollars, totalCents] = total.toFixed(2).split('.');
              return (
                <div
                  aria-label="Checkout purchase bar"
                  className="md:hidden fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-40 bg-white/95 backdrop-blur-[12px] border-t border-[#ececec] rounded-t-[16px] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 py-2 flex items-center justify-between gap-3"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11.5px] font-medium text-[#767676] leading-tight">
                      Total ({checkoutTotalItems} item
                      {checkoutTotalItems === 1 ? '' : 's'})
                    </span>
                    <div className="mt-0.5 flex items-baseline text-black tabular-nums leading-none">
                      <span className="text-[13px] font-bold mr-0.5">$</span>
                      <span className="text-[20px] font-bold tracking-[-0.02em]">
                        {totalDollars}
                      </span>
                      <span className="text-[13.5px] font-bold">
                        .{totalCents}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handlePurchase()}
                    className="w-[44%] min-w-[136px] max-w-[190px] shrink-0 bg-[#ff6e20] hover:bg-[#e85d12] active:bg-[#d9530c] disabled:opacity-60 text-white min-h-[44px] py-2.5 px-4 rounded-full text-[14.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer"
                  >
                    {submitting ? 'Creating...' : 'Checkout'}
                  </button>
                </div>
              );
            })())}

      {/* Real Bakong KHQR Modal */}
      <KhqrModal
        open={khqrOpen}
        storeOrders={khqrOrders}
        allowBackdropClose={false}
        onCancel={async () => {
          try {
            if (checkoutSessionToken) {
              // Deferred KHQR session: cancel session cleanly without ever creating an Order row!
              await checkoutApi.cancelCheckoutSession(checkoutSessionToken);
              showToast(
                isBuyNow
                  ? 'Payment cancelled.'
                  : 'Payment cancelled. Your items are still in your cart.',
              );
            } else if (createdOrderId) {
              await cancelOrder(
                createdOrderId,
                'Payment cancelled by customer at checkout',
                false,
              );
              await refreshCart();
              showToast(
                isBuyNow
                  ? 'Payment cancelled.'
                  : 'Payment cancelled. Your items are still in your cart.',
              );
            }
          } catch (err) {
            showToast(
              err instanceof ApiError
                ? err.message
                : 'Unable to cancel payment.',
            );
          }
          setKhqrOpen(false);
          setKhqrOrders([]);
          setCheckoutSessionToken(null);
          setCreatedOrderId(null);
          setCreatedOrderNumber(null);
        }}
        onTimeout={(timedOutOrderNumber) => {
          const targetOrder = timedOutOrderNumber || createdOrderNumber;
          clearCheckoutSelection();
          setKhqrOpen(false);
          setCheckoutSessionToken(null);
          showToast(
            'Payment timed out. Your order has been saved as awaiting payment.',
          );
          void refreshOrders().finally(() => {
            navigate(
              targetOrder
                ? `/account/orders?order=${encodeURIComponent(targetOrder)}`
                : '/account/orders',
            );
          });
        }}
        onClose={() => {
          setKhqrOpen(false);
          setCheckoutSessionToken(null);
        }}
        onAllPaid={(paidOrderNumber) => {
          const targetOrder = paidOrderNumber || createdOrderNumber;
          clearCheckoutSelection();
          setKhqrOpen(false);
          setCheckoutSessionToken(null);
          removeCoupon();
          showToast('Payment confirmed! Your order is now processing.');
          void Promise.all([refreshCart(), refreshOrders()]).finally(() => {
            navigate(
              targetOrder
                ? `/account/orders?order=${encodeURIComponent(targetOrder)}`
                : '/account/orders',
            );
          });
        }}
      />
    </div>
  );
}
