import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FigmaIcon } from '../../components/FigmaIcon';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from '../../components/ProductCard';
import {
  HomeBannerDeckSkeleton,
  HomeCategoryListSkeleton,
  HomeUserHubSkeleton,
  ProductGridSkeleton,
  SkeletonImage,
  StoreCardGridSkeleton,
} from '../../components/Skeleton';
import { VerifiedBadge } from '../../components/VerifiedBadge';

const GUESS_TABS = [
  'All Products',
  'Featured',
  'On Sale',
  'Under $25',
  'In Stock',
] as const;

type GuessTab = (typeof GUESS_TABS)[number];

export function HomePage() {
  const {
    bootstrapping,
    isSignedIn,
    user,
    categories,
    stores,
    products,
    promotions,
    orders,
  } = useStore();
  const [activeTab, setActiveTab] = useState<GuessTab>('All Products');

  const flashProducts = useMemo(
    () => products.filter((p) => p.discount_percent > 0).slice(0, 5),
    [products],
  );

  const verifiedStores = useMemo(
    () => stores.filter((s) => s.is_verified).slice(0, 3),
    [stores],
  );

  const filteredProducts = useMemo(() => {
    switch (activeTab) {
      case 'Featured':
        return products.filter((p) => p.is_featured);
      case 'On Sale':
        return products.filter((p) => p.discount_percent > 0);
      case 'Under $25':
        return products.filter((p) => p.price <= 25);
      case 'In Stock':
        return products.filter((p) => p.in_stock);
      default:
        return products;
    }
  }, [activeTab, products]);

  const toPay = orders.filter((o) => o.payment_status === 'pending').length;
  const toShip = orders.filter(
    (o) => o.status === 'processing' || o.status === 'confirmed',
  ).length;
  const toReceive = orders.filter((o) => o.status === 'shipped').length;
  const completed = orders.filter((o) => o.status === 'delivered').length;

  const initials = (user?.name || 'G')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="kova-container px-2.5 lg:px-[10px] pt-[14px] pb-7 flex flex-col gap-4">
      {/* 1. Hero Deck */}
      <section className="grid grid-cols-1 xl:grid-cols-[244px_minmax(0,1fr)_292px] gap-3 items-stretch">
        {/* Left: Dynamic Categories from Backend */}
        <aside className="bg-white border border-[#ececec] rounded-[20px] p-3.5 flex flex-col gap-2.5 h-auto xl:h-[460px]">
          <p className="text-[15px] font-bold text-[#ff6e20] leading-[1.35]">
            Categories
          </p>
          {bootstrapping && categories.length === 0 ? (
            <HomeCategoryListSkeleton />
          ) : categories.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-3 gap-1">
              <p className="text-[13px] font-medium text-black">
                No categories yet
              </p>
              <p className="text-[11.5px] text-[#767676]">
                Categories added by admin will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-1 gap-x-3 gap-y-2 flex-1 overflow-y-auto no-scrollbar">
              {categories.slice(0, 10).map((cat) => (
                <Link
                  key={cat.id}
                  to={`/products?category=${encodeURIComponent(cat.slug)}`}
                  className="flex items-center justify-between text-[12.5px] font-medium text-black hover:text-[#ff6e20] py-0.5 transition-colors group"
                >
                  <span className="truncate">{cat.name}</span>
                  <span className="text-[14px] text-[#979797] group-hover:text-[#ff6e20] shrink-0 ml-1">
                    ›
                  </span>
                </Link>
              ))}
            </div>
          )}
        </aside>

        {/* Center: Hero & Promo Banners */}
        {bootstrapping ? (
          <HomeBannerDeckSkeleton />
        ) : (
          <div className="flex flex-col gap-2.5 xl:h-[460px]">
            <Link
              to="/promotion"
              className="block relative w-full h-[220px] sm:h-[280px] xl:h-[314px] rounded-[20px] overflow-hidden group"
            >
              <SkeletonImage
                src="/assets/banners/hero-main.png"
                alt="Kova Marketplace"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </Link>

            <div className="grid grid-cols-3 gap-2.5 h-[110px] sm:h-[136px]">
              <Link
                to="/promotion"
                className="block rounded-[16px] overflow-hidden relative group col-span-1"
              >
                <SkeletonImage
                  src="/assets/banners/promo-flash.png"
                  alt="Promotions"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </Link>
              <Link
                to="/products"
                className="block rounded-[16px] overflow-hidden relative group col-span-1"
              >
                <SkeletonImage
                  src="/assets/banners/promo-1111.png"
                  alt="Marketplace Deals"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </Link>
              <Link
                to="/free-delivery"
                className="block rounded-[16px] overflow-hidden relative group col-span-1"
              >
                <SkeletonImage
                  src="/assets/banners/promo-12pct.png"
                  alt="Delivery Offers"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </Link>
            </div>
          </div>
        )}

        {/* Right: User Quick-Hub */}
        <aside className="bg-white border border-[#ececec] rounded-[20px] p-4 flex flex-col gap-3 xl:h-[460px]">
          {bootstrapping ? (
            <HomeUserHubSkeleton />
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <Link
                  to={isSignedIn ? '/account/profile' : '/login'}
                  className="shrink-0"
                >
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-[46px] h-[46px] rounded-full object-cover border border-[#ececec]"
                    />
                  ) : (
                    <span className="w-[46px] h-[46px] rounded-full bg-[#ffefe6] text-[#ff6e20] text-[15px] font-bold flex items-center justify-center">
                      {isSignedIn ? initials : 'K'}
                    </span>
                  )}
                </Link>
                <div className="min-w-0 leading-[1.35]">
                  <p className="text-[15px] font-bold text-black truncate">
                    {isSignedIn && user
                      ? `Hi, ${user.name}`
                      : 'Welcome to Kova'}
                  </p>
                  <p className="text-[12px] font-medium text-[#767676] truncate">
                    {isSignedIn && user
                      ? user.email
                      : 'Sign in to manage orders'}
                  </p>
                </div>
              </div>

              {isSignedIn ? (
                <div className="bg-[#ffefe6] rounded-[14px] px-2 py-2.5 grid grid-cols-4 text-center">
                  {[
                    { count: toPay, label: 'To Pay', to: '/account/orders' },
                    { count: toShip, label: 'To Ship', to: '/account/orders' },
                    {
                      count: toReceive,
                      label: 'Receive',
                      to: '/account/orders',
                    },
                    { count: completed, label: 'Done', to: '/account/orders' },
                  ].map((s) => (
                    <Link
                      key={s.label}
                      to={s.to}
                      className="flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity"
                    >
                      <span className="text-[18px] font-bold text-[#ff6e20] leading-tight">
                        {s.count}
                      </span>
                      <span className="text-[11px] font-medium text-[#767676]">
                        {s.label}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/login"
                    className="text-center bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold py-2.5 rounded-full"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="text-center bg-[#ffefe6] hover:bg-[#ffdfcd] text-[#ff6e20] text-[12.5px] font-semibold py-2.5 rounded-full"
                  >
                    Register
                  </Link>
                </div>
              )}

              {/* Active Promotion Card from DB */}
              <div className="kova-gradient rounded-[14px] px-3.5 py-3 flex flex-col gap-1.5">
                <p className="text-[13px] font-bold text-white leading-[1.35]">
                  {promotions[0]
                    ? promotions[0].name
                    : 'KHQR & Bakong Checkout'}
                </p>
                <p className="text-[11.5px] text-[#fff0e6] leading-[1.35]">
                  {promotions[0]
                    ? `Use code ${promotions[0].code} at checkout.`
                    : 'Pay verified Cambodia stores directly via Bakong KHQR.'}
                </p>
                <Link
                  to="/promotion"
                  className="mt-0.5 self-start bg-white hover:bg-[#ffefe6] text-[#ff6e20] text-[12px] font-bold px-3.5 py-[7px] rounded-full transition-colors"
                >
                  View promotions
                </Link>
              </div>

              {/* Latest Products Preview */}
              <div className="flex flex-col gap-2 mt-auto">
                <p className="text-[12.5px] font-bold text-black">
                  Latest items
                </p>
                {products.length === 0 ? (
                  <p className="text-[12px] text-[#767676] py-4 text-center bg-[#f7f7f7] rounded-[12px]">
                    No products published yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {products.slice(0, 3).map((product) => (
                      <Link
                        key={product.id}
                        to={`/product/${product.slug}`}
                        className="flex flex-col items-center gap-1 group"
                      >
                        <div className="w-full h-[74px] rounded-[12px] overflow-hidden bg-[#f7f7f7] border border-[#ececec] flex items-center justify-center">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <FigmaIcon
                              name="package"
                              className="w-5 h-5 text-[#979797]"
                            />
                          )}
                        </div>
                        <span className="text-[12px] font-bold text-[#ff6e20]">
                          ${product.price.toFixed(2)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </section>

      {/* 2. Flash Sale / Discounted Products (only if discounted products exist) */}
      {flashProducts.length > 0 && (
        <section className="bg-white border-[1.5px] border-[#ff6e20] rounded-[28px] p-2.5 flex flex-col gap-3">
          <div className="kova-gradient rounded-[16px] px-4 lg:px-[18px] py-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[18px] sm:text-[20px] font-bold text-white leading-[1.35]">
              KOVA PROMOTIONS
            </h2>
            <Link
              to="/promotion"
              className="text-[13px] font-semibold text-white hover:underline whitespace-nowrap"
            >
              See all deals
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {flashProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* 3. Verified Official Brand Stores */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[20px] font-bold text-black">
            Verified Official Stores
          </h2>
          <Link
            to="/stores"
            className="text-[13px] font-semibold text-[#ff6e20] hover:underline whitespace-nowrap"
          >
            Explore all verified stores
          </Link>
        </div>

        {bootstrapping && verifiedStores.length === 0 ? (
          <StoreCardGridSkeleton count={3} />
        ) : verifiedStores.length === 0 ? (
          <div className="bg-white border border-[#ececec] rounded-[20px] p-8 text-center flex flex-col items-center gap-2">
            <FigmaIcon name="home" className="w-8 h-8 text-[#979797]" />
            <p className="text-[15px] font-semibold text-black">
              No verified stores published yet
            </p>
            <p className="text-[13px] text-[#767676]">
              Approved and verified stores from the backend will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {verifiedStores.map((store) => (
              <Link
                key={store.id}
                to={`/store/${store.slug}`}
                className="group bg-white border border-[#ececec] hover:border-[#ff6e20]/60 rounded-[24px] p-2.5 pb-3 flex flex-col gap-2 transition-all hover:shadow-md"
              >
                <div className="h-[150px] w-full rounded-[14px] overflow-hidden bg-[#f7f7f7] flex items-center justify-center">
                  {store.banner || store.logo ? (
                    <img
                      src={store.banner || store.logo || ''}
                      alt={store.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <FigmaIcon
                      name="home"
                      className="w-10 h-10 text-[#979797]"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <p className="text-[15px] font-bold text-black group-hover:text-[#ff6e20] transition-colors inline-flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{store.name}</span>
                    <VerifiedBadge size="xs" label="Verified store" />
                  </p>
                  <span className="bg-[#ffefe6] text-[#ff6e20] text-[12px] font-semibold px-3 py-1 rounded-full whitespace-nowrap shrink-0">
                    {store.products_count ?? 0} products
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 4. Product Feed */}
      <section className="flex flex-col gap-4 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-[22px] font-bold text-black mr-1">
              Discover Products
            </h2>
            {GUESS_TABS.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-full text-[12px] transition-colors ${
                    active
                      ? 'bg-[#ff6e20] text-white font-semibold'
                      : 'bg-white text-black font-medium hover:bg-[#ffefe6] hover:text-[#ff6e20]'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
          <p className="text-[12px] font-medium text-[#767676]">
            {filteredProducts.length} product
            {filteredProducts.length === 1 ? '' : 's'}
          </p>
        </div>

        {bootstrapping && filteredProducts.length === 0 ? (
          <ProductGridSkeleton count={10} />
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white border border-[#ececec] rounded-[20px] py-14 px-6 text-center flex flex-col items-center gap-3">
            <FigmaIcon name="package" className="w-9 h-9 text-[#979797]" />
            <h3 className="text-[18px] font-semibold text-black">
              No products available yet
            </h3>
            <p className="text-[13.5px] text-[#767676] max-w-[440px]">
              Products published by approved Kova stores will appear here live.
            </p>
            <Link
              to="/become-a-seller"
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13.5px] font-semibold px-5 py-2.5 rounded-full"
            >
              Open a store
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
