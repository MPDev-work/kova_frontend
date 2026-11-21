import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FigmaIcon } from '../components/FigmaIcon';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import {
  ProductGridSkeleton,
  Skeleton,
  SkeletonImage,
} from '../components/Skeleton';

export function FreeDeliveryPage() {
  const { bootstrapping, products, categories, promotions, applyCoupon } =
    useStore();
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const freeShipPromo = promotions.find(
    (p) => p.discount_type === 'free_shipping',
  );

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'all') return products;
    if (activeCategory === 'under15')
      return products.filter((p) => p.price < 15);
    if (activeCategory === 'verified')
      return products.filter((p) => p.store_verified);
    return products.filter((p) => p.category_slug === activeCategory);
  }, [products, activeCategory]);

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
              alt="Kova Delivery Zone"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
            />
          </Link>
        )}

        {/* Delivery Zone Callout */}
        <section className="bg-[#ff6d11] rounded-[18px] px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[20px] sm:text-[22px] font-bold text-white leading-[1.3]">
              DELIVERY ACROSS ALL 25 PROVINCES OF CAMBODIA
            </h1>
            <p className="text-[13.5px] text-white/95">
              Compare store shipping rates at checkout or apply a free-shipping
              promotion code.
            </p>
          </div>
          {freeShipPromo && (
            <button
              type="button"
              onClick={() => void applyCoupon(freeShipPromo.code)}
              className="bg-white hover:bg-[#ffefe6] text-[#ff6d11] text-[13px] font-bold px-5 py-2.5 rounded-full transition-colors shrink-0"
            >
              Apply {freeShipPromo.code}
            </button>
          )}
        </section>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
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
              className={`px-4 py-2 rounded-full text-[13px] transition-colors ${
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
          <div className="bg-white border border-[#ececec] rounded-[20px] py-14 px-6 flex flex-col items-center text-center gap-3">
            <FigmaIcon name="truck" className="w-8 h-8 text-[#979797]" />
            <p className="text-[16px] font-semibold text-black">
              No products available in this filter yet
            </p>
            <p className="text-[13.5px] text-[#767676]">
              Listings from approved stores will appear here automatically.
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
