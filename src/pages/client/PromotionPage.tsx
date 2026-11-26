import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FigmaIcon } from '../../components/FigmaIcon';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from '../../components/ProductCard';
import { VoucherCard } from '../../components/VoucherCard';
import {
  ProductGridSkeleton,
  Skeleton,
  SkeletonImage,
} from '../../components/Skeleton';

export function PromotionPage() {
  const {
    bootstrapping,
    products,
    promotions,
    applyCoupon,
    removeCoupon,
    appliedCoupon,
  } = useStore();

  const promoProducts = useMemo(
    () => products.filter((p) => p.discount_percent > 0),
    [products],
  );

  return (
    <div className="bg-[#f7f7f7] min-h-screen w-full">
      <div className="kova-container px-2.5 lg:px-[10px] pt-[12px] pb-12 flex flex-col gap-[14px]">
        {/* Hero Banner */}
        {bootstrapping ? (
          <Skeleton className="w-full aspect-[16/6] sm:aspect-[3616/1184] max-h-[458px] rounded-[24px]" />
        ) : (
          <Link
            to="/products"
            className="relative block w-full aspect-[16/6] sm:aspect-[3616/1184] max-h-[458px] rounded-[24px] overflow-hidden group bg-[#ff6e20]"
          >
            <SkeletonImage
              src="/assets/banners/hero-main.png"
              alt="Kova Promotions"
              wrapperClassName="absolute inset-0"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
            />
          </Link>
        )}

        {/* 5-Tile Promotional Bento Grid */}
        {bootstrapping ? (
          <section className="grid grid-cols-2 lg:grid-cols-[276px_minmax(0,1fr)_560px] gap-2.5 sm:gap-3">
            <Skeleton className="aspect-[4/3] lg:aspect-auto lg:h-[268px] rounded-[24px]" />
            <div className="col-span-2 lg:col-span-1 order-first lg:order-none flex flex-col gap-2.5 sm:gap-3">
              <Skeleton className="aspect-[16/6] lg:aspect-auto lg:h-[128px] rounded-[24px]" />
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <Skeleton className="aspect-[16/10] lg:aspect-auto lg:h-[128px] rounded-[24px]" />
                <Skeleton className="aspect-[16/10] lg:aspect-auto lg:h-[128px] rounded-[24px]" />
              </div>
            </div>
            <Skeleton className="aspect-[4/3] lg:aspect-auto lg:h-[268px] rounded-[24px]" />
          </section>
        ) : (
          <section className="grid grid-cols-2 lg:grid-cols-[276px_minmax(0,1fr)_560px] gap-2.5 sm:gap-3">
            <Link
              to="/products"
              className="relative block aspect-[4/3] lg:aspect-auto lg:h-[268px] rounded-[24px] overflow-hidden group bg-white"
            >
              <SkeletonImage
                src="/assets/banners/promo-12pct.png"
                alt="Voucher Offers"
                wrapperClassName="absolute inset-0"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </Link>

            <div className="col-span-2 lg:col-span-1 order-first lg:order-none flex flex-col gap-2.5 sm:gap-3">
              <Link
                to="/products"
                className="relative block aspect-[16/6] lg:aspect-auto lg:h-[128px] rounded-[24px] overflow-hidden group bg-white"
              >
                <SkeletonImage
                  src="/assets/banners/promo-flash.png"
                  alt="Flash Sale"
                  wrapperClassName="absolute inset-0"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </Link>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <Link
                  to="/products"
                  className="relative block aspect-[16/10] lg:aspect-auto lg:h-[128px] rounded-[24px] overflow-hidden group bg-white"
                >
                  <SkeletonImage
                    src="/assets/banners/promo-treat-yourself.png"
                    alt="Featured Deals"
                    wrapperClassName="absolute inset-0"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </Link>
                <Link
                  to="/products"
                  className="relative block aspect-[16/10] lg:aspect-auto lg:h-[128px] rounded-[24px] overflow-hidden group bg-white"
                >
                  <SkeletonImage
                    src="/assets/banners/promo-90pct.png"
                    alt="Shopping Day Deals"
                    wrapperClassName="absolute inset-0"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </Link>
              </div>
            </div>

            <Link
              to="/products"
              className="relative block aspect-[4/3] lg:aspect-auto lg:h-[268px] rounded-[24px] overflow-hidden group bg-white"
            >
              <SkeletonImage
                src="/assets/banners/promo-1111.png"
                alt="Big Sale"
                wrapperClassName="absolute inset-0"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </Link>
          </section>
        )}

        {/* Active Vouchers from Backend Database */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[18px] font-bold text-black">Active Vouchers</h2>
          {promotions.length === 0 ? (
            <div className="bg-white border border-[#ececec] p-2.5 sm:p-3 text-center text-[13.5px] text-[#767676] rounded-[24px]">
              No active promotion codes right now. Vouchers published by stores
              or admins will appear here.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {promotions.map((promo) => (
                <VoucherCard
                  key={promo.id}
                  promo={promo}
                  isApplied={appliedCoupon?.code === promo.code}
                  onApply={(code) => void applyCoupon(code)}
                  onRemove={removeCoupon}
                  showStoreHeader
                />
              ))}
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
            <div className="bg-white border border-[#ececec] py-14 px-6 flex flex-col items-center text-center gap-3 rounded-[24px]">
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
