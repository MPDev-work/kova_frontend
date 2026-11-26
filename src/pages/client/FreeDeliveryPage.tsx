import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FigmaIcon } from '../../components/FigmaIcon';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from '../../components/ProductCard';
import {
  ProductGridSkeleton,
  Skeleton,
  SkeletonImage,
} from '../../components/Skeleton';

export function FreeDeliveryPage() {
  const { bootstrapping, products, categories, promotions, applyCoupon } =
    useStore();
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const freeShipPromo = promotions.find(
    (p) => p.discount_type === 'free_shipping',
  );

  const freeDeliveryProducts = useMemo(
    () =>
      products.filter((p) => Boolean(p.has_free_delivery || p.free_shipping)),
    [products],
  );

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'all') return freeDeliveryProducts;
    if (activeCategory === 'under15')
      return freeDeliveryProducts.filter((p) => p.price < 15);
    if (activeCategory === 'verified')
      return freeDeliveryProducts.filter((p) => p.store_verified);
    return freeDeliveryProducts.filter(
      (p) => p.category_slug === activeCategory,
    );
  }, [freeDeliveryProducts, activeCategory]);

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
              alt="Kova Delivery Zone"
              wrapperClassName="absolute inset-0"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
            />
          </Link>
        )}

        {/* Delivery Zone Callout */}
        <section className="bg-[#ff6d11] rounded-[24px] px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[16px] sm:text-[22px] font-bold text-white leading-[1.3]">
              DELIVERY ACROSS ALL 25 PROVINCES OF CAMBODIA
            </h1>
            <p className="text-[12.5px] sm:text-[13.5px] text-white/95">
              Compare store shipping rates at checkout or apply a free-shipping
              promotion code.
            </p>
          </div>
          {freeShipPromo && (
            <button
              type="button"
              onClick={() => void applyCoupon(freeShipPromo.code)}
              className="self-start sm:self-auto bg-white hover:bg-[#ffefe6] text-[#ff6d11] text-[12.5px] sm:text-[13px] font-bold px-4 sm:px-5 py-2 sm:py-2.5 rounded-full transition-colors shrink-0 cursor-pointer"
            >
              Apply {freeShipPromo.code}
            </button>
          )}
        </section>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap pb-0.5 -mx-2.5 px-2.5 sm:mx-0 sm:px-0">
          {[
            { id: 'all', label: 'All Products' },
            { id: 'under15', label: 'Under $15' },
            { id: 'verified', label: 'Verified Stores' },
            ...categories.map((c) => ({ id: c.slug, label: c.name })),
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setActiveCategory(pill.id)}
              className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-[12.5px] sm:text-[13px] whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeCategory === pill.id
                  ? 'bg-[#ff6e20] text-white font-semibold'
                  : 'bg-[#ffefe6] text-black font-medium hover:bg-[#ffdfcd]'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {bootstrapping && filteredProducts.length === 0 ? (
          <ProductGridSkeleton count={10} />
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white border border-[#ececec] py-14 px-6 flex flex-col items-center text-center gap-3 rounded-[24px]">
            <FigmaIcon name="truck" className="w-8 h-8 text-[#979797]" />
            <p className="text-[16px] font-semibold text-black">
              No free delivery products available yet
            </p>
            <p className="text-[13.5px] text-[#767676]">
              Only products with Free Delivery enabled or eligible for free store delivery appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-[10px]">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
