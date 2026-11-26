import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { DashboardModal } from '../../components/DashboardPrimitives';
import { FigmaIcon } from '../../components/FigmaIcon';
import { ProductCard } from '../../components/ProductCard';
import { StorefrontSkeleton } from '../../components/Skeleton';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { VoucherCard } from '../../components/VoucherCard';
import { useStore } from '../../context/StoreContext';
import { catalogApi } from '../../services/api';
import { storeOwnerApi } from '../../services/dashboardApi';
import { formatKhr } from '../../utils/currency';
import type { Product, Promotion, Store } from '../../types/marketplace';

interface StorefrontPreviewModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal preview of the seller's live storefront matching the exact client StorefrontPage design,
 * without ever leaving Seller Center.
 */
export function StorefrontPreviewModal({
  open,
  onClose,
}: StorefrontPreviewModalProps) {
  const { user, khrRate, showToast } = useStore();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [storeVouchers, setStoreVouchers] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setPreviewProduct(null);
      try {
        const profile = await storeOwnerApi.getProfile();
        const slug = profile.slug || user?.store?.slug;
        if (!slug) {
          if (active) setLoading(false);
          return;
        }
        const [storeRes, prodRes, vouchers] = await Promise.all([
          catalogApi.getStore(slug),
          catalogApi.getStoreProducts(slug, 40),
          catalogApi.getPromotions(profile.id).catch(() => [] as Promotion[]),
        ]);
        if (active) {
          setStore(storeRes.data);
          setProducts(prodRes.products);
          setStoreVouchers(vouchers);
        }
      } catch {
        if (active) {
          showToast('Unable to load storefront preview.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, user?.store?.slug, showToast]);

  return (
    <DashboardModal
      open={open}
      onClose={onClose}
      title={
        previewProduct
          ? previewProduct.name
          : store
            ? `${store.name} · Storefront Preview`
            : 'Storefront Preview'
      }
      subtitle={
        previewProduct
          ? `${previewProduct.category_name || 'Product'} · ${
              previewProduct.in_stock ? 'In stock' : 'Out of stock'
            }`
          : 'Exact buyer view inside Seller Center · Interactive links are preview-only'
      }
      widthClass="max-w-[1120px]"
      footer={
        <div className="w-full flex flex-wrap items-center justify-between gap-2">
          {previewProduct ? (
            <button
              type="button"
              onClick={() => setPreviewProduct(null)}
              className="inline-flex items-center gap-1.5 bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-black text-[12.5px] font-semibold px-4 py-2 rounded-full transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to storefront</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/seller/storefront"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] border border-[#ececec] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit storefront</span>
              </Link>
              <Link
                to="/seller/products/new"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4 py-2 rounded-full transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add product</span>
              </Link>
            </div>
          )}

          <div className="flex items-center gap-2">
            {previewProduct && (
              <Link
                to={`/seller/products/${previewProduct.id}/edit`}
                onClick={onClose}
                className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors"
              >
                Edit product
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="bg-white border border-[#ececec] hover:border-black text-[12.5px] font-semibold text-black px-5 py-2 rounded-full transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      }
    >
      {loading ? (
        <StorefrontSkeleton />
      ) : previewProduct ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="aspect-square w-full overflow-hidden bg-[#f7f7f7] border border-[#ececec] flex items-center justify-center rounded-[14px]">
            {previewProduct.image ? (
              <img
                src={previewProduct.image}
                alt={previewProduct.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <FigmaIcon name="package" className="w-12 h-12 text-[#979797]" />
            )}
          </div>
          <div className="flex flex-col gap-3">
            <span className="self-start bg-[#ffefe6] text-[#ff6e20] text-[11px] font-semibold px-2.5 py-1 rounded-full">
              {previewProduct.category_name || 'Product'}
            </span>
            <h2 className="text-[22px] font-bold text-black leading-snug">
              {previewProduct.name}
            </h2>
            <div className="flex items-baseline gap-2.5">
              <span className="text-[28px] font-bold text-[#ff6e20]">
                ${previewProduct.price.toFixed(2)}
              </span>
              {previewProduct.regular_price > previewProduct.price && (
                <span className="text-[14px] text-[#979797] line-through">
                  ${previewProduct.regular_price.toFixed(2)}
                </span>
              )}
            </div>
            <p className="text-[12.5px] text-[#767676]">
              {formatKhr(
                previewProduct.price,
                previewProduct.price >= 300,
                khrRate,
              )}
            </p>
            {previewProduct.description && (
              <p className="text-[13.5px] text-[#555555] leading-relaxed whitespace-pre-line pt-2 border-t border-[#f0f0f0]">
                {previewProduct.description}
              </p>
            )}
          </div>
        </div>
      ) : !store ? (
        <div className="py-12 text-center flex flex-col items-center gap-3">
          <FigmaIcon name="home" className="w-10 h-10 text-[#979797]" />
          <p className="text-[16px] font-semibold text-black">
            Storefront preview unavailable
          </p>
          <Link
            to="/seller/storefront"
            onClick={onClose}
            className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full transition-colors"
          >
            Configure storefront
          </Link>
        </div>
      ) : (
        <div className="bg-[#f5f5f5] rounded-[34px] p-2.5 flex flex-col gap-3">
          {/* Exact Client StorefrontPage Hero Card */}
          <section className="bg-white border border-[#ececec] px-2.5 pt-2.5 pb-4 flex flex-col gap-3 rounded-[24px]">
            <div className="h-[180px] sm:h-[240px] w-full overflow-hidden bg-[#f7f7f7] flex items-center justify-center rounded-[14px]">
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

            <div className="flex flex-wrap items-center justify-between gap-4 px-1">
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
                  <h2 className="text-[21px] font-bold text-black inline-flex items-center gap-1.5">
                    <span className="truncate">{store.name}</span>
                    {store.is_verified && (
                      <VerifiedBadge size="md" label="Verified store" />
                    )}
                  </h2>
                  <p className="text-[13px] text-[#767676]">
                    {store.products_count ?? products.length} products
                    {store.address ? ` · ${store.address}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {store.google_maps_url && (
                  <a
                    href={store.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View store location on Google Maps"
                    aria-label="Open store location on Google Maps"
                    className="w-9 h-9 rounded-full bg-white hover:bg-[#f7f7f7] border border-[#ececec] hover:border-[#ff6e20]/50 flex items-center justify-center transition-colors shrink-0"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4.5 h-4.5"
                      aria-hidden="true"
                    >
                      <path
                        fill="#1A73E8"
                        d="M12 2C8.13 2 5 5.13 5 9c0 1.74.5 3.37 1.41 4.84.95 1.54 2.2 2.86 3.16 4.4.47.75.81 1.45 1.17 2.26.26.55.47 1.5 1.26 1.5s1-.95 1.25-1.5c.37-.81.7-1.51 1.17-2.26.96-1.53 2.21-2.85 3.16-4.4C18.5 12.37 19 10.74 19 9c0-3.87-3.13-7-7-7z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 2C8.13 2 5 5.13 5 9c0 1.74.5 3.37 1.41 4.84L12 9V2z"
                      />
                      <path
                        fill="#4285F4"
                        d="M12 2v7l5.59-3.16C16.43 3.55 14.37 2 12 2z"
                      />
                      <path
                        fill="#FBBC04"
                        d="M6.41 13.84c.95 1.54 2.2 2.86 3.16 4.4L12 9l-5.59 4.84z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 9l-2.43 9.24c.47.75.81 1.45 1.17 2.26.26.55.47 1.5 1.26 1.5s1-.95 1.25-1.5c.37-.81.7-1.51 1.17-2.26.96-1.53 2.21-2.85 3.16-4.4.91-1.47 1.42-3.1 1.42-4.84 0-1.15-.28-2.24-.77-3.2L12 9z"
                      />
                      <circle cx="12" cy="9" r="2.7" fill="#FFFFFF" />
                    </svg>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() =>
                    showToast(
                      'Preview mode: buyers click this button to message your store.',
                    )
                  }
                  className="bg-[#ffefe6] hover:bg-[#ffdfcd] text-[#ff6e20] text-[13px] font-semibold px-4 py-2 rounded-full transition-colors"
                >
                  Contact store
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
                <h3 className="text-[16px] font-bold text-black">
                  Store Vouchers ({storeVouchers.length})
                </h3>
                <span className="text-[12px] text-[#767676]">
                  Applies to {store.name} products only
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {storeVouchers.map((promo) => (
                  <VoucherCard
                    key={promo.id}
                    promo={promo}
                    isApplied={false}
                    onApply={(code) =>
                      showToast(
                        `Preview mode: buyers can apply voucher ${code} at checkout.`,
                      )
                    }
                    showStoreHeader={false}
                  />
                ))}
              </div>
            </section>
          )}

          {products.length === 0 ? (
            <div className="bg-white border border-[#ececec] py-12 px-6 flex flex-col items-center text-center gap-3 rounded-[24px]">
              <FigmaIcon name="package" className="w-9 h-9 text-[#979797]" />
              <p className="text-[15px] font-semibold text-black">
                No products listed in this store yet
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  previewOnly
                  onPreviewClick={(p) => setPreviewProduct(p)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardModal>
  );
}

/**
 * Route fallback (/seller/preview): opens the Storefront Preview modal cleanly and returns
 * to /seller/storefront when closed.
 */
export function SellerStorePreviewPage() {
  const navigate = useNavigate();

  return (
    <StorefrontPreviewModal
      open
      onClose={() => navigate('/seller/storefront', { replace: true })}
    />
  );
}
