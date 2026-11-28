import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FigmaIcon } from '../../components/FigmaIcon';
import { useClientDrawer } from '../../context/ClientDrawerContext';
import { useStore } from '../../context/StoreContext';
import { catalogApi } from '../../services/api';
import { ProductCard } from '../../components/ProductCard';
import { StorefrontSkeleton } from '../../components/Skeleton';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { VoucherCard } from '../../components/VoucherCard';
import { getStoreGoogleMapsHref } from '../../utils/storeLocation';
import type { Product, Promotion, Store } from '../../types/marketplace';

export function StorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { openMessages } = useClientDrawer();
  const {
    isSignedIn,
    followedStoreIds,
    toggleFollowStore,
    showToast,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
  } = useStore();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [storeVouchers, setStoreVouchers] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const [storeRes, prodRes] = await Promise.all([
          catalogApi.getStore(slug),
          catalogApi.getStoreProducts(slug, 40),
        ]);
        const vouchers = await catalogApi
          .getPromotions(storeRes.data.id)
          .catch(() => [] as Promotion[]);
        if (active) {
          setStore(storeRes.data);
          setProducts(prodRes.products);
          setStoreVouchers(vouchers);
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
    return <StorefrontSkeleton />;
  }

  if (notFound || !store) {
    return (
      <div className="kova-container px-4 py-16">
        <div className="bg-white border border-[#ececec] p-12 text-center max-w-[540px] mx-auto flex flex-col items-center gap-2.5 sm:gap-3 rounded-[24px]">
          <FigmaIcon name="home" className="w-10 h-10 text-[#979797]" />
          <h1 className="text-[24px] font-semibold text-black">
            Store not found
          </h1>
          <p className="text-[14px] text-[#767676]">
            This store may not be approved yet or does not exist.
          </p>
          <Link
            to="/stores"
            className="bg-[#ff6e20] text-white text-[14px] font-semibold px-6 py-3 rounded-full"
          >
            Browse stores
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="kova-container px-2.5 lg:px-[10px] pt-[14px] pb-10 flex flex-col gap-4">
      <section className="bg-white border border-[#ececec] px-2.5 pt-2.5 pb-4 flex flex-col gap-3 rounded-[24px]">
        <div className="h-[200px] sm:h-[280px] w-full overflow-hidden bg-[#f7f7f7] flex items-center justify-center rounded-[14px]">
          {store.banner ? (
            <img
              src={store.banner}
              alt={store.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <FigmaIcon name="home" className="w-12 h-12 text-[#979797]" />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="w-14 h-14 rounded-full border border-[#ececec] bg-white overflow-hidden shrink-0 flex items-center justify-center">
              {store.logo ? (
                <img
                  src={store.logo}
                  alt={store.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <FigmaIcon name="home" className="w-6 h-6 text-[#ff6e20]" />
              )}
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <h1 className="text-[22px] font-bold text-black inline-flex items-center gap-1.5">
                <span className="truncate">{store.name}</span>
                {store.is_verified && (
                  <VerifiedBadge size="md" label="Verified store" />
                )}
              </h1>
              <p className="text-[13px] text-[#767676]">
                <span className="font-semibold text-[#189a45]">
                  {store.followers_count ?? 0}{' '}
                  {(store.followers_count ?? 0) === 1
                    ? 'Follower'
                    : 'Followers'}
                </span>
                {' · '}
                {store.products_count ?? products.length} products
                {store.address ? ` · ${store.address}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 md:mr-14 min-[1580px]:mr-0">
            <button
              type="button"
              disabled={followBusy}
              onClick={async () => {
                if (!isSignedIn) {
                  showToast('Please sign in to follow stores.');
                  navigate('/login');
                  return;
                }
                setFollowBusy(true);
                try {
                  const res = await toggleFollowStore(store.id);
                  if (res) {
                    setStore((prev) =>
                      prev
                        ? {
                            ...prev,
                            is_following: res.is_following,
                            followers_count: res.followers_count,
                          }
                        : prev,
                    );
                  }
                } finally {
                  setFollowBusy(false);
                }
              }}
              className={`h-9 px-4 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 ${
                followedStoreIds.includes(store.id) ||
                (isSignedIn && store.is_following)
                  ? 'bg-[#ffefe6] hover:bg-[#ffe1d0] border border-[#ff6e20] text-[#ff6e20]'
                  : 'bg-[#ff6e20] hover:bg-[#e85d12] text-white'
              }`}
            >
              {(followedStoreIds.includes(store.id) ||
                (isSignedIn && store.is_following)) && (
                <FigmaIcon name="check" className="w-3.5 h-3.5" />
              )}
              <span>
                {followedStoreIds.includes(store.id) ||
                (isSignedIn && store.is_following)
                  ? 'Following'
                  : 'Follow'}
              </span>
            </button>

            <a
              href={getStoreGoogleMapsHref(store)}
              target="_blank"
              rel="noopener noreferrer"
              title="View store location on Maps"
              aria-label="Open store location on Maps"
              className="w-9 h-9 rounded-full bg-white hover:bg-[#ffefe6] border border-[#ececec] hover:border-[#ff6e20]/50 text-[#333333] hover:text-[#ff6e20] flex items-center justify-center transition-colors shrink-0"
            >
              <FigmaIcon name="map" className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={() => openMessages({ storeId: store.id })}
              title="Contact store"
              aria-label={`Contact ${store.name}`}
              className="w-9 h-9 rounded-full bg-[#ffefe6] hover:bg-[#ff6e20] text-[#ff6e20] hover:text-white inline-flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <FigmaIcon name="message-circle" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {store.description && (
          <p className="text-[14px] text-[#767676] px-1 leading-[1.6]">
            {store.description}
          </p>
        )}
      </section>

      {storeVouchers.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="text-[17px] font-bold text-black">
              Store Vouchers ({storeVouchers.length})
            </h2>
            <span className="text-[12px] text-[#767676]">
              Applies to {store.name} products only
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {storeVouchers.map((promo) => (
              <VoucherCard
                key={promo.id}
                promo={promo}
                isApplied={appliedCoupon?.code === promo.code}
                onApply={(code) => void applyCoupon(code)}
                onRemove={removeCoupon}
                showStoreHeader={false}
              />
            ))}
          </div>
        </section>
      )}

      {products.length === 0 ? (
        <div className="bg-white border border-[#ececec] py-14 px-6 flex flex-col items-center text-center gap-3 rounded-[24px]">
          <FigmaIcon name="package" className="w-9 h-9 text-[#979797]" />
          <p className="text-[16px] font-semibold text-black">
            No products listed in this store yet
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
