import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { FigmaIcon } from '../../components/FigmaIcon';
import { DashboardModal, StatusPill } from '../../components/DashboardPrimitives';
import { useStore } from '../../context/StoreContext';
import { ApiError, customerApi, orderApi } from '../../services/api';
import { formatShortDate } from '../../utils/currency';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { KhqrModal } from '../../components/KhqrModal';
import { OrderStatusStepper } from '../../components/OrderStatusStepper';
import { PosOrderReceiptModal } from '../../components/PosOrderReceiptModal';
import { buildReceiptOrderFromCustomerOrder } from '../../utils/posReceipt';
import { savePendingChatCard } from '../../utils/chatContextCard';
import type {
  ChatContextCard,
  ChildOrderRecord,
  OrderItemRecord,
  OrderRecord,
  ReviewItem,
} from '../../types/marketplace';

const STATUS_FILTERS = [
  'all',
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
] as const;

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
};

function buildOrderChatCard(
  order: OrderRecord,
  pkg: ChildOrderRecord,
): ChatContextCard {
  const firstItem = pkg.items[0];
  const totalQty = pkg.items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    kind: 'order',
    order_id: order.id,
    order_number: order.order_number,
    order_status: pkg.status || order.status,
    total_amount: pkg.total_amount,
    item_count: totalQty || firstItem?.quantity || 1,
    product_id: firstItem?.product_id ?? null,
    product_name:
      firstItem?.product_name || `Order #${order.order_number}`,
    product_image: firstItem?.image ?? null,
    quantity: firstItem?.quantity ?? null,
    unit_price: firstItem?.unit_price ?? null,
    store_name: pkg.store?.name ?? null,
  };
}

interface ReviewTarget {
  orderItemId: number;
  productId: number;
  productName: string;
  productImage?: string | null;
  storeName?: string | null;
}

function isOrderReviewable(status: string): boolean {
  return status === 'completed' || status === 'delivered';
}

function findItemReview(
  reviews: ReviewItem[],
  item: OrderItemRecord,
): ReviewItem | undefined {
  return reviews.find(
    (r) =>
      (r.order_item_id && r.order_item_id === item.id) ||
      (item.product_id !== null && r.product_id === item.product_id),
  );
}

function ProductReviewModal({
  target,
  onClose,
}: {
  target: ReviewTarget | null;
  onClose: () => void;
}) {
  const { addReview, showToast } = useStore();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const displayRating = hoverRating ?? rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    if (comment.trim().length < 5) {
      showToast('Please write at least 5 characters for your review.');
      return;
    }
    setSubmitting(true);
    try {
      await addReview({
        product_id: target.productId,
        order_item_id: target.orderItemId,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim(),
      });
      onClose();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to submit review.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardModal
      open={Boolean(target)}
      onClose={onClose}
      title="Write a product review"
      subtitle="Share your experience to help other Kova shoppers."
      widthClass="max-w-[540px]"
      footer={
        <button
          type="submit"
          form="order-product-review-form"
          disabled={submitting}
          className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full transition-colors"
        >
          {submitting ? 'Submitting...' : 'Submit review'}
        </button>
      }
    >
      {target && (
        <form
          id="order-product-review-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <div className="bg-[#f7f7f7] border border-[#ececec] p-3 flex items-center gap-3 rounded-[14px]">
            <div className="w-12 h-12 rounded-[10px] overflow-hidden border border-[#ececec] bg-white shrink-0 flex items-center justify-center">
              {target.productImage ? (
                <img
                  src={target.productImage}
                  alt={target.productName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <FigmaIcon name="package" className="w-5 h-5 text-[#979797]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-black truncate">
                {target.productName}
              </p>
              {target.storeName && (
                <p className="text-[12px] text-[#767676] truncate">
                  Sold by {target.storeName}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-black">
                Your rating
              </span>
              <span className="text-[12px] font-semibold text-[#ff6e20]">
                {displayRating}/5 · {RATING_LABELS[displayRating]}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  onClick={() => setRating(star)}
                  aria-label={`Rate ${star} out of 5`}
                  className={`text-[30px] leading-none transition-transform hover:scale-110 ${
                    star <= displayRating ? 'text-[#ff6e20]' : 'text-[#dfdfdf]'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-black">
              Review title{' '}
              <span className="font-normal text-[#8a8a8a]">(optional)</span>
            </span>
            <input
              type="text"
              maxLength={255}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summarize your experience..."
              className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] text-black outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-black">
              Your review
            </span>
            <textarea
              required
              minLength={5}
              maxLength={2000}
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share what you liked about product quality, packaging, and delivery..."
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] text-black outline-none resize-none"
            />
          </label>
        </form>
      )}
    </DashboardModal>
  );
}

export function MyOrdersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    orders,
    reviews,
    refreshOrders,
    refreshReviews,
    refreshCart,
    khrRate,
    showToast,
  } = useStore();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(
    () => searchParams.get('order'),
  );
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<{
    order: OrderRecord;
    pkg: ChildOrderRecord;
  } | null>(null);
  const [khqrOrders, setKhqrOrders] = useState<ChildOrderRecord[]>([]);
  const [loadingKhqrOrderId, setLoadingKhqrOrderId] = useState<number | null>(
    null,
  );
  const [activeKhqrOrderId, setActiveKhqrOrderId] = useState<number | null>(
    null,
  );
  const [cancelledKhqrOrderIds, setCancelledKhqrOrderIds] = useState<
    Record<number, boolean>
  >({});

  const selectedOrder = useMemo(
    () =>
      selectedOrderNumber
        ? orders.find(
            (o) =>
              o.order_number === selectedOrderNumber ||
              String(o.id) === selectedOrderNumber,
          ) || null
        : null,
    [orders, selectedOrderNumber],
  );

  const openOrderModal = (orderNumber: string) => {
    setSelectedOrderNumber(orderNumber);
  };

  const closeOrderModal = () => {
    setSelectedOrderNumber(null);
    if (searchParams.has('order')) {
      const next = new URLSearchParams(searchParams);
      next.delete('order');
      setSearchParams(next, { replace: true });
    }
  };

  const handleSendReceiptToSeller = async (receiptImageFile: File) => {
    if (!receiptTarget) return;
    const { order, pkg } = receiptTarget;
    const storeId = pkg.store_id ?? pkg.store?.id ?? null;
    try {
      const receiptUrl = await customerApi.uploadChatImage(
        receiptImageFile,
        'standard',
      );
      const ticket = await customerApi.startConversation({
        store_id: storeId,
        order_id: order.id,
      });
      await customerApi.replyTicket(
        ticket.id,
        `Order receipt for #${order.order_number}`,
        [receiptUrl],
        {
          context_card: buildOrderChatCard(order, pkg),
        },
      );
      showToast('Receipt sent to seller in chat.');
      setReceiptTarget(null);
      closeOrderModal();
      navigate(`/help/tickets?chat=${ticket.id}`);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to send receipt to seller.',
      );
      throw err;
    }
  };

  const handleResumeKhqr = async (order: OrderRecord) => {
    setLoadingKhqrOrderId(order.id);
    try {
      const shouldRestartTimeout = Boolean(cancelledKhqrOrderIds[order.id]);
      const freshOrder = await orderApi.getOrderKhqr(
        order.id,
        shouldRestartTimeout,
      );
      if (shouldRestartTimeout) {
        setCancelledKhqrOrderIds((prev) => {
          const next = { ...prev };
          delete next[order.id];
          return next;
        });
      }
      const payable = freshOrder.children.filter(
        (c) => c.khqr?.khqr_payload && c.khqr.payment_status !== 'successful',
      );
      if (payable.length > 0) {
        setActiveKhqrOrderId(order.id);
        setKhqrOrders(payable);
      } else {
        showToast('No pending KHQR payment found for this order.');
        void refreshOrders();
      }
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to load Bakong KHQR payment.',
      );
    } finally {
      setLoadingKhqrOrderId(null);
    }
  };

  useEffect(() => {
    void refreshOrders();
    void refreshReviews();
  }, [refreshOrders, refreshReviews]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const orderQuery = q.replace(/^#/, '');
        return (
          o.order_number.toLowerCase().includes(orderQuery) ||
          `#${o.order_number.toLowerCase()}`.includes(q) ||
          o.children.some((c) => c.store?.name.toLowerCase().includes(q)) ||
          o.children.some((c) =>
            c.items.some((i) => i.product_name.toLowerCase().includes(q)),
          )
        );
      }
      return true;
    });
  }, [orders, statusFilter, query]);

  const statusColor = (status: string) => {
    if (status === 'pending') return 'text-[#ff6e20]';
    if (status === 'cancelled') return 'text-[#e5322d]';
    return 'text-[#029500]';
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black leading-[1.35]">
            Order history
          </h1>
          <p className="text-[12.5px] text-[#767676] mt-0.5">
            View orders, check Bakong KHQR payment status, and manage
            cancellations.
          </p>
        </div>
        <Link
          to="/products"
          className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4 py-2 rounded-full transition-colors"
        >
          Continue shopping
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-medium">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={`px-3.5 py-1.5 rounded-full capitalize transition-colors ${
              statusFilter === f
                ? 'bg-[#ff6e20] text-white font-semibold'
                : 'bg-white border border-[#ececec] text-[#767676] hover:text-black'
            }`}
          >
            {f === 'all' ? 'All orders' : f}
          </button>
        ))}
      </div>

      <div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by order number, store, or product..."
          className="h-[42px] bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] text-black outline-none w-full max-w-[460px]"
        />
      </div>

      <section className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-3.5 rounded-[24px]">
        <h2 className="text-[16px] font-semibold text-black">
          Orders ({filtered.length})
        </h2>

        {filtered.length === 0 ? (
          <div className="py-10 text-center flex flex-col items-center gap-2">
            <FigmaIcon name="package" className="w-8 h-8 text-[#979797]" />
            <p className="text-[14.5px] font-semibold text-black">
              No orders yet
            </p>
            <p className="text-[13px] text-[#767676]">
              Orders placed at checkout will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((order, idx) => {
              const pendingKhqr = order.children.filter(
                (c) =>
                  c.khqr?.khqr_payload &&
                  c.khqr.payment_status !== 'successful',
              );
              const unreviewedTargets: ReviewTarget[] = order.children.flatMap(
                (pkg) => {
                  if (
                    !isOrderReviewable(pkg.status) &&
                    !isOrderReviewable(order.status)
                  ) {
                    return [];
                  }
                  return pkg.items
                    .filter(
                      (item) =>
                        item.product_id !== null &&
                        !findItemReview(reviews, item),
                    )
                    .map((item) => ({
                      orderItemId: item.id,
                      productId: item.product_id as number,
                      productName: item.product_name,
                      productImage: item.image,
                      storeName: pkg.store?.name,
                    }));
                },
              );
              return (
                <div
                  key={order.id}
                  className={`rounded-[14px] p-4 grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)_150px_110px_185px] gap-3 items-center ${
                    idx % 2 === 0
                      ? 'bg-[#f7f7f7]'
                      : 'bg-white border border-[#ececec]'
                  }`}
                >
                  <p className="text-[13.5px] font-semibold text-black">
                    #{order.order_number}
                  </p>
                  <div className="text-[12.5px] text-[#767676] min-w-0">
                    <p>{formatShortDate(order.created_at)}</p>
                    <p className="truncate">
                      {order.children
                        .map((c) => c.store?.name || 'Store')
                        .join(' + ')}
                    </p>
                  </div>
                  <div
                    className={`text-[12.5px] font-semibold capitalize ${statusColor(order.status)}`}
                  >
                    <p>
                      {order.status === 'pending' &&
                      order.payment_status === 'pending'
                        ? 'Awaiting payment'
                        : order.status}
                    </p>
                    <p className="opacity-80 font-medium">
                      Payment:{' '}
                      {order.status === 'pending' &&
                      order.payment_status === 'pending'
                        ? 'pending'
                        : order.payment_status}
                    </p>
                  </div>
                  <div>
                    <p className="text-[14.5px] font-bold text-[#ff6e20]">
                      ${order.total_amount.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex md:justify-end gap-2">
                    {order.status === 'pending' &&
                      order.payment_status !== 'paid' &&
                      (pendingKhqr.length > 0 ||
                        order.payment_method === 'bakong_khqr') && (
                        <button
                          type="button"
                          disabled={loadingKhqrOrderId === order.id}
                          onClick={() => void handleResumeKhqr(order)}
                          className="bg-[#E1232E] hover:bg-[#c51b25] disabled:opacity-60 text-white text-[12px] font-semibold px-3.5 py-2 rounded-full"
                        >
                          {loadingKhqrOrderId === order.id
                            ? 'Loading...'
                            : 'Pay KHQR'}
                        </button>
                      )}
                    {unreviewedTargets.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (unreviewedTargets.length === 1) {
                            setReviewTarget(unreviewedTargets[0]);
                          } else {
                            openOrderModal(order.order_number);
                          }
                        }}
                        className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12px] font-semibold px-3.5 py-2 rounded-full transition-colors"
                      >
                        Review
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openOrderModal(order.order_number)}
                      className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-[12px] font-semibold text-black px-3.5 py-2 rounded-full cursor-pointer"
                    >
                      Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Customer Order Detail Modal */}
      <DashboardModal
        open={Boolean(selectedOrder)}
        onClose={closeOrderModal}
        title={selectedOrder ? `Order #${selectedOrder.order_number}` : ''}
        subtitle={
          selectedOrder
            ? `Placed ${formatShortDate(selectedOrder.created_at)} · Status: ${
                selectedOrder.status === 'pending' &&
                selectedOrder.payment_status === 'pending'
                  ? 'Awaiting payment'
                  : selectedOrder.status
              } · Payment: ${selectedOrder.payment_status}`
            : undefined
        }
        widthClass="max-w-[820px]"
        footer={
          selectedOrder &&
          selectedOrder.status === 'pending' &&
          (selectedOrder.payment_status === 'pending' ||
            (selectedOrder.payment_status !== 'paid' &&
              selectedOrder.payment_method === 'bakong_khqr')) ? (
            <>
              {selectedOrder.payment_status === 'pending' && (
                <Link
                  to={`/account/orders/${selectedOrder.id}/cancel`}
                  onClick={closeOrderModal}
                  className="bg-white border border-[#ececec] hover:border-[#e5322d] hover:text-[#e5322d] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full transition-colors"
                >
                  Cancel order
                </Link>
              )}
              {selectedOrder.payment_status !== 'paid' &&
                selectedOrder.payment_method === 'bakong_khqr' && (
                  <button
                    type="button"
                    disabled={loadingKhqrOrderId === selectedOrder.id}
                    onClick={() => {
                      closeOrderModal();
                      void handleResumeKhqr(selectedOrder);
                    }}
                    className="bg-[#E1232E] hover:bg-[#c51b25] disabled:opacity-60 text-white text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors"
                  >
                    {loadingKhqrOrderId === selectedOrder.id
                      ? 'Loading KHQR...'
                      : 'Pay with KHQR'}
                  </button>
                )}
            </>
          ) : undefined
        }
      >
        {selectedOrder && (
          <div className="flex flex-col gap-5">
            <OrderStatusStepper
              status={selectedOrder.status}
              paymentStatus={selectedOrder.payment_status}
              paymentMethod={selectedOrder.payment_method}
            />
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_270px] gap-5 items-start">
            <div className="flex flex-col gap-3.5">
              {selectedOrder.children.map((pkg, idx) => (
                <div
                  key={pkg.id}
                  className="bg-white border border-[#ececec] p-2.5 flex flex-col gap-3.5 rounded-[24px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#ececec]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-full border border-[#ececec] bg-white overflow-hidden shrink-0 flex items-center justify-center">
                        {pkg.store?.logo ? (
                          <img
                            src={pkg.store.logo}
                            alt={pkg.store.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FigmaIcon
                            name="home"
                            className="w-4 h-4 text-[#ff6e20]"
                          />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-black flex items-center gap-1.5">
                          <span className="truncate">
                            Package {idx + 1} · {pkg.store?.name || 'Store'}
                          </span>
                          {pkg.store?.is_verified && <VerifiedBadge size="xs" />}
                        </p>
                        <p className="text-[11.5px] text-[#767676]">
                          {pkg.shipping_method_name || 'Standard shipping'}
                          {pkg.tracking_number
                            ? ` · Tracking ${pkg.tracking_number}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill label={pkg.status} />
                      <button
                        type="button"
                        onClick={() =>
                          setReceiptTarget({ order: selectedOrder, pkg })
                        }
                        className="inline-flex items-center gap-1 bg-white hover:bg-[#ffefe6] hover:border-[#ff6e20] hover:text-[#ff6e20] border border-[#ececec] text-[#444444] text-[11.5px] font-semibold px-3 py-1 rounded-full transition-colors"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Generate receipt</span>
                      </button>
                      {pkg.store && (
                        <>
                          <Link
                            to={`/help/contact?storeId=${pkg.store.id}&storeName=${encodeURIComponent(pkg.store.name)}&storeSlug=${encodeURIComponent(pkg.store.slug)}&orderId=${selectedOrder.id}&orderNumber=${encodeURIComponent(selectedOrder.order_number)}`}
                            onClick={() => {
                              savePendingChatCard(
                                pkg.store!.id,
                                buildOrderChatCard(selectedOrder, pkg),
                              );
                              closeOrderModal();
                            }}
                            className="bg-[#ffefe6] hover:bg-[#ff6e20] text-[#ff6e20] hover:text-white text-[11.5px] font-semibold px-3 py-1 rounded-full transition-colors"
                          >
                            Contact store
                          </Link>
                          <Link
                            to={`/store/${pkg.store.slug}`}
                            onClick={closeOrderModal}
                            className="text-[12px] font-semibold text-[#ff6e20] hover:underline"
                          >
                            View store
                          </Link>
                        </>
                      )}
                    </div>
                  </div>

                  {pkg.items.map((item) => {
                    const canReview =
                      (isOrderReviewable(pkg.status) ||
                        isOrderReviewable(selectedOrder.status)) &&
                      item.product_id !== null;
                    const existingReview = canReview
                      ? findItemReview(reviews, item)
                      : undefined;
                    return (
                      <div key={item.id} className="flex items-center gap-3">
                        <div className="w-[54px] h-[54px] overflow-hidden border border-[#ececec] bg-[#f7f7f7] shrink-0 flex items-center justify-center rounded-[14px]">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.product_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FigmaIcon
                              name="package"
                              className="w-5 h-5 text-[#979797]"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13.5px] font-medium text-black leading-snug">
                            {item.product_name}
                          </p>
                          <p className="text-[11.5px] text-[#767676]">
                            Qty {item.quantity} · ${item.unit_price.toFixed(2)}{' '}
                            each
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <p className="text-[14px] font-semibold text-[#ff6e20]">
                            ${item.total.toFixed(2)}
                          </p>
                          {canReview &&
                            (existingReview ? (
                              <span className="inline-flex items-center gap-1 bg-[#e7f6e7] text-[#029500] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                                ★ {existingReview.rating}/5 · Reviewed
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setReviewTarget({
                                    orderItemId: item.id,
                                    productId: item.product_id as number,
                                    productName: item.product_name,
                                    productImage: item.image,
                                    storeName: pkg.store?.name,
                                  })
                                }
                                className="bg-[#ffefe6] hover:bg-[#ff6e20] text-[#ff6e20] hover:text-white text-[11.5px] font-semibold px-3 py-1 rounded-full transition-colors"
                              >
                                Write review
                              </button>
                            ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <aside className="bg-[#f9f9f9] border border-[#ececec] rounded-[16px] p-4 flex flex-col gap-4">
              <div>
                <h3 className="text-[14px] font-semibold text-black mb-1">
                  Delivery address
                </h3>
                <p className="text-[13px] font-medium text-black">
                  {selectedOrder.shipping_address.full_name}
                </p>
                <p className="text-[12px] text-[#767676] leading-relaxed">
                  {[
                    selectedOrder.shipping_address.address_line_1,
                    selectedOrder.shipping_address.commune,
                    selectedOrder.shipping_address.district,
                    selectedOrder.shipping_address.province,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                <p className="text-[12px] text-[#767676] mt-0.5">
                  {selectedOrder.shipping_address.phone}
                </p>
              </div>

              <div className="border-t border-[#e8e8e8] pt-3.5 flex flex-col gap-2 text-[12.5px]">
                <h3 className="text-[14px] font-semibold text-black mb-0.5">
                  Payment summary
                </h3>
                <div className="flex justify-between">
                  <span className="text-[#767676]">Subtotal</span>
                  <span className="font-medium text-black">
                    ${selectedOrder.subtotal_amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#767676]">Shipping</span>
                  <span className="font-medium text-black">
                    ${selectedOrder.shipping_amount.toFixed(2)}
                  </span>
                </div>
                {selectedOrder.discount_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#767676]">Discount</span>
                    <span className="font-medium text-[#029500]">
                      −${selectedOrder.discount_amount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2 border-t border-[#e8e8e8] font-bold text-[14px]">
                  <span>Total</span>
                  <span className="text-[#ff6e20] text-right">
                    ${selectedOrder.total_amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </aside>
            </div>
          </div>
        )}
      </DashboardModal>

      <KhqrModal
        open={khqrOrders.length > 0}
        storeOrders={khqrOrders}
        onCancel={() => {
          if (activeKhqrOrderId !== null) {
            setCancelledKhqrOrderIds((prev) => ({
              ...prev,
              [activeKhqrOrderId]: true,
            }));
          }
          setActiveKhqrOrderId(null);
          setKhqrOrders([]);
          void refreshOrders();
        }}
        onClose={() => {
          setActiveKhqrOrderId(null);
          setKhqrOrders([]);
          void refreshOrders();
        }}
        onTimeout={() => {
          setActiveKhqrOrderId(null);
          setKhqrOrders([]);
          showToast('Payment timed out. Your order remains awaiting payment.');
          void refreshOrders();
        }}
        onAllPaid={() => {
          setActiveKhqrOrderId(null);
          setKhqrOrders([]);
          showToast('Payment confirmed! Your order is now processing.');
          void Promise.all([refreshCart(), refreshOrders()]);
        }}
      />

      <ProductReviewModal
        key={reviewTarget ? `${reviewTarget.orderItemId}-${reviewTarget.productId}` : 'closed'}
        target={reviewTarget}
        onClose={() => setReviewTarget(null)}
      />

      <PosOrderReceiptModal
        open={Boolean(receiptTarget)}
        onClose={() => setReceiptTarget(null)}
        order={
          receiptTarget
            ? buildReceiptOrderFromCustomerOrder(
                receiptTarget.order,
                receiptTarget.pkg,
              )
            : null
        }
        store={
          receiptTarget?.pkg.store
            ? { name: receiptTarget.pkg.store.name }
            : null
        }
        operatorName={receiptTarget?.pkg.store?.name || 'KOVA Store'}
        khrRate={khrRate}
        viewerRole="customer"
        onSendToChat={
          receiptTarget?.pkg.store || receiptTarget?.pkg.store_id
            ? handleSendReceiptToSeller
            : undefined
        }
      />
    </div>
  );
}

export function OrderDetailsPage() {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const {
    khrRate,
    reviews,
    refreshOrders,
    refreshReviews,
    refreshCart,
    showToast,
  } = useStore();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [khqrOrders, setKhqrOrders] = useState<ChildOrderRecord[]>([]);
  const [loadingKhqr, setLoadingKhqr] = useState(false);
  const [restartTimeoutOnReopen, setRestartTimeoutOnReopen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<{
    order: OrderRecord;
    pkg: ChildOrderRecord;
  } | null>(null);

  const handleSendReceiptToSeller = async (receiptImageFile: File) => {
    if (!receiptTarget) return;
    const { order: targetOrder, pkg } = receiptTarget;
    const storeId = pkg.store_id ?? pkg.store?.id ?? null;
    try {
      const receiptUrl = await customerApi.uploadChatImage(
        receiptImageFile,
        'standard',
      );
      const ticket = await customerApi.startConversation({
        store_id: storeId,
        order_id: targetOrder.id,
      });
      await customerApi.replyTicket(
        ticket.id,
        `Order receipt for #${targetOrder.order_number}`,
        [receiptUrl],
        {
          context_card: buildOrderChatCard(targetOrder, pkg),
        },
      );
      showToast('Receipt sent to seller in chat.');
      setReceiptTarget(null);
      navigate(`/help/tickets?chat=${ticket.id}`);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to send receipt to seller.',
      );
      throw err;
    }
  };

  const handleOpenKhqr = async () => {
    if (!order) return;
    setLoadingKhqr(true);
    try {
      const freshOrder = await orderApi.getOrderKhqr(
        order.id,
        restartTimeoutOnReopen,
      );
      if (restartTimeoutOnReopen) setRestartTimeoutOnReopen(false);
      setOrder(freshOrder);
      const payable = freshOrder.children.filter(
        (c) => c.khqr?.khqr_payload && c.khqr.payment_status !== 'successful',
      );
      if (payable.length > 0) {
        setKhqrOrders(payable);
      } else {
        showToast('No pending KHQR payment found for this order.');
      }
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to load Bakong KHQR payment.',
      );
    } finally {
      setLoadingKhqr(false);
    }
  };

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await orderApi.getOrder(orderId);
        if (active) setOrder(data);
      } catch {
        if (active) setOrder(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    void refreshReviews();
    return () => {
      active = false;
    };
  }, [orderId, refreshReviews]);

  if (loading) {
    return (
      <div className="py-10 text-center text-[14px] text-[#767676]">
        Loading order details...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-white border border-[#ececec] p-8 text-center flex flex-col items-center gap-3 rounded-[24px]">
        <p className="text-[16px] font-semibold text-black">Order not found</p>
        <Link
          to="/account/orders"
          className="bg-[#ff6e20] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full"
        >
          Back to orders
        </Link>
      </div>
    );
  }

  const pendingKhqr = order.children.filter(
    (c) => c.khqr?.khqr_payload && c.khqr.payment_status !== 'successful',
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black">
            Order #{order.order_number}
          </h1>
          <p className="text-[12.5px] text-[#767676] mt-0.5 capitalize">
            Placed {formatShortDate(order.created_at)} · Status:{' '}
            {order.status === 'pending' && order.payment_status === 'pending'
              ? 'Awaiting payment'
              : order.status}{' '}
            · Payment: {order.payment_status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.status === 'pending' &&
            order.payment_status !== 'paid' &&
            (pendingKhqr.length > 0 ||
              order.payment_method === 'bakong_khqr') && (
              <button
                type="button"
                disabled={loadingKhqr}
                onClick={() => void handleOpenKhqr()}
                className="bg-[#E1232E] hover:bg-[#c51b25] disabled:opacity-60 text-white text-[12.5px] font-semibold px-4 py-2 rounded-full"
              >
                {loadingKhqr ? 'Loading KHQR...' : 'Pay with KHQR'}
              </button>
            )}
        </div>
      </div>

      <OrderStatusStepper
        status={order.status}
        paymentStatus={order.payment_status}
        paymentMethod={order.payment_method}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <div className="flex flex-col gap-4">
          {order.children.map((pkg, idx) => (
            <div
              key={pkg.id}
              className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-2.5 sm:gap-3 rounded-[24px]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#ececec]">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full border border-[#ececec] bg-white overflow-hidden shrink-0 flex items-center justify-center">
                    {pkg.store?.logo ? (
                      <img
                        src={pkg.store.logo}
                        alt={pkg.store.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FigmaIcon name="home" className="w-4 h-4 text-[#ff6e20]" />
                    )}
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-black flex items-center gap-1.5">
                      <span>
                        Package {idx + 1} · {pkg.store?.name || 'Store'}
                      </span>
                      {pkg.store?.is_verified && <VerifiedBadge size="xs" />}
                    </p>
                    <p className="text-[12px] text-[#767676]">
                      {pkg.shipping_method_name || 'Standard shipping'}
                      {pkg.tracking_number
                        ? ` · Tracking ${pkg.tracking_number}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="bg-[#ffefe6] text-[#ff6e20] text-[11.5px] font-semibold px-3 py-1 rounded-full capitalize">
                    {pkg.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReceiptTarget({ order, pkg })}
                    className="inline-flex items-center gap-1.5 bg-white hover:bg-[#ffefe6] hover:border-[#ff6e20] hover:text-[#ff6e20] border border-[#ececec] text-[#444444] text-[12px] font-semibold px-3.5 py-1 rounded-full transition-colors"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Generate receipt</span>
                  </button>
                  {pkg.store && (
                    <>
                      <Link
                        to={`/help/contact?storeId=${pkg.store.id}&storeName=${encodeURIComponent(pkg.store.name)}&storeSlug=${encodeURIComponent(pkg.store.slug)}&orderId=${order.id}&orderNumber=${encodeURIComponent(order.order_number)}`}
                        onClick={() => {
                          savePendingChatCard(
                            pkg.store!.id,
                            buildOrderChatCard(order, pkg),
                          );
                        }}
                        className="bg-[#ffefe6] hover:bg-[#ff6e20] text-[#ff6e20] hover:text-white text-[12px] font-semibold px-3.5 py-1 rounded-full transition-colors"
                      >
                        Contact store
                      </Link>
                      <Link
                        to={`/store/${pkg.store.slug}`}
                        className="text-[12px] font-semibold text-[#ff6e20] hover:underline"
                      >
                        View store
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {pkg.items.map((item) => {
                const canReview =
                  (isOrderReviewable(pkg.status) ||
                    isOrderReviewable(order.status)) &&
                  item.product_id !== null;
                const existingReview = canReview
                  ? findItemReview(reviews, item)
                  : undefined;
                return (
                  <div key={item.id} className="flex items-center gap-3.5">
                    <div className="w-[64px] h-[64px] overflow-hidden border border-[#ececec] bg-[#f7f7f7] shrink-0 flex items-center justify-center rounded-[14px]">
                      {item.image ? (
                        <img
                          src={item.image}
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
                      <p className="text-[14px] font-medium text-black">
                        {item.product_name}
                      </p>
                      <p className="text-[12px] text-[#767676]">
                        Qty {item.quantity} · ${item.unit_price.toFixed(2)} each
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <p className="text-[15px] font-semibold text-[#ff6e20]">
                        ${item.total.toFixed(2)}
                      </p>
                      {canReview &&
                        (existingReview ? (
                          <span className="inline-flex items-center gap-1 bg-[#e7f6e7] text-[#029500] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                            ★ {existingReview.rating}/5 · Reviewed
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setReviewTarget({
                                orderItemId: item.id,
                                productId: item.product_id as number,
                                productName: item.product_name,
                                productImage: item.image,
                                storeName: pkg.store?.name,
                              })
                            }
                            className="bg-[#ffefe6] hover:bg-[#ff6e20] text-[#ff6e20] hover:text-white text-[12px] font-semibold px-3.5 py-1 rounded-full transition-colors"
                          >
                            Write review
                          </button>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <aside className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-3 rounded-[24px]">
          <div>
            <h3 className="text-[15px] font-semibold text-black mb-1.5">
              Delivery address
            </h3>
            <p className="text-[13.5px] font-medium text-black">
              {order.shipping_address.full_name}
            </p>
            <p className="text-[12.5px] text-[#767676]">
              {[
                order.shipping_address.address_line_1,
                order.shipping_address.commune,
                order.shipping_address.district,
                order.shipping_address.province,
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
            <p className="text-[12.5px] text-[#767676]">
              {order.shipping_address.phone}
            </p>
          </div>

          <div className="border-t border-[#ececec] pt-4 flex flex-col gap-2 text-[13px]">
            <h3 className="text-[15px] font-semibold text-black mb-1">
              Payment summary
            </h3>
            <div className="flex justify-between">
              <span className="text-[#767676]">Subtotal</span>
              <span>${order.subtotal_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#767676]">Shipping</span>
              <span>${order.shipping_amount.toFixed(2)}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-[#767676]">Discount</span>
                <span className="text-[#029500]">
                  −${order.discount_amount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-[#ececec] font-bold text-[15px]">
              <span>Total</span>
              <span className="text-[#ff6e20]">
                ${order.total_amount.toFixed(2)}
              </span>
            </div>
          </div>

          {order.status === 'pending' && order.payment_status === 'pending' && (
            <Link
              to={`/account/orders/${order.id}/cancel`}
              className="w-full text-center bg-white border border-[#ececec] hover:border-[#e5322d] hover:text-[#e5322d] text-[13px] font-semibold py-2.5 rounded-full"
            >
              Cancel order
            </Link>
          )}
        </aside>
      </div>

      <KhqrModal
        open={khqrOrders.length > 0}
        storeOrders={khqrOrders}
        onCancel={() => {
          setRestartTimeoutOnReopen(true);
          setKhqrOrders([]);
          void refreshOrders();
        }}
        onClose={() => {
          setKhqrOrders([]);
          void refreshOrders();
        }}
        onTimeout={() => {
          setRestartTimeoutOnReopen(true);
          setKhqrOrders([]);
          showToast('Payment timed out. Your order remains awaiting payment.');
          void refreshOrders();
          if (orderId) {
            void orderApi.getOrder(orderId).then((fresh) => setOrder(fresh));
          }
        }}
        onAllPaid={() => {
          setRestartTimeoutOnReopen(false);
          setKhqrOrders([]);
          showToast('Payment confirmed! Your order is now processing.');
          void Promise.all([refreshCart(), refreshOrders()]);
          if (orderId) {
            void orderApi.getOrder(orderId).then((fresh) => setOrder(fresh));
          }
        }}
      />

      <ProductReviewModal
        key={
          reviewTarget
            ? `${reviewTarget.orderItemId}-${reviewTarget.productId}`
            : 'closed'
        }
        target={reviewTarget}
        onClose={() => setReviewTarget(null)}
      />

      <PosOrderReceiptModal
        open={Boolean(receiptTarget)}
        onClose={() => setReceiptTarget(null)}
        order={
          receiptTarget
            ? buildReceiptOrderFromCustomerOrder(
                receiptTarget.order,
                receiptTarget.pkg,
              )
            : null
        }
        store={
          receiptTarget?.pkg.store
            ? { name: receiptTarget.pkg.store.name }
            : null
        }
        operatorName={receiptTarget?.pkg.store?.name || 'KOVA Store'}
        khrRate={khrRate}
        viewerRole="customer"
        onSendToChat={
          receiptTarget?.pkg.store || receiptTarget?.pkg.store_id
            ? handleSendReceiptToSeller
            : undefined
        }
      />
    </div>
  );
}

export function CancelOrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { cancelOrder, showToast } = useStore();
  const navigate = useNavigate();

  const [reason, setReason] = useState('Changed my mind');
  const [submitting, setSubmitting] = useState(false);

  const handleCancel = async () => {
    const id = Number(orderId);
    if (!id) return;
    setSubmitting(true);
    try {
      await cancelOrder(id, reason);
      navigate('/account/orders');
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to cancel order.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[700px] flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-bold text-black">Cancel order</h1>
      </div>

      <div className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-2.5 sm:gap-3 rounded-[24px]">
        <p className="text-[13.5px] text-[#767676]">
          Select a cancellation reason. Pending orders are cancelled immediately
          and inventory is restored.
        </p>

        <div className="flex flex-col gap-2">
          {[
            'Changed my mind',
            'Need to update delivery address',
            'Ordered wrong variant or quantity',
            'Found a better price',
          ].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`text-left px-4 py-3 rounded-[12px] text-[13.5px] transition-all ${
                reason === r
                  ? 'bg-[#ffefe6] border border-[#ff6e20] text-[#ff6e20] font-semibold'
                  : 'bg-[#f7f7f7] text-black hover:bg-[#ffefe6]/60'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2.5 pt-2">
          <Link
            to="/account/orders"
            className="bg-white border border-[#ececec] text-black text-[13px] font-semibold px-5 py-2.5 rounded-full"
          >
            Keep order
          </Link>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleCancel()}
            className="bg-[#e5322d] hover:bg-[#c82520] disabled:opacity-60 text-white text-[13px] font-semibold px-6 py-2.5 rounded-full"
          >
            {submitting ? 'Cancelling...' : 'Confirm cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}
