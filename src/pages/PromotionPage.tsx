import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FigmaIcon } from '../components/FigmaIcon';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import {
  ProductGridSkeleton,
  Skeleton,
  SkeletonImage,
} from '../components/Skeleton';

export function PromotionPage() {
  const { bootstrapping, products, promotions, applyCoupon, appliedCoupon } =
    useStore();

  const promoProducts = useMemo(
    () => products.filter((p) => p.discount_percent > 0),
    [products],
  );

  return (
    <div className="bg-[#f7f7f7] min-h-screen w-full">
      <div className="kova-container px-2.5 lg:px-[10px] pt-[12px] pb-12 flex flex-col gap-[14px]">
        {/* Hero Banner */}
        {bootstrapping ? (
          <Skeleton className="w-full aspect-[3616/1184] min-h-[180px] max-h-[458px] rounded-[24px]" />
        ) : (
          <Link
            to="/products"
            className="block w-full aspect-[3616/1184] min-h-[180px] max-h-[458px] rounded-[24px] overflow-hidden group"
          >
            <SkeletonImage
              src="/assets/banners/hero-main.png"
              alt="Kova Promotions"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
            />
          </Link>
        )}

        {/* 5-Tile Promotional Bento Grid */}
        {bootstrapping ? (
          <section className="grid grid-cols-1 lg:grid-cols-[276px_minmax(0,1fr)_560px] gap-3">
            <Skeleton className="h-[220px] lg:h-[268px] rounded-[18px]" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-[128px] rounded-[18px]" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-[128px] rounded-[18px]" />
                <Skeleton className="h-[128px] rounded-[18px]" />
              </div>
            </div>
            <Skeleton className="h-[220px] lg:h-[268px] rounded-[18px]" />
          </section>
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-[276px_minmax(0,1fr)_560px] gap-3">
            <Link
              to="/products"
              className="block h-[220px] lg:h-[268px] rounded-[18px] overflow-hidden group"
            >
              <SkeletonImage
                src="/assets/banners/promo-12pct.png"
                alt="Voucher Offers"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </Link>

            <div className="flex flex-col gap-3">
              <Link
                to="/products"
                className="block h-[128px] rounded-[18px] overflow-hidden group"
              >
                <SkeletonImage
                  src="/assets/banners/promo-flash.png"
                  alt="Flash Sale"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </Link>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/products"
                  className="block h-[128px] rounded-[18px] overflow-hidden group"
                >
                  <SkeletonImage
                    src="/assets/banners/promo-treat-yourself.png"
                    alt="Featured Deals"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </Link>
                <Link
                  to="/products"
                  className="block h-[128px] rounded-[18px] overflow-hidden group"
                >
                  <SkeletonImage
                    src="/assets/banners/promo-90pct.png"
                    alt="Shopping Day Deals"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </Link>
              </div>
            </div>

            <Link
              to="/products"
              className="block h-[220px] lg:h-[268px] rounded-[18px] overflow-hidden group"
            >
              <SkeletonImage
                src="/assets/banners/promo-1111.png"
                alt="Big Sale"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </Link>
          </section>
        )}

        {/* Active Vouchers from Backend Database */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[18px] font-bold text-black">Active Vouchers</h2>
          {promotions.length === 0 ? (
            <div className="bg-white border border-[#ececec] rounded-[16px] p-6 text-center text-[13.5px] text-[#767676]">
              No active promotion codes right now. Vouchers published by stores
              or admins will appear here.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {promotions.map((promo) => {
                const isApplied = appliedCoupon?.code === promo.code;
                const valueText =
                  promo.discount_type === 'percentage'
                    ? `${promo.discount_value}% OFF`
                    : promo.discount_type === 'free_shipping'
                      ? 'FREE SHIP'
                      : `$${promo.discount_value} OFF`;
                return (
                  <div
                    key={promo.id}
                    className="bg-white border-[1.5px] border-[#ffdfcd] rounded-[16px] px-4 py-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[16px] font-bold text-[#ff6e20] leading-tight">
                        {valueText}
                      </p>
                      <p className="text-[12px] text-[#767676] truncate mt-0.5">
                        Code:{' '}
                        <strong className="text-black">{promo.code}</strong>
                        {promo.min_order_amount
                          ? ` · Min $${promo.min_order_amount}`
                          : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void applyCoupon(promo.code)}
                      className={`text-[12px] font-semibold px-3.5 py-1.5 rounded-full transition-colors shrink-0 ${
                        isApplied
                          ? 'bg-[#029500] text-white'
                          : 'bg-[#ff6e20] hover:bg-[#e85d12] text-white'
                      }`}
                    >
                      {isApplied ? 'Applied' : 'Apply'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Discounted Products Grid */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[18px] font-bold text-black">
            Discounted Products ({promoProducts.length})
          </h2>
          {bootstrapping && promoProducts.length === 0 ? (
            <ProductGridSkeleton count={10} />
          ) : promoProducts.length === 0 ? (
            <div className="bg-white border border-[#ececec] rounded-[20px] py-14 px-6 flex flex-col items-center text-center gap-3">
              <FigmaIcon name="tag" className="w-8 h-8 text-[#979797]" />
              <p className="text-[16px] font-semibold text-black">
                No discounted products yet
              </p>
              <p className="text-[13.5px] text-[#767676]">
                Products with active discount prices in the database will appear
                here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-[10px]">
              {promoProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
