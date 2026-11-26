import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Check } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { FigmaIcon } from './FigmaIcon';
import { VerifiedBadge } from './VerifiedBadge';
import {
  extractStoreLocationTags,
  getStoreGoogleMapsHref,
} from '../utils/storeLocation';
import type { Store } from '../types/marketplace';

function formatCompactCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M+`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K+`;
  }
  return String(count);
}

export function GoogleMapsPinIcon({
  className = 'w-[18px] h-[18px]',
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#1A73E8"
        d="M12 2C8.13 2 5 5.13 5 9c0 1.74.5 3.37 1.41 4.84.95 1.54 2.2 2.86 3.16 4.4.47.75.81 1.45 1.17 2.26.26.55.47 1.5 1.26 1.5s1-.95 1.25-1.5c.37-.81.7-1.51 1.17-2.26.96-1.53 2.21-2.85 3.16-4.4C18.5 12.37 19 10.74 19 9c0-3.87-3.13-7-7-7z"
      />
      <path
        fill="#EA4335"
        d="M12 2C8.13 2 5 5.13 5 9c0 1.74.5 3.37 1.41 4.84L12 9V2z"
      />
      <path fill="#4285F4" d="M12 2v7l5.59-3.16C16.43 3.55 14.37 2 12 2z" />
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
  );
}

interface StoreTagCardProps {
  store: Store;
  productsCount?: number;
  variant?: 'overlay' | 'card';
  hideNavigate?: boolean;
  onFollowChanged?: (next: {
    is_following: boolean;
    followers_count: number;
  }) => void;
}

export function StoreTagCard({
  store,
  productsCount,
  variant = 'card',
  hideNavigate = false,
  onFollowChanged,
}: StoreTagCardProps) {
  const navigate = useNavigate();
  const { isSignedIn, followedStoreIds, toggleFollowStore, showToast } =
    useStore();
  const [busy, setBusy] = useState(false);
  const [localFollowersCount, setLocalFollowersCount] = useState<number | null>(
    null,
  );

  const isFollowing = useMemo(
    () =>
      followedStoreIds.includes(store.id) ||
      Boolean(store.is_following && isSignedIn),
    [followedStoreIds, store.id, store.is_following, isSignedIn],
  );

  const followersCount =
    localFollowersCount !== null
      ? localFollowersCount
      : Number(store.followers_count ?? 0);

  const resolvedProductsCount =
    productsCount !== undefined
      ? productsCount
      : Number(store.products_count ?? 0);

  const locationTags = useMemo(() => extractStoreLocationTags(store), [store]);
  const mapsHref = useMemo(() => getStoreGoogleMapsHref(store), [store]);

  const handleFollowClick = async () => {
    if (!isSignedIn) {
      showToast('Please sign in to follow stores.');
      navigate('/login');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const result = await toggleFollowStore(store.id);
      if (result) {
        setLocalFollowersCount(result.followers_count);
        onFollowChanged?.(result);
      }
    } finally {
      setBusy(false);
    }
  };

  const containerClasses =
    variant === 'overlay'
      ? 'relative sm:absolute sm:left-[12px] sm:right-[12px] sm:bottom-[12px] w-full sm:w-auto sm:max-w-[920px] sm:rounded-[24px] bg-white sm:backdrop-blur-[18px] sm:bg-white/88 sm:shadow-[0_6px_28px_rgba(0,0,0,0.18)] p-2.5'
      : 'w-full rounded-[22px] sm:rounded-[24px] bg-white border border-[#ececec] shadow-[0_2px_14px_rgba(0,0,0,0.03)] p-3.5 sm:p-5';

  return (
    <div className={containerClasses}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Top Row on Mobile / Left+Center on Desktop */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Square Store Logo */}
          <Link
            to={`/store/${store.slug}`}
            className="w-[74px] h-[74px] sm:w-[132px] sm:h-[132px] rounded-[12px] sm:rounded-[20px] bg-[#fafafa] border border-[#ececec] overflow-hidden shrink-0 flex items-center justify-center hover:border-[#ff6e20]/60 transition-colors"
          >
            {store.logo ? (
              <img
                src={store.logo}
                alt={store.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <FigmaIcon
                name="home"
                className="w-8 h-8 sm:w-11 sm:h-11 text-[#ff6e20]"
              />
            )}
          </Link>

          {/* Store Identity, Stats & Location Pills */}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Link
                to={`/store/${store.slug}`}
                className="text-[18px] sm:text-[26px] font-extrabold text-black hover:text-[#ff6e20] transition-colors tracking-tight truncate leading-tight"
              >
                {store.name}
              </Link>
              {store.is_verified && (
                <VerifiedBadge size="md" label="Verified store" />
              )}
            </div>

            <p className="text-[12px] sm:text-[13px] font-medium text-[#6f6f6f] truncate">
              Store ID : {store.slug}
            </p>

            <p className="text-[12px] sm:text-sm text-[#ff6e20] leading-snug">
              {formatCompactCount(followersCount)}{' '}
              {followersCount === 1 ? 'Follower' : 'Followers'} -{' '}
              {resolvedProductsCount}{' '}
              {resolvedProductsCount === 1 ? 'Product' : 'Products'}
            </p>
            <div className="flex flex-wrap items-center">
              {locationTags.map((tag) => (
                <span key={tag} className="text-sm text-gray-500">
                  {tag},
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Location Section (full width below logo row so pills breathe) */}
        {/* <div className="flex sm:hidden flex-col gap-1.5 pt-0.5">
          <p className="text-[13px] font-bold text-[#333333] inline-flex items-center gap-1.5 leading-tight">
            <span>Store location</span>
            <MapPin className="w-3.5 h-3.5 text-[#ff6e20] shrink-0" />
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {locationTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center border border-[#ff6e20]/65 bg-white text-[#ff6e20] text-[11px] font-medium px-2.5 py-0.5 rounded-full leading-tight"
              >
                {tag}
              </span>
            ))}
          </div>
        </div> */}

        {/* Action Controls: Follow Pill + Navigate Icon + Google Maps Location Icon */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 sm:self-start pt-0.5 sm:pt-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleFollowClick()}
            className={`flex-1 sm:flex-none h-[38px] sm:h-[40px] px-5 sm:px-6 rounded-full text-[13px] sm:text-[13.5px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 ${
              isFollowing
                ? 'bg-[#ffefe6] hover:bg-[#ffe1d0] border border-[#ff6e20] text-[#ff6e20]'
                : 'bg-[#ff6e20] hover:bg-[#e85d12] text-white'
            }`}
          >
            {isFollowing && <Check className="w-3.5 h-3.5 stroke-[2.6]" />}
            <span>{isFollowing ? 'Following' : 'Follow'}</span>
          </button>

          {!hideNavigate && (
            <Link
              to={`/store/${store.slug}`}
              title={`Visit ${store.name}`}
              aria-label={`Visit ${store.name}`}
              className="w-[38px] h-[38px] sm:w-[40px] sm:h-[40px] rounded-full bg-[#ff6e20] hover:bg-[#e85d12] text-white inline-flex items-center justify-center shrink-0 transition-colors"
            >
              <ArrowUpRight className="w-[19px] h-[19px]" strokeWidth={2.25} />
            </Link>
          )}

          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Open store location in Google Maps"
            aria-label="Open store location in Google Maps"
            className="w-[38px] h-[38px] sm:w-[40px] sm:h-[40px] rounded-full bg-white hover:bg-[#ffefe6] border border-[#ff6e20]/55 inline-flex items-center justify-center shrink-0 transition-colors"
          >
            <GoogleMapsPinIcon className="w-[18px] h-[18px]" />
          </a>
        </div>
      </div>
    </div>
  );
}
