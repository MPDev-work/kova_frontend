import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store as StoreIcon } from 'lucide-react';
import { FigmaIcon, ICON_STROKE_WIDTH } from '../../components/FigmaIcon';
import { useStore } from '../../context/StoreContext';
import { StoreTagCard } from '../../components/StoreTagCard';
import { StoreTagCardSkeleton } from '../../components/Skeleton';

export function FollowingStoresPage() {
  const { followedStores, refreshFollowing } = useStore();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      setRefreshing(true);
      await refreshFollowing();
      if (active) setRefreshing(false);
    };
    void sync();
    return () => {
      active = false;
    };
  }, [refreshFollowing]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return followedStores;
    return followedStores.filter((store) => {
      const hay = [
        store.name,
        store.slug,
        store.province,
        store.district,
        store.commune,
        store.address,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [followedStores, search]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[24px] font-bold text-black tracking-tight">
              Following
            </h1>
            <span className="bg-[#ffefe6] text-[#ff6e20] text-[12px] font-bold px-2.5 py-0.5 rounded-full">
              {followedStores.length}
            </span>
          </div>
          <p className="text-[13.5px] text-[#767676] mt-0.5">
            Stores you follow for updates, new arrivals, and quick access.
          </p>
        </div>

        <Link
          to="/stores"
          className="self-start sm:self-auto bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors whitespace-nowrap"
        >
          Explore stores
        </Link>
      </div>

      {followedStores.length > 0 && (
        <div className="relative w-full sm:max-w-[380px]">
          <FigmaIcon
            name="search"
            className="w-4 h-4 text-[#979797] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter followed stores by name or location..."
            className="w-full h-[40px] bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-full pl-10 pr-4 text-[13px] text-black placeholder:text-[#979797] outline-none transition-colors"
          />
        </div>
      )}

      {refreshing && followedStores.length === 0 ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <StoreTagCardSkeleton key={idx} variant="card" />
          ))}
        </div>
      ) : followedStores.length === 0 ? (
        <div className="bg-white border border-[#ececec] py-14 px-6 text-center flex flex-col items-center gap-3 rounded-[24px]">
          <span className="w-14 h-14 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
            <StoreIcon className="w-6 h-6" strokeWidth={ICON_STROKE_WIDTH} />
          </span>
          <h2 className="text-[18px] font-bold text-black">
            You&apos;re not following any stores yet
          </h2>
          <p className="text-[13.5px] text-[#767676] max-w-[400px]">
            Follow your favorite verified Kova stores to keep track of their
            latest products and easily jump back to their storefronts.
          </p>
          <Link
            to="/stores"
            className="mt-1 bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13.5px] font-semibold px-6 py-2.5 rounded-full transition-colors"
          >
            Browse verified stores
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#ececec] py-12 px-6 text-center flex flex-col items-center gap-2 rounded-[24px]">
          <p className="text-[15px] font-semibold text-black">
            No matching stores
          </p>
          <p className="text-[13px] text-[#767676]">
            Try clearing your search to see all {followedStores.length} followed
            stores.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {filtered.map((store) => (
            <StoreTagCard key={store.id} store={store} variant="card" />
          ))}
        </div>
      )}
    </div>
  );
}
