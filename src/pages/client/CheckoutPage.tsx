import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FigmaIcon } from '../../components/FigmaIcon';
import { useStore } from '../../context/StoreContext';
import { ApiError, checkoutApi } from '../../services/api';
import { formatRiel } from '../../utils/currency';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { KhqrModal } from '../../components/KhqrModal';
import { CambodiaLocationSelector } from '../../components/CambodiaLocationSelector';
import type {
  Address,
  ChildOrderRecord,
  ShippingMethod,
} from '../../types/marketplace';

export function CheckoutPage() {
  const {
    isSignedIn,
    user,
    cart,
    stores,
    addresses,
    addAddress,
    appliedCoupon,
    couponDiscount,
    khrRate,
    submitCheckout,
    cancelOrder,
    refreshOrders,
    showToast,
  } = useStore();
  const navigate = useNavigate();

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
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string | null>(
    null,
  );

  const activeAddress =
    addresses.find((a) => a.id === selectedAddrId) ||
    addresses.find((a) => a.is_default) ||
    addresses[0] ||
    null;

  // Fetch real shipping methods per store in cart
  useEffect(() => {
    let active = true;
    const loadMethods = async () => {
      const entries = await Promise.all(
        cart.stores.map(async (g) => {
          try {
            const methods = await checkoutApi.getStoreShippingMethods(
              g.store.id,
            );
            return [g.store.id, methods] as const;
          } catch {
            return [g.store.id, [] as ShippingMethod[]] as const;
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
    if (cart.stores.length > 0) void loadMethods();
    return () => {
      active = false;
    };
  }, [cart.stores]);

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

  const subtotal = cart.total_amount;
  const estimatedShipping = cart.stores.reduce((sum, g) => {
    const allItemsFree =
      g.all_free_shipping ??
      (g.items.length > 0 && g.items.every((i) => Boolean(i.free_shipping)));
    if (allItemsFree) return sum;
    const methods = shippingMethodsByStore[g.store.id] || [];
    const chosen =
      methods.find((m) => m.id === selectedMethodByStore[g.store.id]) ||
      methods[0];
    if (!chosen) return sum;
    const { fee } = computeShippingOption(
      chosen,
      Number(g.store_subtotal || 0),
      allItemsFree,
    );
    return sum + fee;
  }, 0);
  const total = Math.max(0, subtotal + estimatedShipping - couponDiscount);

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
      });

      const payableChildren = order.children.filter((c) =>
        Boolean(c.khqr?.khqr_payload),
      );
      setCreatedOrderId(order.id);
      setCreatedOrderNumber(order.order_number);
      if (payableChildren.length > 0) {
        setKhqrOrders(payableChildren);
        setKhqrOpen(true);
      } else {
        showToast(`Order #${order.order_number} created.`);
        navigate(`/account/orders/${order.order_number}`);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Checkout failed. Ensure the store has Bakong configured.';
      setCheckoutError(msg);
      showToast(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSignedIn) {
    return (
      <div className="kova-container px-4 py-16 text-center">
        <div className="bg-white border border-[#ececec] rounded-[24px] p-10 max-w-[520px] mx-auto flex flex-col items-center gap-4">
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

  if (cart.stores.length === 0 && !khqrOpen) {
    return (
      <div className="kova-container px-4 py-16 text-center">
        <div className="bg-white border border-[#ececec] rounded-[24px] p-10 max-w-[520px] mx-auto flex flex-col items-center gap-4">
          <h1 className="text-[24px] font-semibold">Your cart is empty</h1>
          <p className="text-[14px] text-[#767676]">
            Add products to your cart before checking out.
          </p>
          <Link
            to="/products"
            className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[14px] font-semibold px-6 py-3 rounded-full transition-colors"
          >
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="kova-container px-4 lg:px-6 pt-5 pb-12 flex flex-col gap-5">
      <p className="text-[12px] text-[#767676]">
        <Link to="/cart" className="hover:text-[#ff6e20]">
          Cart
        </Link>{' '}
        &nbsp;/&nbsp; Checkout
      </p>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold text-black leading-[1.2]">
            Checkout
          </h1>
          <p className="text-[14px] text-[#767676] mt-1">
            Select your shipping address and delivery option, then complete
            payment via Bakong KHQR.
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
        <div className="bg-[#fdecec] border border-[#e5322d]/30 text-[#e5322d] rounded-[16px] px-5 py-3.5 text-[13.5px] font-medium">
          {checkoutError}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-8 items-stretch">
        {/* Left: Shipping Address + Delivery Selection on the SAME page */}
        <div className="flex flex-col gap-6">
          {/* 1. Shipping Address */}
          <section className="bg-white border border-[#ececec] rounded-[20px] p-6 flex flex-col gap-4">
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
              <p className="text-[13.5px] text-[#767676] bg-[#f7f7f7] rounded-[14px] p-4">
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
                    className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
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
                    className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
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
                  inputClassName="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] bg-white outline-none"
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
                    className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
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
                Delivery options ({cart.stores.length} package
                {cart.stores.length > 1 ? 's' : ''})
              </h2>
              <p className="text-[13px] text-[#767676]">
                Choose your preferred shipping method for each store.
              </p>
            </div>

            {cart.stores.map((group, idx) => {
              const storeMeta = stores.find((s) => s.id === group.store.id);
              const isVerified = Boolean(storeMeta?.is_verified);
              const methods = shippingMethodsByStore[group.store.id] || [];
              const chosenId = selectedMethodByStore[group.store.id];

              return (
                <div
                  key={group.store.id}
                  className="bg-white border border-[#ececec] rounded-[20px] p-6 flex flex-col gap-5"
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
                      className="text-[13px] font-semibold text-[#ff6e20] hover:underline shrink-0"
                    >
                      View store
                    </Link>
                  </div>

                  {/* Items */}
                  <div className="flex flex-col gap-3">
                    {group.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3.5">
                        <div className="w-14 h-14 rounded-[12px] overflow-hidden border border-[#ececec] bg-[#f7f7f7] shrink-0 flex items-center justify-center">
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
                                    fee === 0 ? 'text-[#029500]' : 'text-black'
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
                              <span className="text-[11.5px] font-medium text-[#029500]">
                                Free shipping included on your items
                              </span>
                            ) : (
                              threshold !== null && (
                                <span
                                  className={`text-[11.5px] font-medium ${
                                    isFreeByThreshold
                                      ? 'text-[#029500]'
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
                    <p className="text-[12.5px] text-[#767676] bg-[#f7f7f7] rounded-[12px] px-4 py-3">
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
          <div className="bg-white border border-[#ececec] rounded-[20px] p-6 flex flex-col gap-5 top-[116px]">
            <div className="flex items-center justify-between">
              <h2 className="text-[20px] font-semibold text-black">
                Order summary
              </h2>
              <span className="text-[12px] font-medium text-[#767676]">
                {cart.total_items} item{cart.total_items > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1">
              {cart.stores.map((group) => {
                const storeMeta = stores.find((s) => s.id === group.store.id);
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
                        {storeMeta?.is_verified && <VerifiedBadge size="xs" />}
                      </div>
                      <Link
                        to={`/store/${group.store.slug}`}
                        className="text-[11.5px] font-semibold text-[#ff6e20] hover:underline shrink-0"
                      >
                        View store
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
              {appliedCoupon && couponDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#767676]">
                    Voucher ({appliedCoupon.code})
                  </span>
                  <span className="font-medium text-[#029500]">
                    −${couponDiscount.toFixed(2)}
                  </span>
                </div>
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

            <div className="bg-[#f7f7f7] rounded-[14px] px-4 py-3 flex items-center justify-between gap-3">
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
            </div>
          </div>

          <div className="sticky bottom-5 z-20 bg-white/95 backdrop-blur-md border border-[#ececec] rounded-[20px] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)] flex flex-col gap-2.5">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handlePurchase()}
              className="w-full bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[14.5px] font-semibold py-3.5 px-5 rounded-full transition-colors"
            >
              {submitting ? 'Creating order...' : 'Purchase'}
            </button>
            <Link
              to="/cart"
              className="w-full text-center bg-white border border-[#ececec] hover:border-black text-black text-[14px] font-semibold py-3 px-5 rounded-full transition-colors"
            >
              Return to cart
            </Link>
          </div>
        </aside>
      </div>

      {/* Real Bakong KHQR Modal */}
      <KhqrModal
        open={khqrOpen}
        storeOrders={khqrOrders}
        allowBackdropClose={false}
        onCancel={async () => {
          if (createdOrderId) {
            try {
              await cancelOrder(
                createdOrderId,
                'Payment cancelled by customer at checkout',
                true,
              );
              setKhqrOpen(false);
              setKhqrOrders([]);
              setCreatedOrderId(null);
              setCreatedOrderNumber(null);
              navigate('/cart');
              return;
            } catch (err) {
              showToast(
                err instanceof ApiError
                  ? err.message
                  : 'Unable to cancel payment.',
              );
            }
          }
          setKhqrOpen(false);
          navigate('/cart');
        }}
        onTimeout={() => {
          setKhqrOpen(false);
          showToast(
            'Payment timed out. Your order has been saved as awaiting payment.',
          );
          void refreshOrders().finally(() => {
            navigate(
              createdOrderNumber
                ? `/account/orders/${createdOrderNumber}`
                : '/account/orders',
            );
          });
        }}
        onClose={() => {
          setKhqrOpen(false);
          void refreshOrders();
          navigate(
            createdOrderNumber
              ? `/account/orders/${createdOrderNumber}`
              : '/account/orders',
          );
        }}
        onAllPaid={() => {
          setKhqrOpen(false);
          showToast('Payment confirmed! Your order is now processing.');
          void refreshOrders().finally(() => {
            navigate(
              createdOrderNumber
                ? `/account/orders/${createdOrderNumber}`
                : '/account/orders',
            );
          });
        }}
      />
    </div>
  );
}
