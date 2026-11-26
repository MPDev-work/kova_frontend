import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FigmaIcon } from '../../components/FigmaIcon';
import { useStore } from '../../context/StoreContext';
import { catalogApi, customerApi } from '../../services/api';
import { formatKhr, formatShortDate } from '../../utils/currency';
import { ProductCard } from '../../components/ProductCard';
import { ProductDetailSkeleton } from '../../components/Skeleton';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { savePendingChatCard } from '../../utils/chatContextCard';
import { saveCheckoutSelection } from '../../utils/checkoutSelection';
import type { Product, ReviewItem } from '../../types/marketplace';

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [moreFromStore, setMoreFromStore] = useState<Product[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setNotFound(false);
      setMoreFromStore([]);
      try {
        const prod = await catalogApi.getProduct(slug);
        if (!active) return;
        setProduct(prod);
        const [relRes, revRes, storeRes] = await Promise.allSettled([
          catalogApi.getRelatedProducts(prod.id, 5),
          customerApi.getProductReviews(prod.id),
          prod.store_slug || prod.store_id
            ? catalogApi.getStoreProducts(prod.store_slug || prod.store_id, 6)
            : Promise.resolve({ store: null, products: [] as Product[] }),
        ]);
        if (!active) return;
        if (relRes.status === 'fulfilled') setRelated(relRes.value);
        if (revRes.status === 'fulfilled') setReviews(revRes.value.reviews);
        if (storeRes.status === 'fulfilled') {
          setMoreFromStore(
            storeRes.value.products.filter((p) => p.id !== prod.id).slice(0, 4),
          );
        }
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return <ProductDetailSkeleton />;
  }

  if (notFound || !product) {
    return (
      <div className="kova-container px-4 py-16">
        <div className="bg-white border border-[#ececec] p-12 text-center flex flex-col items-center gap-2.5 sm:gap-3 max-w-[560px] mx-auto rounded-[24px]">
          <FigmaIcon name="package" className="w-10 h-10 text-[#979797]" />
          <h1 className="text-[26px] font-semibold text-black">
            Product unavailable
          </h1>
          <p className="text-[14.5px] text-[#767676]">
            This product may have been removed or is not currently published.
          </p>
          <div className="flex gap-3 mt-1">
            <Link
              to="/products"
              className="bg-[#ff6e20] text-white font-semibold text-[14px] px-6 py-3 rounded-full"
            >
              Browse products
            </Link>
            <Link
              to="/"
              className="bg-white border border-[#ececec] text-black font-semibold text-[14px] px-6 py-3 rounded-full"
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProductDetailContent
      key={product.id}
      product={product}
      moreFromStore={moreFromStore}
      related={related}
      reviews={reviews}
    />
  );
}

function ProductDetailContent({
  product,
  moreFromStore,
  related,
  reviews,
}: {
  product: Product;
  moreFromStore: Product[];
  related: Product[];
  reviews: ReviewItem[];
}) {
  const navigate = useNavigate();
  const {
    addToCart,
    wishlistIds,
    toggleWishlist,
    trackProductView,
    khrRate,
    showToast,
  } = useStore();

  const [activeImg, setActiveImg] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    product.variants[0]?.id ?? null,
  );
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'specs' | 'reviews'>('specs');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    trackProductView(product.id);
  }, [product.id, trackProductView]);

  const activeVariant =
    product.variants.find((v) => v.id === selectedVariantId) || null;
  const displayPrice = activeVariant ? activeVariant.price : product.price;
  const maxStock = activeVariant
    ? activeVariant.stock_quantity
    : product.stock_quantity;
  const isSaved = wishlistIds.includes(product.id);
  const displayImage = product.gallery[activeImg] || product.image;

  const handleAddToCart = async () => {
    setSubmitting(true);
    await addToCart(product.id, activeVariant?.id ?? null, quantity);
    setSubmitting(false);
  };

  const handleBuyNow = () => {
    if (maxStock <= 0) {
      showToast('This product is currently out of stock.');
      return;
    }
    saveCheckoutSelection({
      mode: 'buy_now',
      item: {
        product_id: product.id,
        variant_id: activeVariant?.id ?? null,
        quantity,
        product_name: product.name,
        product_slug: product.slug,
        product_image: displayImage || product.image || null,
        variant_name: activeVariant?.name ?? null,
        unit_price: displayPrice,
        free_shipping: Boolean(product.free_shipping),
        store: {
          id: product.store_id,
          name: product.store_name,
          slug: product.store_slug,
          logo: product.store_logo || null,
          is_verified: product.store_verified,
        },
      },
    });
    navigate('/checkout?mode=buy_now');
  };

  return (
    <div className="kova-container px-2.5 lg:px-[10px] pt-[14px] pb-7 flex flex-col gap-4">
      {/* Top Store Strip */}
      <div className="bg-white border border-[#ececec] p-2 sm:px-3 sm:py-2 flex flex-wrap items-center justify-between gap-2.5 rounded-[24px] sm:rounded-full">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/store/${product.store_slug}`}
            className="w-10 h-10 rounded-full border border-[#ececec] bg-white overflow-hidden shrink-0 flex items-center justify-center"
          >
            {product.store_logo ? (
              <img
                src={product.store_logo}
                alt={product.store_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <FigmaIcon name="home" className="w-5 h-5 text-[#ff6e20]" />
            )}
          </Link>
          <Link
            to={`/store/${product.store_slug}`}
            className="text-[16px] font-bold text-black hover:text-[#ff6e20] transition-colors inline-flex items-center gap-1.5"
          >
            <span>{product.store_name}</span>
            {product.store_verified && (
              <VerifiedBadge size="sm" label="Verified store" />
            )}
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {product.store_id && (
            <Link
              to={`/help/contact?storeId=${product.store_id}&storeName=${encodeURIComponent(product.store_name)}&storeSlug=${encodeURIComponent(product.store_slug)}`}
              onClick={() => {
                savePendingChatCard(product.store_id, {
                  kind: 'product',
                  product_id: product.id,
                  product_slug: product.slug,
                  product_name: product.name,
                  product_image: displayImage || product.image || null,
                  unit_price: product.price,
                  store_name: product.store_name,
                });
              }}
              className="bg-[#ffefe6] hover:bg-[#ff6e20] text-[#ff6e20] hover:text-white text-[12.5px] font-semibold px-4 py-1.5 rounded-full transition-colors"
            >
              Contact store
            </Link>
          )}
          <Link
            to={`/store/${product.store_slug}`}
            className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-black text-[12.5px] font-semibold px-4 py-1.5 rounded-full transition-colors"
          >
            View store
          </Link>
        </div>
      </div>

      {/* Buy Box */}
      <section
        className={`bg-white border border-[#ececec] rounded-[22px] p-5 grid grid-cols-1 gap-[22px] items-start ${
          moreFromStore.length > 0
            ? 'lg:grid-cols-[400px_minmax(0,1fr)] xl:grid-cols-[410px_minmax(0,1fr)_306px]'
            : 'lg:grid-cols-[430px_minmax(0,1fr)]'
        }`}
      >
        {/* Photo Gallery */}
        <div className="flex flex-col gap-2.5 w-full">
          <div className="w-full h-[360px] sm:h-[420px] overflow-hidden bg-[#f7f7f7] border border-[#ececec] flex items-center justify-center rounded-[14px]">
            {displayImage ? (
              <img
                src={displayImage}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <FigmaIcon name="package" className="w-14 h-14 text-[#979797]" />
            )}
          </div>

          {product.gallery.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {product.gallery.slice(0, 5).map((img, idx) => (
                <button
                  key={`${img}-${idx}`}
                  type="button"
                  onClick={() => setActiveImg(idx)}
                  className={`h-[72px] rounded-[12px] overflow-hidden border-2 transition-all ${
                    activeImg === idx
                      ? 'border-[#ff6e20]'
                      : 'border-transparent hover:border-[#ececec]'
                  }`}
                >
                  <img
                    src={img}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-1 text-[12.5px]">
            <div className="flex items-center gap-4 text-[#767676] font-medium">
              <button
                type="button"
                onClick={() => void toggleWishlist(product.id)}
                className={`hover:text-[#ff6e20] ${isSaved ? 'text-[#ff6e20] font-semibold' : ''}`}
              >
                {isSaved ? 'Saved in wishlist' : 'Save to wishlist'}
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(window.location.href)
                    .catch(() => {});
                  showToast('Product link copied.');
                }}
                className="hover:text-[#ff6e20]"
              >
                Copy link
              </button>
            </div>
          </div>
        </div>

        {/* Details & Actions */}
        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            {product.category_id && (
              <span className="bg-[#ffefe6] text-[#ff6e20] font-semibold px-3 py-1 rounded-full">
                {product.category_name}
              </span>
            )}
            {(product.has_free_delivery || product.free_shipping) && (
              <span className="bg-[#029500] px-3 py-1 rounded-full inline-flex items-center gap-1">
                <span className="text-[#ffe169]">Free</span>
                <span className="text-white">Delivery</span>
              </span>
            )}
          </div>

          <h1 className="text-[22px] sm:text-[24px] font-bold text-black leading-[1.35]">
            {product.name}
          </h1>

          {/* Price Box */}
          <div className="kova-gradient px-[18px] py-4 flex flex-col gap-1 rounded-[14px]">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-[32px] font-bold text-white leading-tight">
                ${displayPrice.toFixed(2)}
              </span>
              <span className="text-[14px] font-bold text-white">USD</span>
              {product.regular_price > displayPrice && (
                <span className="text-[14px] text-[#ffdcc8] line-through">
                  ${product.regular_price.toFixed(2)}
                </span>
              )}
              {product.discount_percent > 0 && (
                <span className="bg-black text-[#ffc58b] text-[12px] font-semibold px-3 py-1 rounded-full">
                  -{product.discount_percent}%
                </span>
              )}
            </div>
            <p className="text-[12.5px] font-medium text-[#fff0e6]">
              {formatKhr(displayPrice, false, khrRate)}
              {product.reviews_count > 0
                ? ` · ★ ${product.rating.toFixed(1)} (${product.reviews_count} reviews)`
                : ''}
            </p>
          </div>

          {/* Product Description (below price card, above variants & quantity) */}
          {product.description?.trim() && (
            <div className="bg-[#f9f9f9] border border-[#f0f0f0] rounded-[16px] px-4 py-3.5">
              <p className="text-[13.5px] text-[#555555] leading-[1.65] whitespace-pre-line">
                {product.description.trim()}
              </p>
            </div>
          )}

          {/* Variants */}
          {product.variants.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-semibold text-black">
                Variant:{' '}
                <span className="font-medium text-[#ff6e20]">
                  {activeVariant?.name}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => {
                  const selected = variant.id === activeVariant?.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`px-3.5 py-2 rounded-[12px] text-[12.5px] transition-all ${
                        selected
                          ? 'bg-[#ffefe6] border-2 border-[#ff6e20] text-[#ff6e20] font-semibold'
                          : 'bg-white border border-[#ececec] text-black font-medium hover:border-[#ff6e20]/60'
                      }`}
                    >
                      {variant.name} · ${variant.price.toFixed(2)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="flex flex-wrap items-center gap-3.5">
            <span className="text-[13px] font-semibold text-[#767676]">
              Quantity:
            </span>
            <div className="bg-[#f7f7f7] border border-[#ececec] rounded-full px-3.5 py-1.5 flex items-center gap-4 text-[14px] font-bold text-black">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-5 text-center hover:text-[#ff6e20]"
              >
                −
              </button>
              <span className="w-5 text-center tabular-nums">{quantity}</span>
              <button
                type="button"
                onClick={() =>
                  setQuantity((q) => Math.min(Math.max(1, maxStock), q + 1))
                }
                className="w-5 text-center hover:text-[#ff6e20]"
              >
                +
              </button>
            </div>
            <span
              className={`text-[12.5px] font-semibold ${maxStock > 0 ? 'text-[#029500]' : 'text-[#e5322d]'}`}
            >
              {maxStock > 0 ? `${maxStock} available` : 'Out of stock'}
            </span>
          </div>

          {/* Text-Only CTAs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              disabled={submitting || maxStock <= 0}
              onClick={() => void handleAddToCart()}
              className="bg-[#ff9800] hover:bg-[#eb8c00] disabled:opacity-50 transition-colors text-white text-[15px] font-bold py-3.5 px-6 rounded-full"
            >
              Add to cart
            </button>
            <button
              type="button"
              disabled={submitting || maxStock <= 0}
              onClick={handleBuyNow}
              className="kova-gradient hover:opacity-95 disabled:opacity-50 transition-opacity text-white text-[15px] font-bold py-3.5 px-6 rounded-full"
            >
              Buy now · ${(displayPrice * quantity).toFixed(2)}
            </button>
          </div>
        </div>

        {/* More from Store Sidebar Card (max 4 products) */}
        {moreFromStore.length > 0 && (
          <aside className="bg-[#f2f2f7] rounded-[22px] p-2.5 flex flex-col gap-3 w-full lg:col-span-2 xl:col-span-1">
            <h2 className="text-[16px] font-bold text-black px-0.5 leading-snug truncate">
              More from {product.store_name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2.5">
              {moreFromStore.slice(0, 4).map((item) => (
                <Link
                  key={item.id}
                  to={`/product/${item.slug}`}
                  className="bg-white h-[86px] hover:shadow-[0_4px_14px_rgba(0,0,0,0.06)] p-1 flex items-center gap-3.5 transition-all group rounded-[24px]"
                >
                  <div className="w-[80px] h-[80px] overflow-hidden bg-[#f7f7f7] shrink-0 flex items-center justify-center rounded-[14px]">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                      />
                    ) : (
                      <FigmaIcon
                        name="package"
                        className="w-6 h-6 text-[#979797]"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col gap-1 p-3">
                    <p className="text-[13.5px] font-medium text-black leading-[1.35] line-clamp-2 group-hover:text-[#ff6e20] transition-colors">
                      {item.name}
                    </p>
                    <p className="text-[16px] font-bold text-[#ff6e20] leading-none tabular-nums">
                      ${item.price.toFixed(2)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </aside>
        )}
      </section>

      {/* Tabs: Specifications & Customer Reviews */}
      <section className="bg-white border border-[#ececec] px-5 py-5 flex flex-col gap-2.5 sm:gap-3 rounded-[24px]">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'specs' as const, label: 'Specifications' },
            {
              id: 'reviews' as const,
              label: `Customer Reviews (${reviews.length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-[12.5px] transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#ff6e20] text-white font-semibold'
                  : 'bg-[#f7f7f7] text-black font-medium hover:bg-[#ffefe6]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'specs' && (
          <div className="flex flex-col gap-4 max-w-[860px]">
            {product.short_description?.trim() && (
              <div className="bg-[#fff9f5] border border-[#ffefe6] rounded-[14px] px-4 py-3.5 flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#ff6e20]">
                  Short summary
                </span>
                <p className="text-[14px] text-[#222222] leading-[1.6] whitespace-pre-line">
                  {product.short_description.trim()}
                </p>
              </div>
            )}

            {Object.keys(product.specifications).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(product.specifications).map(([k, v]) => (
                  <div
                    key={k}
                    className="bg-[#f7f7f7] px-4 py-3 flex items-center justify-between gap-4 rounded-[14px]"
                  >
                    <span className="text-[13px] font-medium text-[#767676]">
                      {k}
                    </span>
                    <span className="text-[13.5px] font-semibold text-black text-right">
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              !product.short_description?.trim() && (
                <p className="text-[13.5px] text-[#767676]">
                  No specifications listed.
                </p>
              )
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f7f7f7] p-2.5 rounded-[14px]">
              <p className="text-[14px] font-semibold text-black">
                {reviews.length} customer review
                {reviews.length === 1 ? '' : 's'}
              </p>
              <Link
                to={`/account/reviews/write?productId=${product.id}`}
                className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13px] font-semibold px-5 py-2 rounded-full"
              >
                Write a review
              </Link>
            </div>

            {reviews.length === 0 ? (
              <p className="text-[13.5px] text-[#767676]">
                No reviews yet for this product.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="border border-[#ececec] rounded-[16px] p-4 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-full border border-[#ececec] bg-[#ffefe6] text-[#ff6e20] overflow-hidden shrink-0 flex items-center justify-center text-[13px] font-bold">
                          {rev.author_avatar ? (
                            <img
                              src={rev.author_avatar}
                              alt={rev.author}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (rev.author?.charAt(0) || 'C').toUpperCase()
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-black inline-flex items-center gap-1.5 max-w-full">
                            <span className="truncate">{rev.author}</span>
                            {rev.is_verified_purchase && (
                              <VerifiedBadge
                                size="xs"
                                label="Verified purchase"
                              />
                            )}
                          </p>
                          <p className="text-[13px] text-[#ff6e20] leading-tight">
                            {'★'.repeat(rev.rating)}
                            {'☆'.repeat(5 - rev.rating)}
                          </p>
                        </div>
                      </div>
                      <span className="text-[12px] text-[#767676] shrink-0">
                        {formatShortDate(rev.created_at)}
                      </span>
                    </div>
                    {rev.title && (
                      <p className="text-[13.5px] font-semibold text-black">
                        {rev.title}
                      </p>
                    )}
                    <p className="text-[14px] text-black/85 leading-[1.5]">
                      {rev.comment}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {related.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[20px] font-bold text-black">Related products</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
