import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FigmaIcon } from '../../components/FigmaIcon';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from '../../components/ProductCard';
import {
  Skeleton,
  SkeletonImage,
  VerifiedStoreShowcaseSkeleton,
} from '../../components/Skeleton';
import { StoreTagCard } from '../../components/StoreTagCard';

export function VerifiedStoresPage() {
  const { bootstrapping, stores, products } = useStore();

  const verifiedStores = useMemo(() => {
    const v = stores.filter((s) => s.is_verified);
    return v.length > 0 ? v : stores;
  }, [stores]);

  const marqueeItems = useMemo(() => {
    return verifiedStores.map((s) => ({
      name: s.name,
      logo: s.logo || null,
      target: `/store/${s.slug}`,
    }));
  }, [verifiedStores]);

  return (
    <div className="bg-[#f2f2f7] min-h-screen w-full">
      <div className="kova-container px-2.5 lg:px-[10px] pt-[10px] pb-12 flex flex-col gap-[12px]">
        {/* Hero Banner */}
        {bootstrapping ? (
          <Skeleton className="w-full aspect-[16/7] sm:aspect-[3616/1184] max-h-[465px] rounded-[18px] sm:rounded-[24px]" />
        ) : (
          <Link
            to="/promotion"
            className="block w-full aspect-[16/7] sm:aspect-[3616/1184] max-h-[465px] rounded-[18px] sm:rounded-[24px] overflow-hidden relative group"
          >
            <SkeletonImage
              src="/assets/banners/hero-main.png"
              alt="Kova Verified Stores"
              wrapperClassName="absolute inset-0"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
            />
          </Link>
        )}

        {/* Two-Row Opposite-Direction Animated Marquee (pauses on hover) */}
        {marqueeItems.length > 0 && (
          <section className="flex flex-col gap-2 sm:gap-[10px] py-1">
            {[
              { items: marqueeItems, direction: 'left' as const },
              {
                items: [...marqueeItems].reverse(),
                direction: 'right' as const,
              },
            ].map((row, rowIdx) => (
              <div
                key={rowIdx}
                className="marquee-row overflow-hidden w-full [mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-20px),transparent)] sm:[mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]"
              >
                <div
                  className={
                    row.direction === 'left'
                      ? 'marquee-track-left'
                      : 'marquee-track-right'
                  }
                >
                  {[0, 1].map((dupIdx) => (
                    <div
                      key={dupIdx}
                      aria-hidden={dupIdx === 1}
                      className="flex items-center gap-2 sm:gap-[10px] pr-2 sm:pr-[10px] shrink-0"
                    >
                      {row.items.map((pill, idx) => (
                        <Link
                          key={`${rowIdx}-${dupIdx}-${pill.name}-${idx}`}
                          to={pill.target}
                          tabIndex={dupIdx === 1 ? -1 : 0}
                          className="h-[44px] sm:h-[60px] rounded-full pl-[5px] sm:pl-[6px] pr-4 sm:pr-6 inline-flex items-center gap-2.5 sm:gap-[14px] shrink-0 bg-[#ffdfcd] hover:bg-[#ffcfa8] text-[#ff6800] transition-colors"
                        >
                          <span className="w-[34px] h-[34px] sm:w-[48px] sm:h-[48px] rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-white">
                            {pill.logo ? (
                              <img
                                src={pill.logo}
                                alt={pill.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[13px] sm:text-[16px] font-bold text-[#ff6e20]">
                                {pill.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </span>
                          <span className="text-[15px] sm:text-[22px] font-medium leading-none whitespace-nowrap">
                            {pill.name}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Official Verified Store Showcases */}
        {bootstrapping && verifiedStores.length === 0 ? (
          <VerifiedStoreShowcaseSkeleton count={2} />
        ) : verifiedStores.length === 0 ? (
          <div className="bg-white border border-[#ececec] rounded-[24px] py-16 px-6 flex flex-col items-center text-center gap-3">
            <FigmaIcon name="home" className="w-10 h-10 text-[#979797]" />
            <h1 className="text-[22px] font-semibold text-black">
              No verified stores available yet
            </h1>
            <p className="text-[14px] text-[#767676] max-w-[440px]">
              Once store owners apply and are approved by Root Admin, their
              verified storefronts and product rows will appear here.
            </p>
            <Link
              to="/become-a-seller"
              className="mt-1 bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[14px] font-semibold px-6 py-3 rounded-full"
            >
              Become a seller
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6 pt-1">
            {verifiedStores.map((store) => {
              const storeItems = products
                .filter((p) => p.store_id === store.id)
                .slice(0, 5);
              return (
                <section key={store.id} className="flex flex-col gap-[11px]">
                  {/* Brand Banner with Redesigned Store Tag Card */}
                  <div className="relative w-full rounded-[22px] sm:rounded-[34px] overflow-hidden bg-white border border-[#ececec] sm:border-0 sm:bg-[#1e1e1e] sm:h-[340px] lg:h-[400px]">
                    <Link
                      to={`/store/${store.slug}`}
                      className="block w-full h-[155px] sm:h-full bg-[#1e1e1e]"
                    >
                      {store.banner ? (
                        <img
                          src={store.banner}
                          alt={store.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#2b2b2b] to-[#1a1a1a]" />
                      )}
                    </Link>

                    <StoreTagCard
                      store={store}
                      productsCount={store.products_count ?? storeItems.length}
                      variant="overlay"
                    />
                  </div>

                  {/* 5-Column Product Row */}
                  {storeItems.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-[10px]">
                      {storeItems.map((product) => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
