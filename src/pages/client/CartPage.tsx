import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FigmaIcon } from '../../components/FigmaIcon';
import { useStore } from '../../context/StoreContext';
import { useConfirmDelete } from '../../context/ConfirmDeleteContext';
import { formatRiel } from '../../utils/currency';
import { CartSkeleton } from '../../components/Skeleton';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import {
  computeCouponForSelection,
  filterStoresByCartItemIds,
  saveCheckoutSelection,
} from '../../utils/checkoutSelection';

function SelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={onChange}
      className={`w-[22px] h-[22px] rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
        checked || indeterminate
          ? 'bg-[#ff6e20] border-[#ff6e20] text-white'
          : 'bg-white border-[#c7c7cc] hover:border-[#ff6e20] text-transparent'
      }`}
    >
      {indeterminate ? (
        <FigmaIcon name="minus" className="w-3.5 h-3.5" />
      ) : (
        <FigmaIcon name="check" className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

export function CartPage() {
  const navigate = useNavigate();
  const {
    bootstrapping,
    cart,
    khrRate,
    stores,
    updateCartQty,
    removeFromCart,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    showToast,
  } = useStore();
  const { confirmDelete } = useConfirmDelete();
  const [hiddenCartItemIds, setHiddenCartItemIds] = useState<number[]>([]);

  const [couponInput, setCouponInput] = useState(appliedCoupon?.code || '');
  const [couponFeedback, setCouponFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [applying, setApplying] = useState(false);

  // Track explicitly unchecked cart item IDs so all items default to selected
  // and removed/added items stay synchronized automatically without effects.
  const [deselectedIds, setDeselectedIds] = useState<number[]>([]);

  const visibleCartStores = useMemo(() => {
    if (hiddenCartItemIds.length === 0) return cart.stores;
    const hidden = new Set(hiddenCartItemIds);
    return cart.stores
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => !hidden.has(item.id)),
      }))
      .filter((g) => g.items.length > 0);
  }, [cart.stores, hiddenCartItemIds]);

  const allItemIds = useMemo(
    () => visibleCartStores.flatMap((g) => g.items.map((item) => item.id)),
    [visibleCartStores],
  );

  const selectedIds = useMemo(() => {
    const deselectedSet = new Set(deselectedIds);
    return allItemIds.filter((id) => !deselectedSet.has(id));
  }, [allItemIds, deselectedIds]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const {
    stores: selectedStores,
    totalItems: selectedTotalQty,
    subtotal: selectedSubtotal,
  } = useMemo(
    () => filterStoresByCartItemIds(visibleCartStores, selectedSet),
    [visibleCartStores, selectedSet],
  );

  const { discount: selectedCouponDiscount } = useMemo(
    () =>
      computeCouponForSelection(
        appliedCoupon,
        selectedStores,
        selectedSubtotal,
      ),
    [appliedCoupon, selectedStores, selectedSubtotal],
  );

  const total = Math.max(0, selectedSubtotal - selectedCouponDiscount);
  const allSelected =
    allItemIds.length > 0 && selectedIds.length === allItemIds.length;
  const someSelected =
    selectedIds.length > 0 && selectedIds.length < allItemIds.length;
  const [totalDollars, totalCents] = total.toFixed(2).split('.');

  const toggleSelectAll = () => {
    if (allSelected) {
      setDeselectedIds(allItemIds);
    } else {
      setDeselectedIds([]);
    }
  };

  const toggleSelectStore = (storeItemIds: number[]) => {
    const storeAllSelected =
      storeItemIds.length > 0 &&
      storeItemIds.every((id) => selectedSet.has(id));

    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (storeAllSelected) {
        storeItemIds.forEach((id) => next.add(id));
      } else {
        storeItemIds.forEach((id) => next.delete(id));
      }
      return Array.from(next);
    });
  };

  const toggleSelectItem = (itemId: number) => {
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return Array.from(next);
    });
  };

  const handleRemoveSingleItem = (itemId: number, itemName: string) => {
    confirmDelete({
      title: 'Remove item from cart?',
      description: `"${itemName}" will be removed from your shopping cart.`,
      itemLabel: itemName,
      confirmLabel: 'Remove',
      onOptimisticRemove: () => {
        setHiddenCartItemIds((prev) =>
          prev.includes(itemId) ? prev : [...prev, itemId],
        );
      },
      onUndo: () => {
        setHiddenCartItemIds((prev) => prev.filter((id) => id !== itemId));
      },
      onCommit: async () => {
        await removeFromCart(itemId);
        setHiddenCartItemIds((prev) => prev.filter((id) => id !== itemId));
      },
    });
  };

  const handleProceedToCheckout = () => {
    if (selectedIds.length === 0) {
      showToast('Please select at least one product to checkout.');
      return;
    }
    saveCheckoutSelection({
      mode: 'cart_items',
      cart_item_ids: selectedIds,
    });
    navigate('/checkout');
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setApplying(true);
    const storeSubtotals: Record<number, number> = {};
    selectedStores.forEach((g) => {
      storeSubtotals[g.store.id] = g.store_subtotal;
    });
    const res = await applyCoupon(
      couponInput.trim(),
      selectedStores.length > 0
        ? {
            totalAmount: selectedSubtotal,
            storeSubtotals,
          }
        : undefined,
    );
    setCouponFeedback(res);
    setApplying(false);
  };

  if (bootstrapping) {
    return <CartSkeleton />;
  }

  if (visibleCartStores.length === 0) {
    return (
      <div className="kova-container px-4 lg:px-6 pt-5 pb-12 flex flex-col gap-5">
        <p className="text-[12px] text-[#767676]">
          Home &nbsp;/&nbsp; Shopping cart
        </p>
        <div className="bg-white border border-[#ececec] py-16 px-6 flex flex-col items-center text-center gap-2.5 sm:gap-3 rounded-[24px]">
          <div className="w-16 h-16 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
            <FigmaIcon name="shopping-bag" className="w-8 h-8" />
          </div>
          <h1 className="text-[30px] font-semibold text-black">
            Your cart is empty
          </h1>
          <p className="text-[15px] text-[#767676] max-w-[420px]">
            Add products from Kova stores to begin checkout.
          </p>
          <div className="flex flex-row items-center justify-center gap-2.5 sm:gap-3 mt-2 w-full">
            <Link
              to="/products"
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13.5px] sm:text-[14px] font-semibold px-5 sm:px-6 py-2.5 sm:py-3 rounded-full whitespace-nowrap transition-colors"
            >
              Explore products
            </Link>
            <Link
              to="/wishlist"
              className="bg-white border border-[#ececec] hover:bg-[#f7f7f7] text-black text-[13.5px] sm:text-[14px] font-semibold px-5 sm:px-6 py-2.5 sm:py-3 rounded-full whitespace-nowrap transition-colors"
            >
              View wishlist
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kova-container px-2.5 sm:px-4 lg:px-6 pt-4 sm:pt-5 pb-28 md:pb-10 flex flex-col gap-3.5 sm:gap-[18px]">
      <p className="text-[12px] text-[#767676]">
        Home &nbsp;/&nbsp; Shopping cart
      </p>
      <div className="flex flex-col gap-0.5 sm:gap-1">
        <h1 className="text-[24px] sm:text-[34px] font-semibold text-black leading-[1.2]">
          Your cart
        </h1>
        <p className="text-[13px] sm:text-[15px] text-[#767676]">
          {cart.total_items} item{cart.total_items > 1 ? 's' : ''} from{' '}
          {cart.stores.length} store{cart.stores.length > 1 ? 's' : ''}.
          Select by store or item to check out.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-6 sm:gap-8 items-start">
        {/* Left: Items Grouped by Store */}
        <div className="flex flex-col gap-3.5 sm:gap-5">
          {visibleCartStores.map((group) => {
            const storeMeta = stores.find((s) => s.id === group.store.id);
            const isVerified = Boolean(storeMeta?.is_verified);
            const storeItemIds = group.items.map((item) => item.id);
            const selectedStoreCount = storeItemIds.filter((id) =>
              selectedSet.has(id),
            ).length;
            const storeAllSelected =
              storeItemIds.length > 0 &&
              selectedStoreCount === storeItemIds.length;
            const storeSomeSelected =
              selectedStoreCount > 0 &&
              selectedStoreCount < storeItemIds.length;
            const selectedStoreSubtotal =
              Math.round(
                group.items
                  .filter((item) => selectedSet.has(item.id))
                  .reduce((sum, item) => sum + Number(item.subtotal || 0), 0) *
                  100,
              ) / 100;

            return (
              <div
                key={group.store.id}
                className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-3 rounded-[24px]"
              >
                {/* Store Header with Circular Checkbox + Store Image + Blue Verified Badge + Visit store */}
                <div className="flex items-center justify-between gap-2 pb-3 sm:pb-4 border-b border-[#ececec]">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <SelectionCheckbox
                      checked={storeAllSelected}
                      indeterminate={storeSomeSelected}
                      onChange={() => toggleSelectStore(storeItemIds)}
                      label={`Select all items from ${group.store.name}`}
                    />
                    <Link
                      to={`/store/${group.store.slug}`}
                      className="flex items-center gap-2 sm:gap-3 group min-w-0"
                    >
                      <span className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-[#ececec] bg-white overflow-hidden shrink-0 flex items-center justify-center">
                        {group.store.logo ? (
                          <img
                            src={group.store.logo}
                            alt={group.store.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FigmaIcon
                            name="home"
                            className="w-4 h-4 sm:w-5 sm:h-5 text-[#ff6e20]"
                          />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[14.5px] sm:text-[16.5px] font-semibold text-black group-hover:text-[#ff6e20] transition-colors truncate">
                            {group.store.name}
                          </span>
                          {isVerified && (
                            <VerifiedBadge size="sm" label="Verified store" />
                          )}
                        </div>
                      </div>
                    </Link>
                  </div>
                  <Link
                    to={`/store/${group.store.slug}`}
                    className="inline-flex items-center gap-1 text-[12px] sm:text-[13px] font-semibold text-[#ff6e20] hover:underline shrink-0 whitespace-nowrap"
                  >
                    <span>Visit store</span>
                    <FigmaIcon name="arrow-up-right" className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="flex flex-col gap-3.5 sm:gap-5">
                  {group.items.map((item) => {
                    const isChecked = selectedSet.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`flex items-start gap-2.5 sm:gap-4 pb-3.5 sm:pb-5 border-b border-[#ececec] last:border-b-0 last:pb-0 transition-opacity ${
                          isChecked ? 'opacity-100' : 'opacity-65'
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
                          <SelectionCheckbox
                            checked={isChecked}
                            onChange={() => toggleSelectItem(item.id)}
                            label={`Select ${item.product_name}`}
                          />
                          <Link
                            to={`/product/${item.product_slug}`}
                            className="w-[84px] h-[84px] sm:w-[116px] sm:h-[116px] overflow-hidden shrink-0 border border-[#ececec] bg-[#f7f7f7] flex items-center justify-center rounded-[14px]"
                          >
                            {item.product_image ? (
                              <img
                                src={item.product_image}
                                alt={item.product_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <FigmaIcon
                                name="package"
                                className="w-7 h-7 sm:w-8 sm:h-8 text-[#979797]"
                              />
                            )}
                          </Link>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              to={`/product/${item.product_slug}`}
                              className="text-[13.5px] sm:text-[16.5px] font-medium text-black hover:text-[#ff6e20] leading-[1.35] line-clamp-2 min-w-0"
                            >
                              {item.product_name}
                            </Link>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveSingleItem(
                                  item.id,
                                  item.product_name,
                                )
                              }
                              aria-label={`Remove ${item.product_name}`}
                              className="sm:hidden shrink-0 p-1 -mr-1 -mt-0.5 text-[#979797] hover:text-[#e5322d] transition-colors cursor-pointer"
                            >
                              <FigmaIcon name="trash" className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-[#767676]">
                            {group.store.logo && (
                              <img
                                src={group.store.logo}
                                alt=""
                                className="w-4 h-4 rounded-full object-cover border border-[#ececec]"
                              />
                            )}
                            <span>{group.store.name}</span>
                            {isVerified && <VerifiedBadge size="xs" />}
                          </div>

                          {item.variant_name && (
                            <p className="text-[11.5px] sm:text-[13px] text-[#767676] truncate">
                              Variant: {item.variant_name}
                            </p>
                          )}

                          {item.free_shipping && (
                            <p className="text-[11.5px] sm:text-[12px] font-medium text-[#029500]">
                              Free delivery
                            </p>
                          )}

                          <div className="mt-1 sm:mt-1.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-4 min-w-0">
                              <p className="text-[15.5px] sm:text-[18px] font-bold sm:font-semibold text-[#ff6e20] tabular-nums">
                                ${item.subtotal.toFixed(2)}
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveSingleItem(
                                    item.id,
                                    item.product_name,
                                  )
                                }
                                className="hidden sm:inline text-[12.5px] text-[#e5322d] hover:underline font-medium cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>

                            <div className="bg-white border border-[#ececec] px-2.5 sm:px-3.5 py-1 sm:py-1.5 flex items-center gap-2 sm:gap-3 text-[13px] sm:text-[14px] font-semibold text-black rounded-full shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  void updateCartQty(item.id, item.quantity - 1)
                                }
                                aria-label="Decrease quantity"
                                className="w-5 h-5 flex items-center justify-center hover:text-[#ff6e20] cursor-pointer"
                              >
                                −
                              </button>
                              <span className="tabular-nums min-w-[16px] text-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  void updateCartQty(item.id, item.quantity + 1)
                                }
                                aria-label="Increase quantity"
                                className="w-5 h-5 flex items-center justify-center hover:text-[#ff6e20] cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 sm:pt-4 border-t border-[#ececec] flex items-center justify-between text-[13px] sm:text-[14px]">
                  <span className="text-[#767676]">
                    Selected store subtotal ({selectedStoreCount}/
                    {group.items.length})
                  </span>
                  <span className="font-semibold text-black tabular-nums">
                    ${selectedStoreSubtotal.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Order Summary (Desktop & Tablet only — mobile uses docked bottom bar) */}
        <aside className="hidden md:flex bg-white border border-[#ececec] p-2.5 sm:p-3 sm:p-7 flex-col gap-3 sticky top-[120px] rounded-[24px]">
          <h2 className="text-[24px] font-semibold text-black">
            Order summary
          </h2>

          <div className="flex flex-col gap-3 text-[14px]">
            <div className="flex items-center justify-between">
              <span className="text-[#767676]">
                Subtotal ({selectedTotalQty} selected item
                {selectedTotalQty === 1 ? '' : 's'})
              </span>
              <span className="font-medium text-black">
                ${selectedSubtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#767676]">Shipping</span>
              <span className="text-[#767676]">Calculated at checkout</span>
            </div>
            {appliedCoupon && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#767676] flex items-center gap-2 flex-wrap">
                    <span>
                      {appliedCoupon.code}
                      {appliedCoupon.store?.name
                        ? ` (${appliedCoupon.store.name} only)`
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
                  {appliedCoupon.discount_type === 'free_shipping' ? (
                    <span className="font-medium text-[#029500] shrink-0">
                      Free delivery
                    </span>
                  ) : (
                    <span
                      className={`font-medium shrink-0 ${
                        selectedCouponDiscount > 0
                          ? 'text-[#029500]'
                          : 'text-[#8a8a8a]'
                      }`}
                    >
                      {selectedCouponDiscount > 0
                        ? `−$${selectedCouponDiscount.toFixed(2)}`
                        : '$0.00'}
                    </span>
                  )}
                </div>
                {appliedCoupon.store_id &&
                  !selectedStores.some(
                    (g) => g.store.id === appliedCoupon.store_id,
                  ) && (
                    <p className="text-[11.5px] text-[#ff6e20]">
                      Select products from{' '}
                      {appliedCoupon.store?.name || 'this store'} to use this
                      voucher.
                    </p>
                  )}
                {appliedCoupon.store_id &&
                  appliedCoupon.min_order_amount &&
                  (() => {
                    const matched = selectedStores.find(
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
                        Select ${remain.toFixed(2)} more from{' '}
                        {appliedCoupon.store?.name || 'this store'} to activate
                        voucher.
                      </p>
                    );
                  })()}
              </div>
            )}
          </div>

          <form
            onSubmit={handleApplyCoupon}
            className="flex items-center justify-between h-[48px] bg-white border border-[#ececec] rounded-full pl-4 pr-1"
          >
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder="Enter promotion code"
              className="flex-1 bg-transparent text-[14px] text-black outline-none min-w-0"
            />
            <button
              type="submit"
              disabled={applying || selectedIds.length === 0}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[14px] font-semibold h-[40px] px-5 rounded-full transition-colors shrink-0"
            >
              {applying ? '...' : 'Apply'}
            </button>
          </form>

          {couponFeedback && (
            <p
              className={`text-[12px] -mt-2 ${
                couponFeedback.ok ? 'text-[#029500]' : 'text-[#e5322d]'
              }`}
            >
              {couponFeedback.message}
            </p>
          )}

          <div className="border-t border-[#ececec] pt-4 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[16px]">
              <span className="text-[#767676]">Estimated total</span>
              <span className="font-bold text-[22px] text-black">
                ${total.toFixed(2)}
              </span>
            </div>
            <p className="text-[13px] text-[#767676]">
              {formatRiel(total, khrRate)}
            </p>
          </div>

          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={handleProceedToCheckout}
            className="w-full text-center bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white text-[14px] font-semibold py-3.5 px-5 rounded-[25px] cursor-pointer"
          >
            {selectedIds.length === 0
              ? 'Select items to checkout'
              : `Proceed to checkout (${selectedTotalQty})`}
          </button>
        </aside>
      </div>

      {/* Mobile Sticky Cart Checkout Bar (docked flush above mobile bottom tab bar) */}
      <div
        aria-label="Cart checkout bar"
        className="md:hidden fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-40 bg-white/95 backdrop-blur-[12px] border-t border-[#ececec] rounded-t-[16px] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 py-2 flex items-center justify-between gap-3"
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={someSelected ? 'mixed' : allSelected}
          aria-label="Select all cart items"
          onClick={toggleSelectAll}
          className="inline-flex items-center gap-2 shrink-0 py-1 cursor-pointer select-none"
        >
          <span
            className={`w-[22px] h-[22px] rounded-full border-[1.5px] flex items-center justify-center transition-colors ${
              allSelected || someSelected
                ? 'bg-[#ff6e20] border-[#ff6e20] text-white'
                : 'bg-white border-[#c7c7cc] text-transparent'
            }`}
          >
            {someSelected ? (
              <FigmaIcon name="minus" className="w-3.5 h-3.5" />
            ) : (
              <FigmaIcon name="check" className="w-3.5 h-3.5" />
            )}
          </span>
          <span className="text-[14px] font-medium text-[#1c1c1e]">All</span>
        </button>

        <div className="flex items-center justify-end gap-3 flex-1 min-w-0">
          <div className="flex items-baseline text-black tabular-nums leading-none shrink-0">
            <span className="text-[13px] font-bold mr-0.5">$</span>
            <span className="text-[20px] font-bold tracking-[-0.02em]">
              {totalDollars}
            </span>
            <span className="text-[13.5px] font-bold">.{totalCents}</span>
          </div>

          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={handleProceedToCheckout}
            className="w-[44%] min-w-[132px] max-w-[190px] shrink-0 bg-[#ff6e20] hover:bg-[#e85d12] active:bg-[#d9530c] disabled:opacity-45 disabled:cursor-not-allowed text-white min-h-[44px] py-2.5 px-4 rounded-full text-[14.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer"
          >
            {selectedTotalQty > 0
              ? `Checkout (${selectedTotalQty})`
              : 'Checkout'}
          </button>
        </div>
      </div>
    </div>
  );
}
