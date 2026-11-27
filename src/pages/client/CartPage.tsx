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
      className={`w-5 h-5 rounded-[6px] border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
        checked || indeterminate
          ? 'bg-[#ff6e20] border-[#ff6e20] text-white'
          : 'bg-white border-[#d1d1d6] hover:border-[#ff6e20] text-transparent'
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
    removeMultipleFromCart,
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
  const [deletingSelected, setDeletingSelected] = useState(false);

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

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0 || deletingSelected) return;
    const idsToDelete = [...selectedIds];
    const count = idsToDelete.length;
    confirmDelete({
      title: `Remove ${count} selected item${count === 1 ? '' : 's'}?`,
      description: `The selected item${count === 1 ? '' : 's'} will be removed from your shopping cart.`,
      itemLabel: `${count} cart item${count === 1 ? '' : 's'}`,
      confirmLabel: 'Remove',
      onOptimisticRemove: () => {
        setHiddenCartItemIds((prev) =>
          Array.from(new Set([...prev, ...idsToDelete])),
        );
      },
      onUndo: () => {
        const idSet = new Set(idsToDelete);
        setHiddenCartItemIds((prev) => prev.filter((id) => !idSet.has(id)));
      },
      onCommit: async () => {
        setDeletingSelected(true);
        try {
          await removeMultipleFromCart(idsToDelete);
          const idSet = new Set(idsToDelete);
          setHiddenCartItemIds((prev) => prev.filter((id) => !idSet.has(id)));
        } finally {
          setDeletingSelected(false);
        }
      },
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
    <div className="kova-container px-4 lg:px-6 pt-5 pb-10 flex flex-col gap-[18px]">
      <p className="text-[12px] text-[#767676]">
        Home &nbsp;/&nbsp; Shopping cart
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[32px] sm:text-[36px] font-semibold text-black leading-[1.2]">
            Your cart
          </h1>
          <p className="text-[15px] text-[#767676]">
            {cart.total_items} item{cart.total_items > 1 ? 's' : ''} from{' '}
            {cart.stores.length} store{cart.stores.length > 1 ? 's' : ''}.
            Select by store or item to check out or remove.
          </p>
        </div>

        {selectedIds.length > 0 && (
          <button
            type="button"
            disabled={deletingSelected}
            onClick={() => void handleDeleteSelected()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-[#ececec] text-[13px] font-semibold text-[#e5322d] hover:bg-[#fdecec] hover:border-[#e5322d]/30 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <FigmaIcon name="trash" className="w-3.5 h-3.5" />
            <span>
              {deletingSelected
                ? 'Deleting...'
                : `Delete selected (${selectedIds.length})`}
            </span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-8 items-start">
        {/* Left: Items Grouped by Store */}
        <div className="flex flex-col gap-5">
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
                {/* Store Header with Checkbox + Store Image + Blue Verified Badge + View store */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#ececec]">
                  <div className="flex items-center gap-3 min-w-0">
                    <SelectionCheckbox
                      checked={storeAllSelected}
                      indeterminate={storeSomeSelected}
                      onChange={() => toggleSelectStore(storeItemIds)}
                      label={`Select all items from ${group.store.name}`}
                    />
                    <Link
                      to={`/store/${group.store.slug}`}
                      className="flex items-center gap-3 group min-w-0"
                    >
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
                          <span className="text-[16.5px] font-semibold text-black group-hover:text-[#ff6e20] transition-colors truncate">
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
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#ff6e20] hover:underline shrink-0"
                  >
                    <span>Visit store</span>
                    <FigmaIcon name="arrow-up-right" className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="flex flex-col gap-5">
                  {group.items.map((item) => {
                    const isChecked = selectedSet.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col sm:flex-row gap-4 sm:gap-5 items-start pb-5 border-b border-[#ececec] last:border-b-0 last:pb-0 transition-opacity ${
                          isChecked ? 'opacity-100' : 'opacity-65'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 shrink-0">
                          <SelectionCheckbox
                            checked={isChecked}
                            onChange={() => toggleSelectItem(item.id)}
                            label={`Select ${item.product_name}`}
                          />
                          <Link
                            to={`/product/${item.product_slug}`}
                            className="w-[100px] h-[100px] sm:w-[116px] sm:h-[116px] overflow-hidden shrink-0 border border-[#ececec] bg-[#f7f7f7] flex items-center justify-center rounded-[14px]"
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
                                className="w-8 h-8 text-[#979797]"
                              />
                            )}
                          </Link>
                        </div>

                        <div className="flex-1 flex flex-col gap-1 min-w-0">
                          <Link
                            to={`/product/${item.product_slug}`}
                            className="text-[16.5px] font-medium text-black hover:text-[#ff6e20] leading-[1.4]"
                          >
                            {item.product_name}
                          </Link>
                          <div className="flex items-center gap-1.5 text-[12px] text-[#767676]">
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
                            <p className="text-[13px] text-[#767676]">
                              Variant: {item.variant_name}
                            </p>
                          )}
                          {item.free_shipping && (
                            <p className="text-[12px] font-medium text-[#029500]">
                              Free delivery
                            </p>
                          )}
                          <div className="flex items-center gap-6 text-[12.5px] pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveSingleItem(
                                  item.id,
                                  item.product_name,
                                )
                              }
                              className="text-[#e5322d] hover:underline font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-4">
                          <div className="bg-white border border-[#ececec] px-3.5 py-1.5 flex items-center gap-2.5 sm:gap-3 text-[14px] font-semibold text-black rounded-full">
                            <button
                              type="button"
                              onClick={() =>
                                void updateCartQty(item.id, item.quantity - 1)
                              }
                              className="hover:text-[#ff6e20]"
                            >
                              −
                            </button>
                            <span className="tabular-nums w-4 text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                void updateCartQty(item.id, item.quantity + 1)
                              }
                              className="hover:text-[#ff6e20]"
                            >
                              +
                            </button>
                          </div>
                          <p className="text-[18px] font-semibold text-[#ff6e20]">
                            ${item.subtotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 border-t border-[#ececec] flex items-center justify-between text-[14px]">
                  <span className="text-[#767676]">
                    Selected store subtotal ({selectedStoreCount}/
                    {group.items.length})
                  </span>
                  <span className="font-semibold text-black">
                    ${selectedStoreSubtotal.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Order Summary */}
        <aside className="bg-white border border-[#ececec] p-2.5 sm:p-3 sm:p-7 flex flex-col gap-3 sticky top-[120px] rounded-[24px]">
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
    </div>
  );
}
