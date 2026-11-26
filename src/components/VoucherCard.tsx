import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
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

function formatCountdownDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const hms = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}

export function VoucherCard({
  promo,
  isApplied,
  onApply,
  onRemove,
  showStoreHeader = true,
}: VoucherCardProps) {
  const startMs = promo.start_date ? new Date(promo.start_date).getTime() : NaN;
  const endMs = promo.end_date ? new Date(promo.end_date).getTime() : NaN;
  const hasCountdown = !Number.isNaN(endMs) || !Number.isNaN(startMs);

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!hasCountdown) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasCountdown]);

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

  const countdown = (() => {
    if (!Number.isNaN(startMs) && nowMs < startMs) {
      return {
        label: `Starts in ${formatCountdownDuration(startMs - nowMs)}`,
        expired: false,
        urgent: false,
      };
    }
    if (!Number.isNaN(endMs)) {
      const remaining = endMs - nowMs;
      if (remaining <= 0) {
        return { label: 'Expired', expired: true, urgent: true };
      }
      return {
        label: `Ends in ${formatCountdownDuration(remaining)}`,
        expired: false,
        urgent: remaining < 86_400_000,
      };
    }
    return null;
  })();

  return (
    <div className="bg-white border-[1.5px] border-[#ffdfcd] p-2.5 flex flex-col gap-2.5 rounded-[24px]">
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
                  <FigmaIcon
                    name="home"
                    className="w-3.5 h-3.5 text-[#ff6e20]"
                  />
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
          {promo.name?.trim() && (
            <p className="text-[13px] font-semibold text-black truncate mt-0.5">
              {promo.name.trim()}
            </p>
          )}
          <p className="text-[12px] text-[#767676] truncate mt-0.5">
            Code: <strong className="text-black">{promo.code}</strong>
            {minAmount ? ` · Min $${minAmount.toFixed(2)}` : ''}
          </p>
          {countdown && (
            <p
              className={`inline-flex items-center gap-1 text-[11.5px] font-semibold tabular-nums mt-1 ${
                countdown.urgent ? 'text-[#e5322d]' : 'text-[#ff6e20]'
              }`}
            >
              <Clock className="w-3 h-3 shrink-0" />
              <span>{countdown.label}</span>
            </p>
          )}
          {promo.store && showStoreHeader && (
            <p className="text-[11px] text-[#8a8a8a] truncate mt-0.5">
              Valid only on {promo.store.name} products
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={countdown?.expired && !isApplied}
          onClick={() => {
            if (isApplied && onRemove) {
              onRemove();
            } else {
              onApply(promo.code);
            }
          }}
          className={`text-[12px] font-semibold px-3.5 py-1.5 rounded-full transition-colors shrink-0 disabled:opacity-45 disabled:cursor-not-allowed ${
            isApplied
              ? 'bg-[#029500] hover:bg-[#027d00] text-white'
              : 'bg-[#ff6e20] hover:bg-[#e85d12] text-white'
          }`}
        >
          {isApplied ? 'Applied' : countdown?.expired ? 'Expired' : 'Apply'}
        </button>
      </div>
    </div>
  );
}
