import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, ShoppingBag, UserPlus, Users } from 'lucide-react';
import {
  storeOwnerApi,
  type PaginatedResult,
  type SellerFollowerItem,
  type SellerFollowerStats,
} from '../../services/dashboardApi';
import { formatShortDate } from '../../utils/currency';

const EMPTY_STATS: SellerFollowerStats = {
  total_followers: 0,
  new_last_30_days: 0,
  ordering_followers: 0,
};

export function SellerFollowersPage() {
  const [stats, setStats] = useState<SellerFollowerStats>(EMPTY_STATS);
  const [followers, setFollowers] = useState<
    PaginatedResult<SellerFollowerItem>
  >({
    data: [],
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 280);
    return () => window.clearTimeout(t);
  }, [search]);

  const loadFollowers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await storeOwnerApi.getFollowers({
        search: debouncedSearch || undefined,
        page,
        per_page: 20,
      });
      setStats(res.stats || EMPTY_STATS);
      setFollowers(res.followers);
    } catch {
      // Keep previous state on transient error
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFollowers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadFollowers]);

  return (
    <div className="flex flex-col gap-5">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-[24px] font-bold text-black tracking-tight">
            Store Followers
          </h1>
          <p className="text-[13px] text-[#767676] mt-0.5">
            Customers who follow your storefront and stay connected with your
            updates.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadFollowers()}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-2 bg-white border border-[#ececec] hover:border-[#ff6e20] text-black text-[13px] font-semibold px-4 py-2 rounded-full transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
          />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white border border-[#ececec] rounded-[18px] p-4 flex items-center gap-3.5">
          <span className="w-11 h-11 rounded-[14px] bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#767676]">
              Total Followers
            </p>
            <p className="text-[22px] font-bold text-black leading-tight mt-0.5">
              {stats.total_followers}
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#ececec] rounded-[18px] p-4 flex items-center gap-3.5">
          <span className="w-11 h-11 rounded-[14px] bg-[#eaf7ee] text-[#189a45] flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#767676]">
              New (Last 30 Days)
            </p>
            <p className="text-[22px] font-bold text-black leading-tight mt-0.5">
              {stats.new_last_30_days}
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#ececec] rounded-[18px] p-4 flex items-center gap-3.5">
          <span className="w-11 h-11 rounded-[14px] bg-[#eef4ff] text-[#2563eb] flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#767676]">
              Repeat Buyers
            </p>
            <p className="text-[22px] font-bold text-black leading-tight mt-0.5">
              {stats.ordering_followers}
            </p>
          </div>
        </div>
      </div>

      {/* Followers Directory Card */}
      <div className="bg-white border border-[#ececec] rounded-[20px] overflow-hidden">
        <div className="p-4 border-b border-[#ececec] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-[360px]">
            <Search className="w-4 h-4 text-[#979797] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search follower by name, email, or phone..."
              className="w-full h-[38px] bg-[#f7f7f7] focus:bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-full pl-9 pr-4 text-[13px] text-black placeholder:text-[#979797] outline-none transition-colors"
            />
          </div>
          <p className="text-[12.5px] font-medium text-[#767676]">
            Showing {followers.data.length} of {followers.total} follower
            {followers.total === 1 ? '' : 's'}
          </p>
        </div>

        {loading ? (
          <div className="py-14 text-center text-[13.5px] text-[#767676]">
            Loading followers...
          </div>
        ) : followers.data.length === 0 ? (
          <div className="py-14 px-6 text-center flex flex-col items-center gap-2.5">
            <span className="w-12 h-12 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </span>
            <p className="text-[16px] font-semibold text-black">
              {debouncedSearch ? 'No matching followers' : 'No followers yet'}
            </p>
            <p className="text-[13px] text-[#767676] max-w-[380px]">
              {debouncedSearch
                ? 'Try searching with a different name, email, or phone number.'
                : 'When customers click Follow on your store card or storefront, they will appear here.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#ececec] text-[11.5px] font-semibold uppercase tracking-wide text-[#767676]">
                    <th className="py-3 px-4">Follower</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Orders</th>
                    <th className="py-3 px-4">Total Spent</th>
                    <th className="py-3 px-4 text-right">Followed On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2f2f2] text-[13.5px]">
                  {followers.data.map((f) => {
                    const initials = f.name
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <tr
                        key={f.id}
                        className="hover:bg-[#fafafa] transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3 min-w-0">
                            {f.avatar ? (
                              <img
                                src={f.avatar}
                                alt={f.name}
                                className="w-9 h-9 rounded-full object-cover border border-[#ececec] shrink-0"
                              />
                            ) : (
                              <span className="w-9 h-9 rounded-full bg-[#ffefe6] text-[#ff6e20] text-[12px] font-bold flex items-center justify-center shrink-0">
                                {initials}
                              </span>
                            )}
                            <span className="font-semibold text-black truncate">
                              {f.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="text-[13px] text-black truncate max-w-[240px]">
                              {f.email}
                            </span>
                            {f.phone && (
                              <span className="text-[12px] text-[#767676]">
                                {f.phone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center bg-[#f4f4f4] text-black text-[12px] font-semibold px-2.5 py-0.5 rounded-full">
                            {f.orders_count}{' '}
                            {f.orders_count === 1 ? 'order' : 'orders'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#189a45]">
                          ${Number(f.total_spent || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-[12.5px] text-[#767676] whitespace-nowrap">
                          {f.followed_at ? formatShortDate(f.followed_at) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-[#f0f0f0]">
              {followers.data.map((f) => {
                const initials = f.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <div key={f.id} className="p-4 flex items-start gap-3">
                    {f.avatar ? (
                      <img
                        src={f.avatar}
                        alt={f.name}
                        className="w-10 h-10 rounded-full object-cover border border-[#ececec] shrink-0"
                      />
                    ) : (
                      <span className="w-10 h-10 rounded-full bg-[#ffefe6] text-[#ff6e20] text-[12px] font-bold flex items-center justify-center shrink-0">
                        {initials}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[14px] font-semibold text-black truncate">
                          {f.name}
                        </p>
                        <span className="text-[11.5px] text-[#767676] shrink-0">
                          {f.followed_at ? formatShortDate(f.followed_at) : '—'}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-[#767676] truncate">
                        {f.email}
                      </p>
                      {f.phone && (
                        <p className="text-[12px] text-[#767676]">{f.phone}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="bg-[#f4f4f4] text-black text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full">
                          {f.orders_count}{' '}
                          {f.orders_count === 1 ? 'order' : 'orders'}
                        </span>
                        <span className="text-[12px] font-semibold text-[#189a45]">
                          ${Number(f.total_spent || 0).toFixed(2)} spent
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {followers.last_page > 1 && (
              <div className="px-4 py-3 border-t border-[#ececec] flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-1.5 rounded-full border border-[#ececec] text-[12.5px] font-semibold text-black hover:border-[#ff6e20] disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-[12.5px] text-[#767676]">
                  Page {followers.current_page} of {followers.last_page}
                </span>
                <button
                  type="button"
                  disabled={page >= followers.last_page}
                  onClick={() =>
                    setPage((p) => Math.min(followers.last_page, p + 1))
                  }
                  className="px-3.5 py-1.5 rounded-full border border-[#ececec] text-[12.5px] font-semibold text-black hover:border-[#ff6e20] disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
