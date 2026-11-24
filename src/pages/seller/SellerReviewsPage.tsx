import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FigmaIcon } from '../../components/FigmaIcon';
import {
  DashboardModal,
  DashboardPageHeader,
  FilterPillTabs,
  KpiGrid,
  TablePagination,
} from '../../components/DashboardPrimitives';
import { exportRowsToCsv } from '../../utils/csv';
import {
  DashboardKpiSkeleton,
  DashboardTableSkeleton,
} from '../../components/Skeleton';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { useStore } from '../../context/StoreContext';
import { ApiError } from '../../services/api';
import {
  storeOwnerApi,
  type SellerReviewItem,
  type SellerReviewStats,
} from '../../services/dashboardApi';
import { formatShortDate } from '../../utils/currency';

type RatingTab = '' | '5' | '4' | '3' | '2' | '1';

const EMPTY_STATS: SellerReviewStats = {
  total_reviews: 0,
  average_rating: 0,
  five_star_count: 0,
  verified_count: 0,
  rating_breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
};

export function SellerReviewsPage() {
  const { showToast } = useStore();
  const [reviews, setReviews] = useState<SellerReviewItem[]>([]);
  const [stats, setStats] = useState<SellerReviewStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState<RatingTab>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedReview, setSelectedReview] = useState<SellerReviewItem | null>(
    null,
  );

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await storeOwnerApi.getReviews({
        rating: ratingFilter ? Number(ratingFilter) : undefined,
        search: search.trim() || undefined,
        page,
        per_page: 12,
      });
      setStats(res.stats || EMPTY_STATS);
      setReviews(res.reviews.data);
      setLastPage(res.reviews.last_page);
      setTotal(res.reviews.total);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to load customer reviews.',
      );
    } finally {
      setLoading(false);
    }
  }, [ratingFilter, search, page, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReviews();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [loadReviews]);

  const fiveStarPct =
    stats.total_reviews > 0
      ? Math.round((stats.five_star_count / stats.total_reviews) * 100)
      : 0;

  const verifiedPct =
    stats.total_reviews > 0
      ? Math.round((stats.verified_count / stats.total_reviews) * 100)
      : 0;

  const handleExport = () => {
    exportRowsToCsv(
      `kova-store-reviews-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Customer',
        'Email',
        'Verified',
        'Product',
        'Rating',
        'Title',
        'Comment',
        'Date',
      ],
      reviews.map((rev) => [
        rev.user?.name || 'Customer',
        rev.user?.email || '',
        rev.is_verified_purchase ? 'Yes' : 'No',
        rev.product?.name || `Product #${rev.product_id}`,
        `${rev.rating}/5`,
        rev.title || '',
        rev.comment,
        formatShortDate(rev.created_at),
      ]),
    );
    showToast('Reviews CSV exported.');
  };

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Customer Reviews"
        subtitle="Monitor buyer ratings and read verified product feedback across your store."
        actions={
          <button
            type="button"
            disabled={reviews.length === 0}
            onClick={handleExport}
            className="bg-white border border-[#ececec] hover:border-[#cccccc] disabled:opacity-50 text-[12.5px] font-semibold text-black px-4 py-2 rounded-full transition-colors"
          >
            Export CSV
          </button>
        }
      />

      {loading && stats.total_reviews === 0 ? (
        <DashboardKpiSkeleton count={4} />
      ) : (
        <KpiGrid
          items={[
            {
              label: 'Average rating',
              value:
                stats.total_reviews > 0
                  ? `${stats.average_rating.toFixed(1)} / 5`
                  : '—',
              sub:
                stats.total_reviews > 0
                  ? `Across ${stats.total_reviews} review${stats.total_reviews === 1 ? '' : 's'}`
                  : 'Waiting for first review',
              badge: stats.average_rating >= 4.5 ? 'Top rated' : 'Store score',
              tone: stats.average_rating >= 4 ? 'green' : 'orange',
            },
            {
              label: 'Total reviews',
              value: String(stats.total_reviews),
              sub: 'Published customer feedback',
              badge: 'All time',
              tone: 'neutral',
            },
            {
              label: '5-star reviews',
              value: String(stats.five_star_count),
              sub: `${fiveStarPct}% of all ratings`,
              badge: '5★',
              tone: stats.five_star_count > 0 ? 'green' : 'neutral',
            },
            {
              label: 'Verified buyers',
              value: String(stats.verified_count),
              sub: `${verifiedPct}% confirmed purchases`,
              badge: 'Verified',
              tone: 'orange',
            },
          ]}
        />
      )}

      <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterPillTabs<RatingTab>
            value={ratingFilter}
            onChange={(next) => {
              setRatingFilter(next);
              setPage(1);
            }}
            options={[
              { id: '', label: 'All', count: stats.total_reviews },
              {
                id: '5',
                label: '5 Stars',
                count: stats.rating_breakdown?.[5] ?? 0,
              },
              {
                id: '4',
                label: '4 Stars',
                count: stats.rating_breakdown?.[4] ?? 0,
              },
              {
                id: '3',
                label: '3 Stars',
                count: stats.rating_breakdown?.[3] ?? 0,
              },
              {
                id: '2',
                label: '2 Stars',
                count: stats.rating_breakdown?.[2] ?? 0,
              },
              {
                id: '1',
                label: '1 Star',
                count: stats.rating_breakdown?.[1] ?? 0,
              },
            ]}
          />

          <div className="flex items-center gap-2 bg-[#f7f7f7] border border-[#ececec] focus-within:border-[#ff6e20] focus-within:bg-white rounded-full px-3.5 h-[36px] w-full sm:w-[260px]">
            <FigmaIcon name="search" className="w-3.5 h-3.5 text-[#979797]" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search buyer, product, comment..."
              className="flex-1 bg-transparent text-[12px] text-black placeholder:text-[#979797] outline-none min-w-0"
            />
          </div>
        </div>

        {loading ? (
          <DashboardTableSkeleton rows={5} />
        ) : reviews.length === 0 ? (
          <div className="py-14 px-6 bg-[#f7f7f7] rounded-[16px] flex flex-col items-center text-center gap-2">
            <FigmaIcon name="star" className="w-8 h-8 text-[#979797]" />
            <p className="text-[14.5px] font-semibold text-black">
              No customer reviews found
            </p>
            <p className="text-[13px] text-[#767676] max-w-[400px]">
              {ratingFilter || search.trim()
                ? 'Try clearing your rating filter or search term.'
                : 'Reviews submitted by customers on completed orders will appear here automatically.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                  <th className="py-2.5 px-3.5 rounded-l-[10px]">Customer</th>
                  <th className="py-2.5 px-3.5">Product</th>
                  <th className="py-2.5 px-3.5">Rating</th>
                  <th className="py-2.5 px-3.5">Review</th>
                  <th className="py-2.5 px-3.5">Date</th>
                  <th className="py-2.5 px-3.5 rounded-r-[10px] text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                {reviews.map((rev) => {
                  const customerName = rev.user?.name || 'Customer';
                  return (
                    <tr
                      key={rev.id}
                      className="hover:bg-[#fafafa] transition-colors"
                    >
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-2.5 min-w-[160px]">
                          <span className="w-8 h-8 rounded-full border border-[#ececec] bg-[#ffefe6] text-[#ff6e20] overflow-hidden shrink-0 flex items-center justify-center text-[11.5px] font-bold">
                            {rev.user?.avatar ? (
                              <img
                                src={rev.user.avatar}
                                alt={customerName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              customerName.charAt(0).toUpperCase()
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-black inline-flex items-center gap-1 max-w-full">
                              <span className="truncate">{customerName}</span>
                              {rev.is_verified_purchase && (
                                <VerifiedBadge
                                  size="xs"
                                  label="Verified purchase"
                                />
                              )}
                            </p>
                            {rev.user?.email && (
                              <p className="text-[11px] text-[#767676] truncate">
                                {rev.user.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-2.5 max-w-[240px]">
                          <div className="w-10 h-10 rounded-[10px] border border-[#ececec] bg-[#f7f7f7] overflow-hidden shrink-0 flex items-center justify-center">
                            {rev.product?.primary_image?.image_url ? (
                              <img
                                src={rev.product.primary_image.image_url}
                                alt={rev.product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <FigmaIcon
                                name="package"
                                className="w-4 h-4 text-[#979797]"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <Link
                              to={`/seller/products?view=${rev.product?.id ?? rev.product_id}`}
                              className="text-[13px] font-medium text-black hover:text-[#ff6e20] line-clamp-1"
                            >
                              {rev.product?.name ||
                                `Product #${rev.product_id}`}
                            </Link>
                            {rev.product?.sku && (
                              <p className="text-[11px] text-[#8a8a8a] truncate">
                                SKU: {rev.product.sku}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span className="text-[13px] text-[#ff6e20] tracking-tight">
                          {'★'.repeat(rev.rating)}
                          <span className="text-[#dfdfdf]">
                            {'★'.repeat(5 - rev.rating)}
                          </span>
                        </span>
                        <p className="text-[11px] font-semibold text-[#767676]">
                          {rev.rating}.0 / 5
                        </p>
                      </td>
                      <td className="py-3.5 px-3.5 max-w-[320px]">
                        {rev.title && (
                          <p className="text-[12.5px] font-semibold text-black truncate">
                            {rev.title}
                          </p>
                        )}
                        <p className="text-[12.5px] text-[#555555] line-clamp-2 leading-snug">
                          {rev.comment}
                        </p>
                      </td>
                      <td className="py-3.5 px-3.5 text-[12px] text-[#767676] whitespace-nowrap">
                        {formatShortDate(rev.created_at)}
                      </td>
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedReview(rev)}
                          className="bg-white border border-[#ececec] hover:border-[#ff6e20] hover:text-[#ff6e20] text-[12px] font-semibold text-black px-3.5 py-1.5 rounded-full transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <TablePagination
          page={page}
          lastPage={lastPage}
          total={total}
          perPage={12}
          itemLabel="reviews"
          onPageChange={setPage}
        />
      </section>

      {/* Review Details Modal */}
      <DashboardModal
        open={Boolean(selectedReview)}
        onClose={() => setSelectedReview(null)}
        title="Customer review details"
        subtitle={
          selectedReview
            ? `Submitted on ${formatShortDate(selectedReview.created_at)}`
            : undefined
        }
        widthClass="max-w-[580px]"
        footer={
          selectedReview && (
            <>
              {(selectedReview.product?.id || selectedReview.product_id) && (
                <Link
                  to={`/seller/products?view=${selectedReview.product?.id ?? selectedReview.product_id}`}
                  onClick={() => setSelectedReview(null)}
                  className="bg-[#ffefe6] hover:bg-[#ffdfcd] text-[#ff6e20] text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors"
                >
                  View product
                </Link>
              )}
              <button
                type="button"
                onClick={() => setSelectedReview(null)}
                className="bg-white border border-[#ececec] hover:border-black text-[12.5px] font-semibold text-black px-4.5 py-2 rounded-full transition-colors"
              >
                Close
              </button>
            </>
          )
        }
      >
        {selectedReview && (
          <div className="flex flex-col gap-4">
            {/* Buyer Card */}
            <div className="bg-[#f7f7f7] border border-[#ececec] rounded-[14px] p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-full border border-[#ececec] bg-[#ffefe6] text-[#ff6e20] overflow-hidden shrink-0 flex items-center justify-center text-[14px] font-bold">
                  {selectedReview.user?.avatar ? (
                    <img
                      src={selectedReview.user.avatar}
                      alt={selectedReview.user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (selectedReview.user?.name?.charAt(0) || 'C').toUpperCase()
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-black inline-flex items-center gap-1.5 max-w-full">
                    <span className="truncate">
                      {selectedReview.user?.name || 'Customer'}
                    </span>
                    {selectedReview.is_verified_purchase && (
                      <VerifiedBadge size="xs" label="Verified purchase" />
                    )}
                  </p>
                  {selectedReview.user?.email && (
                    <p className="text-[12px] text-[#767676] truncate">
                      {selectedReview.user.email}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[16px] text-[#ff6e20] leading-none">
                  {'★'.repeat(selectedReview.rating)}
                  <span className="text-[#dfdfdf]">
                    {'★'.repeat(5 - selectedReview.rating)}
                  </span>
                </p>
                <p className="text-[11.5px] font-semibold text-[#767676] mt-1">
                  {selectedReview.rating}.0 out of 5
                </p>
              </div>
            </div>

            {/* Product Card */}
            <div className="bg-white border border-[#ececec] rounded-[14px] p-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-[10px] border border-[#ececec] bg-[#f7f7f7] overflow-hidden shrink-0 flex items-center justify-center">
                {selectedReview.product?.primary_image?.image_url ? (
                  <img
                    src={selectedReview.product.primary_image.image_url}
                    alt={selectedReview.product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FigmaIcon
                    name="package"
                    className="w-5 h-5 text-[#979797]"
                  />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-black truncate">
                  {selectedReview.product?.name ||
                    `Product #${selectedReview.product_id}`}
                </p>
                {selectedReview.product?.sku && (
                  <p className="text-[12px] text-[#767676]">
                    SKU: {selectedReview.product.sku}
                  </p>
                )}
              </div>
            </div>

            {/* Full Review Content */}
            <div className="flex flex-col gap-1.5">
              {selectedReview.title && (
                <p className="text-[14.5px] font-bold text-black">
                  {selectedReview.title}
                </p>
              )}
              <p className="text-[14px] text-[#1c1c1c] leading-[1.6] whitespace-pre-line">
                {selectedReview.comment}
              </p>
            </div>

            {selectedReview.images && selectedReview.images.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedReview.images.map((img) => (
                  <img
                    key={img.id}
                    src={img.image_url}
                    alt="Customer review"
                    className="w-20 h-20 rounded-[12px] object-cover border border-[#ececec]"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </DashboardModal>
    </div>
  );
}
