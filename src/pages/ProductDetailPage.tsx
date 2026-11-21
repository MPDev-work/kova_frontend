import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FigmaIcon } from '../components/FigmaIcon';
import { useStore } from '../context/StoreContext';
import { catalogApi, customerApi } from '../services/api';
import { formatKhr, formatShortDate } from '../utils/currency';
import { ProductCard } from '../components/ProductCard';
import { ProductDetailSkeleton } from '../components/Skeleton';
import { VerifiedBadge } from '../components/VerifiedBadge';
import type { Product, ReviewItem } from '../types/marketplace';

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
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
      try {
        const prod = await catalogApi.getProduct(slug);
        if (!active) return;
        setProduct(prod);
        const [relRes, revRes] = await Promise.allSettled([
          catalogApi.getRelatedProducts(prod.id, 5),
          customerApi.getProductReviews(prod.id),
        ]);
        if (!active) return;
        if (relRes.status === 'fulfilled') setRelated(relRes.value);
        if (revRes.status === 'fulfilled') setReviews(revRes.value.reviews);
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
        <div className="bg-white border border-[#ececec] rounded-[24px] p-12 text-center flex flex-col items-center gap-4 max-w-[560px] mx-auto">
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
      related={related}
      reviews={reviews}
    />
  );
}

function ProductDetailContent({
  product,
  related,
  reviews,
}: {
  product: Product;
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
  const [activeTab, setActiveTab] = useState<'details' | 'specs' | 'reviews'>(
    'details',
  );
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

  const handleAdd = async (goCheckout: boolean) => {
    setSubmitting(true);
    const ok = await addToCart(product.id, activeVariant?.id ?? null, quantity);
    setSubmitting(false);
    if (ok && goCheckout) {
      navigate('/checkout');
    }
  };

  return (
    <div className="kova-container px-2.5 lg:px-[10px] pt-[14px] pb-7 flex flex-col gap-4">
      {/* Top Store Strip */}
      <div className="bg-white border border-[#ececec] rounded-[16px] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
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

        <Link
          to={`/store/${product.store_slug}`}
          className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-black text-[12.5px] font-semibold px-4 py-1.5 rounded-full transition-colors"
        >
          View store
        </Link>
      </div>

      {/* Buy Box */}
      <section className="bg-white border border-[#ececec] rounded-[22px] p-5 grid grid-cols-1 lg:grid-cols-[430px_minmax(0,1fr)] gap-[22px] items-start">
        {/* Photo Gallery */}
        <div className="flex flex-col gap-2.5 w-full">
          <div className="w-full h-[360px] sm:h-[420px] rounded-[20px] overflow-hidden bg-[#f7f7f7] border border-[#ececec] flex items-center justify-center">
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
            <span className="bg-[#ffefe6] text-[#ff6e20] font-semibold px-3 py-1 rounded-full">
              {product.category_name}
            </span>
            {product.brand_name && (
              <span className="bg-[#f7f7f7] text-black font-medium px-3 py-1 rounded-full">
                {product.brand_name}
              </span>
            )}
          </div>

          <h1 className="text-[22px] sm:text-[24px] font-bold text-black leading-[1.35]">
            {product.name}
          </h1>

          {/* Price Box */}
          <div className="kova-gradient rounded-[16px] px-[18px] py-4 flex flex-col gap-1">
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
              onClick={() => void handleAdd(false)}
              className="bg-[#ff9800] hover:bg-[#eb8c00] disabled:opacity-50 transition-colors text-white text-[15px] font-bold py-3.5 px-6 rounded-full"
            >
              Add to cart
            </button>
            <button
              type="button"
              disabled={submitting || maxStock <= 0}
              onClick={() => void handleAdd(true)}
              className="kova-gradient hover:opacity-95 disabled:opacity-50 transition-opacity text-white text-[15px] font-bold py-3.5 px-6 rounded-full"
            >
              Buy now · ${(displayPrice * quantity).toFixed(2)}
            </button>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="bg-white border border-[#ececec] rounded-[20px] px-5 py-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'details' as const, label: 'Product Details' },
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

        {activeTab === 'details' && (
          <div className="max-w-[820px]">
            <p className="text-[14.5px] text-[#767676] leading-[1.65] whitespace-pre-line">
              {product.description ||
                product.short_description ||
                'No description provided.'}
            </p>
          </div>
        )}

        {activeTab === 'specs' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-[860px]">
            {Object.keys(product.specifications).length === 0 ? (
              <p className="text-[13.5px] text-[#767676]">
                No specifications listed.
              </p>
            ) : (
              Object.entries(product.specifications).map(([k, v]) => (
                <div
                  key={k}
                  className="bg-[#f7f7f7] rounded-[14px] px-4 py-3 flex items-center justify-between gap-4"
                >
                  <span className="text-[13px] font-medium text-[#767676]">
                    {k}
                  </span>
                  <span className="text-[13.5px] font-semibold text-black text-right">
                    {v}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f7f7f7] rounded-[16px] p-4">
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
                    className="border border-[#ececec] rounded-[16px] p-4 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[14px] font-semibold text-black inline-flex items-center gap-1.5">
                        <span>{rev.author}</span>
                        {rev.is_verified_purchase && (
                          <>
                            <VerifiedBadge
                              size="xs"
                              label="Verified purchase"
                            />
                            <span className="text-[#1877F2] text-[11.5px] font-medium">
                              Verified purchase
                            </span>
                          </>
                        )}
                      </p>
                      <span className="text-[12px] text-[#767676]">
                        {formatShortDate(rev.created_at)}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#ff6e20]">
                      {'★'.repeat(rev.rating)}
                      {'☆'.repeat(5 - rev.rating)}
                    </p>
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
