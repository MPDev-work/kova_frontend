import { Link } from 'react-router-dom';
import { FigmaIcon } from './FigmaIcon';
import { VerifiedBadge } from './VerifiedBadge';
import type { Promotion } from '../types/marketplace';

interface VoucherCardProps {
  promo: Promotion;
  isApplied: boolean;
  onApply: (code: string) => void;
  onRemove?: () => void;
  showStoreHeader?: boolean;
}

export function VoucherCard({
  promo,
  isApplied,
  onApply,
  onRemove,
  showStoreHeader = true,
}: VoucherCardProps) {
  const valueText =
    promo.discount_type === 'percentage'
      ? `${Number(promo.discount_value)}% OFF`
      : promo.discount_type === 'free_shipping'
        ? 'FREE DELIVERY'
        : `$${Number(promo.discount_value).toFixed(2)} OFF`;

  const minAmount =
    promo.min_order_amount && Number(promo.min_order_amount) > 0
      ? Number(promo.min_order_amount)
      : null;

  return (
    <div className="bg-white border-[1.5px] border-[#ffdfcd] rounded-[16px] px-4 py-3.5 flex flex-col gap-2.5">
      {showStoreHeader && (
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#f3f3f3]">
          {promo.store ? (
            <Link
              to={`/store/${promo.store.slug}`}
              className="flex items-center gap-2 min-w-0 group"
            >
              <span className="w-6 h-6 rounded-full border border-[#ececec] bg-white overflow-hidden shrink-0 flex items-center justify-center">
                {promo.store.logo ? (
                  <img
                    src={promo.store.logo}
                    alt={promo.store.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FigmaIcon name="home" className="w-3.5 h-3.5 text-[#ff6e20]" />
                )}
              </span>
              <span className="text-[12.5px] font-semibold text-black group-hover:text-[#ff6e20] transition-colors truncate">
                {promo.store.name}
              </span>
              {promo.store.is_verified && (
                <VerifiedBadge size="xs" label="Verified store" />
              )}
            </Link>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-full bg-[#ffefe6] text-[#ff6e20] shrink-0 flex items-center justify-center">
                <FigmaIcon name="tag" className="w-3.5 h-3.5" />
              </span>
              <span className="text-[12.5px] font-semibold text-black truncate">
                Kova Platform
              </span>
            </div>
          )}

          <span
            className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              promo.store
                ? 'bg-[#ffefe6] text-[#ff6e20]'
                : 'bg-[#f3f3f3] text-[#555555]'
            }`}
          >
            {promo.store ? 'Store voucher' : 'All stores'}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-[#ff6e20] leading-tight">
            {valueText}
          </p>
          <p className="text-[12px] text-[#767676] truncate mt-0.5">
            Code: <strong className="text-black">{promo.code}</strong>
            {minAmount ? ` · Min $${minAmount.toFixed(2)}` : ''}
          </p>
          {promo.store && showStoreHeader && (
            <p className="text-[11px] text-[#8a8a8a] truncate mt-0.5">
              Valid only on {promo.store.name} products
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            if (isApplied && onRemove) {
              onRemove();
            } else {
              onApply(promo.code);
            }
          }}
          className={`text-[12px] font-semibold px-3.5 py-1.5 rounded-full transition-colors shrink-0 ${
            isApplied
              ? 'bg-[#029500] hover:bg-[#027d00] text-white'
              : 'bg-[#ff6e20] hover:bg-[#e85d12] text-white'
          }`}
        >
          {isApplied ? 'Applied' : 'Apply'}
        </button>
      </div>
    </div>
  );
}
