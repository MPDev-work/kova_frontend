import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FigmaIcon } from '../../components/FigmaIcon';
import { useStore } from '../../context/StoreContext';
import { catalogApi } from '../../services/api';
import { ProductCard } from '../../components/ProductCard';
import { StorefrontSkeleton } from '../../components/Skeleton';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { VoucherCard } from '../../components/VoucherCard';
import type { Product, Promotion, Store } from '../../types/marketplace';

export function StorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const { appliedCoupon, applyCoupon, removeCoupon } = useStore();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [storeVouchers, setStoreVouchers] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
        <div className="bg-white border border-[#ececec] rounded-[24px] p-12 text-center max-w-[540px] mx-auto flex flex-col items-center gap-4">
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
      <section className="bg-white border border-[#ececec] rounded-[28px] px-2.5 pt-2.5 pb-4 flex flex-col gap-3">
        <div className="h-[200px] sm:h-[280px] w-full rounded-[18px] overflow-hidden bg-[#f7f7f7] flex items-center justify-center">
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
                {store.products_count ?? products.length} products
                {store.address ? ` · ${store.address}` : ''}
              </p>
            </div>
          </div>

          <Link
            to={`/help/contact?storeId=${store.id}&storeName=${encodeURIComponent(store.name)}&storeSlug=${encodeURIComponent(store.slug)}`}
            className="bg-[#ffefe6] hover:bg-[#ffdfcd] text-[#ff6e20] text-[13px] font-semibold px-4 py-2 rounded-full transition-colors"
          >
            Contact store
          </Link>
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
        <div className="bg-white border border-[#ececec] rounded-[20px] py-14 px-6 flex flex-col items-center text-center gap-3">
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
