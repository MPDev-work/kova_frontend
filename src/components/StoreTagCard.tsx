import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
      ? 'relative sm:absolute sm:left-[10px] sm:right-[10px] sm:bottom-[10px] w-full sm:w-auto sm:max-w-[920px] sm:rounded-[24px] bg-white sm:backdrop-blur-[18px] sm:bg-white/88 sm:shadow-[0_6px_28px_rgba(0,0,0,0.18)] p-2.5'
      : 'w-full rounded-[24px] bg-white border border-[#ececec] shadow-[0_2px_14px_rgba(0,0,0,0.03)] p-2.5';

  return (
    <div className={containerClasses}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Top Row on Mobile / Left+Center on Desktop */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Square Store Logo */}
          <Link
            to={`/store/${store.slug}`}
            className="w-[74px] h-[74px] sm:w-[132px] sm:h-[132px] bg-[#fafafa] border border-[#ececec] overflow-hidden shrink-0 flex items-center justify-center hover:border-[#ff6e20]/60 transition-colors rounded-[14px]"
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
            {isFollowing && <FigmaIcon name="check" className="w-3.5 h-3.5" />}
            <span>{isFollowing ? 'Following' : 'Follow'}</span>
          </button>

          {!hideNavigate && (
            <Link
              to={`/store/${store.slug}`}
              title={`Visit ${store.name}`}
              aria-label={`Visit ${store.name}`}
              className="w-[38px] h-[38px] sm:w-[40px] sm:h-[40px] rounded-full bg-[#ff6e20] hover:bg-[#e85d12] text-white inline-flex items-center justify-center shrink-0 transition-colors"
            >
              <FigmaIcon name="arrow-up-right" className="w-[18px] h-[18px]" />
            </Link>
          )}

          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Open store location on Maps"
            aria-label="Open store location on Maps"
            className="w-[38px] h-[38px] sm:w-[40px] sm:h-[40px] rounded-full bg-white hover:bg-[#ffefe6] border border-[#ff6e20]/55 text-[#ff6e20] inline-flex items-center justify-center shrink-0 transition-colors"
          >
            <FigmaIcon name="map" className="w-[17px] h-[17px]" />
          </a>
        </div>
      </div>
    </div>
  );
}
