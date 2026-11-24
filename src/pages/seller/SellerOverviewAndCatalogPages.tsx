import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Eye, LayoutGrid, List, Pencil, Trash2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useConfirmDelete } from '../../context/ConfirmDeleteContext';
import { ApiError } from '../../services/api';
import {
  storeOwnerApi,
  type InventoryMovementItem,
  type SellerDashboardData,
  type SellerProductItem,
} from '../../services/dashboardApi';
import { formatKhr, formatRiel, formatShortDate } from '../../utils/currency';
import { exportRowsToCsv } from '../../utils/csv';
import {
  DashboardModal,
  DashboardPageHeader,
  FilterPillTabs,
  KpiGrid,
  ProgressBreakdownCard,
  StatusPill,
  TablePagination,
  TrendAreaChart,
  type BreakdownBarItem,
  type KpiCardItem,
  type TrendSeriesPoint,
} from '../../components/DashboardPrimitives';
import { FigmaIcon } from '../../components/FigmaIcon';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import {
  DashboardKpiSkeleton,
  DashboardTableSkeleton,
} from '../../components/Skeleton';

type SellerRange = 'today' | '7d' | '30d' | 'all' | 'custom';

function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDefaultCustomRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 13);
  return { start: toLocalIsoDate(start), end: toLocalIsoDate(end) };
}

function formatCompactRangeLabel(startIso: string, endIso: string): string {
  if (!startIso || !endIso) return 'Custom';
  const fmt = (iso: string) => {
    const dt = new Date(`${iso}T00:00:00`);
    return Number.isNaN(dt.getTime())
      ? iso
      : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  return startIso === endIso
    ? fmt(startIso)
    : `${fmt(startIso)} – ${fmt(endIso)}`;
}

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// ==========================================
// 1. Seller Overview Dashboard (/seller) — Figma Seller · 01
// ==========================================
export function SellerOverviewPage() {
  const { user, khrRate, showToast } = useStore();
  const defaultCustom = useMemo(() => getDefaultCustomRange(), []);
  const [range, setRange] = useState<SellerRange>('30d');
  const [customStart, setCustomStart] = useState(defaultCustom.start);
  const [customEnd, setCustomEnd] = useState(defaultCustom.end);
  const [appliedCustom, setAppliedCustom] = useState(defaultCustom);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [data, setData] = useState<SellerDashboardData | null>(null);
  const [products, setProducts] = useState<SellerProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load catalog products once for low-stock list & product thumbnails
  useEffect(() => {
    let active = true;
    storeOwnerApi
      .getProducts({ per_page: 100 })
      .then((res) => {
        if (active) setProducts(res.data);
      })
      .catch(() => {
        /* non-blocking */
      });
    return () => {
      active = false;
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    setRefreshing(true);
    try {
      const params =
        range === 'custom'
          ? {
              range: 'custom' as const,
              start_date: appliedCustom.start,
              end_date: appliedCustom.end,
            }
          : { range };
      const dash = await storeOwnerApi.getDashboard(params);
      setData(dash);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to load store metrics.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range, appliedCustom.start, appliedCustom.end, showToast]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void loadDashboard();
    });
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  const handleSelectPreset = (next: Exclude<SellerRange, 'custom'>) => {
    setRange(next);
    setShowCustomPicker(false);
  };

  const handleToggleCustom = () => {
    if (range === 'custom') {
      setShowCustomPicker((prev) => !prev);
      return;
    }
    setCustomStart(appliedCustom.start);
    setCustomEnd(appliedCustom.end);
    setShowCustomPicker(true);
  };

  const handleApplyCustom = () => {
    if (!customStart || !customEnd) {
      showToast('Please select both a start date and an end date.');
      return;
    }
    if (customEnd < customStart) {
      showToast('End date must be on or after the start date.');
      return;
    }
    setAppliedCustom({ start: customStart, end: customEnd });
    setRange('custom');
    setShowCustomPicker(false);
  };

  const trendPoints: TrendSeriesPoint[] = useMemo(() => {
    if (!data?.trend || data.trend.length === 0) return [];
    return data.trend.map((pt) => ({
      label: pt.label,
      primary: Number(pt.primary) || 0,
      secondary: Number(pt.secondary) || 0,
    }));
  }, [data]);

  const categoryBreakdown: BreakdownBarItem[] = useMemo(() => {
    const rows = data?.category_breakdown ?? [];
    if (rows.length === 0) {
      return [
        {
          label: 'No category sales in this period',
          rightText: '0 units',
          percent: 0,
          color: 'neutral',
        },
      ];
    }
    const colors: BreakdownBarItem['color'][] = [
      'orange',
      'green',
      'orange',
      'neutral',
    ];
    return rows.map((row, i) => ({
      label: row.category_name,
      rightText: `${row.units_sold} sold · $${Number(row.revenue).toFixed(2)} (${row.percent}%)`,
      percent: row.percent,
      color: colors[i] ?? 'neutral',
    }));
  }, [data]);

  const lowStockProducts = useMemo(
    () =>
      products
        .filter((p) => p.stock_quantity <= (p.low_stock_threshold ?? 5))
        .slice(0, 4),
    [products],
  );

  const firstName = user?.name?.split(' ')[0] || 'Seller';
  const todayIso = toLocalIsoDate(new Date());

  if (loading || !data) {
    return (
      <div className="flex flex-col gap-5">
        <DashboardPageHeader
          title={`${getTimeGreeting()}, ${firstName}`}
          subtitle="Loading live store performance across Cambodia..."
        />
        <DashboardKpiSkeleton count={8} />
        <DashboardTableSkeleton rows={5} />
      </div>
    );
  }

  const f = data.financials;
  const o = data.orders;
  const inv = data.inventory;
  const isFiltered = range !== 'all';
  const activePeriodLabel =
    data.range?.label ||
    (range === 'today'
      ? 'Today'
      : range === '7d'
        ? 'Last 7 days'
        : range === '30d'
          ? 'Last 30 days'
          : range === 'custom'
            ? formatCompactRangeLabel(appliedCustom.start, appliedCustom.end)
            : 'All time');

  const subtitleSuffix =
    range === 'today'
      ? 'today.'
      : range === '7d'
        ? 'over the last 7 days.'
        : range === '30d'
          ? 'over the last 30 days.'
          : range === 'custom'
            ? `for ${activePeriodLabel}.`
            : 'across all time.';

  const avgOrder = o.total > 0 ? f.gross_sales / o.total : 0;
  const publishedCount =
    inv.published_products ??
    products.filter((p) => p.status === 'published').length;
  const outOfStockCount =
    inv.out_of_stock_count ??
    products.filter((p) => p.stock_quantity === 0).length;
  const lifetimeWithdrawable =
    f.lifetime_available_balance ?? f.available_balance;

  const kpis: KpiCardItem[] = [
    {
      label: 'Total revenue',
      value: `$${f.gross_sales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${formatRiel(f.gross_sales, khrRate)} · ${activePeriodLabel}`,
      badge: 'Gross',
      tone: 'green',
    },
    {
      label: 'Net revenue',
      value: `$${f.net_earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `After $${f.platform_commission.toFixed(2)} platform fee`,
      badge: 'Net',
      tone: 'green',
    },
    {
      label: 'Total orders',
      value: String(o.total),
      sub: `${o.pending} pending · ${o.completed} delivered`,
      badge: o.pending > 0 ? `${o.pending} pending` : 'Up to date',
      tone: o.pending > 0 ? 'orange' : 'green',
    },
    {
      label: 'Average order value',
      value: `$${avgOrder.toFixed(2)}`,
      sub: `${formatRiel(avgOrder, khrRate)} per order`,
      badge: 'AOV',
      tone: 'green',
    },
    {
      label: isFiltered ? 'Period net balance' : 'Available balance',
      value: `$${f.available_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: isFiltered
        ? `$${lifetimeWithdrawable.toFixed(2)} total withdrawable`
        : `$${f.pending_payouts.toFixed(2)} pending withdrawal`,
      badge: isFiltered ? activePeriodLabel : 'Withdrawable',
      tone: 'orange',
    },
    {
      label: isFiltered ? 'New catalog SKUs' : 'Catalog SKUs',
      value: String(isFiltered ? (inv.new_products ?? 0) : inv.total_products),
      sub: isFiltered
        ? `${inv.total_products} total · ${publishedCount} published`
        : `${publishedCount} published listings`,
      badge: isFiltered ? 'Added' : 'Active',
      tone: 'green',
    },
    {
      label: 'Paid payouts',
      value: `$${f.paid_payouts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: isFiltered
        ? `Settled in ${activePeriodLabel.toLowerCase()}`
        : 'Settled to bank / Bakong',
      badge: 'Settled',
      tone: 'green',
    },
    {
      label: 'Low stock alerts',
      value: String(inv.low_stock_count),
      sub: `${outOfStockCount} out of stock · ${inv.low_stock_count} low`,
      badge:
        inv.low_stock_count > 0 ? `${inv.low_stock_count} alerts` : 'Healthy',
      tone: inv.low_stock_count > 0 ? 'red' : 'green',
    },
  ];

  const recentOrders = data.recent_orders ?? [];

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title={`${getTimeGreeting()}, ${firstName}`}
        subtitle={`Here is how ${user?.store?.name || 'your store'} is performing across Cambodia ${subtitleSuffix}`}
        actions={
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: '7d', label: 'Last 7 days' },
                  { id: '30d', label: 'Last 30 days' },
                  { id: 'all', label: 'All time' },
                ] as { id: Exclude<SellerRange, 'custom'>; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectPreset(t.id)}
                  className={`px-3.5 py-[7px] rounded-full text-[12px] font-semibold transition-colors ${
                    range === t.id
                      ? 'bg-[#ff6e20] text-white border border-[#ff6e20]'
                      : 'bg-white border border-[#ececec] text-[#555555] hover:border-[#cccccc] hover:text-black'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <button
                type="button"
                onClick={handleToggleCustom}
                className={`inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-full text-[12px] font-semibold transition-colors ${
                  range === 'custom' || showCustomPicker
                    ? 'bg-[#ff6e20] text-white border border-[#ff6e20]'
                    : 'bg-white border border-[#ececec] text-[#555555] hover:border-[#cccccc] hover:text-black'
                }`}
              >
                <svg
                  className="w-3.5 h-3.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {range === 'custom'
                  ? formatCompactRangeLabel(
                      appliedCustom.start,
                      appliedCustom.end,
                    )
                  : 'Custom'}
              </button>
            </div>
            <Link
              to="/seller/products?add=1"
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors"
            >
              Add product
            </Link>
          </>
        }
      />

      {showCustomPicker && (
        <div className="bg-white border border-[#ececec] rounded-[18px] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[12.5px] font-semibold text-black">
              Custom date range
            </span>
            <label className="inline-flex items-center gap-2 text-[12px] text-[#767676]">
              <span>From</span>
              <input
                type="date"
                value={customStart}
                max={customEnd || todayIso}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-[38px] rounded-full px-3.5 bg-[#f7f7f7] border border-[#e5e5e5] text-[12.5px] text-black focus:outline-none focus:border-[#ff6e20]"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-[12px] text-[#767676]">
              <span>To</span>
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                max={todayIso}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-[38px] rounded-full px-3.5 bg-[#f7f7f7] border border-[#e5e5e5] text-[12.5px] text-black focus:outline-none focus:border-[#ff6e20]"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCustomPicker(false)}
              className="px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-white border border-[#ececec] text-[#555555] hover:border-[#cccccc] hover:text-black transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCustom}
              className="px-4 py-1.5 rounded-full text-[12px] font-semibold bg-[#ff6e20] hover:bg-[#e85d12] text-white transition-colors"
            >
              Apply range
            </button>
          </div>
        </div>
      )}

      {/* 8 KPI Cards (Exact Figma Seller · 01) */}
      <div
        className={`flex flex-col gap-5 transition-opacity duration-200 ${
          refreshing ? 'opacity-65' : 'opacity-100'
        }`}
      >
        <KpiGrid items={kpis} />

        {/* Middle 2:1 Chart + Order Stats Row (Exact Figma Seller · 01) */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(310px,1fr)] gap-4">
          <TrendAreaChart
            title="Revenue & sales performance"
            subtitle={`Gross order revenue vs net seller earnings (${activePeriodLabel})`}
            badge={refreshing ? 'Updating...' : activePeriodLabel}
            badgeTone={refreshing ? 'orange' : 'green'}
            primaryLabel="Gross sales"
            secondaryLabel="Net earnings"
            secondaryDashed
            points={trendPoints}
            emptyHint={`No settled sales recorded for ${activePeriodLabel.toLowerCase()}.`}
          />

          <ProgressBreakdownCard
            title="Order statistics & categories"
            subtitle={`${o.total} orders · ${activePeriodLabel}`}
            items={categoryBreakdown}
            footerPills={[
              { label: `${o.completed} Completed`, tone: 'green' },
              { label: `${o.pending} Pending`, tone: 'orange' },
              { label: `${o.processing} Processing`, tone: 'neutral' },
            ]}
          />
        </div>

        {/* Bottom 2:1 Orders + Top Products & Low Stock Row (Exact Figma Seller · 01) */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(310px,1fr)] gap-4 items-start">
          <section className="bg-white border border-[#ececec] rounded-[18px] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-[15.5px] font-bold text-black">
                  Recent orders
                </h2>
                <p className="text-[12px] text-[#8a8a8a] mt-0.5">
                  Incoming customer orders · {activePeriodLabel}
                </p>
              </div>
              <Link
                to="/seller/orders"
                className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline"
              >
                View all orders
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className="py-12 text-center bg-[#f7f7f7] rounded-[14px]">
                <p className="text-[14px] font-semibold text-black">
                  No orders in {activePeriodLabel.toLowerCase()}
                </p>
                <p className="text-[12.5px] text-[#767676] mt-1">
                  Try widening your date range or switch to All time to inspect
                  older orders.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                      <th className="py-2.5 px-3.5 rounded-l-[10px]">Order</th>
                      <th className="py-2.5 px-3.5">Customer</th>
                      <th className="py-2.5 px-3.5">Total</th>
                      <th className="py-2.5 px-3.5">Payment</th>
                      <th className="py-2.5 px-3.5 rounded-r-[10px]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                    {recentOrders.map((ord) => (
                      <tr
                        key={ord.id}
                        className="hover:bg-[#fafafa] transition-colors"
                      >
                        <td className="py-3.5 px-3.5">
                          <p className="font-semibold text-black">
                            #{ord.order_number}
                          </p>
                          <p className="text-[11px] text-[#8a8a8a]">
                            {formatShortDate(ord.created_at)}
                          </p>
                        </td>
                        <td className="py-3.5 px-3.5 font-medium text-black">
                          {ord.customer_name}
                        </td>
                        <td className="py-3.5 px-3.5">
                          <p className="font-bold text-[#ff6e20]">
                            ${Number(ord.total_amount).toFixed(2)}
                          </p>
                          <p className="text-[11px] text-[#8a8a8a]">
                            {formatRiel(Number(ord.total_amount), khrRate)}
                          </p>
                        </td>
                        <td className="py-3.5 px-3.5">
                          <StatusPill label={ord.payment_status} />
                        </td>
                        <td className="py-3.5 px-3.5">
                          <StatusPill label={ord.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="flex flex-col gap-4">
            <section className="bg-white border border-[#ececec] rounded-[18px] p-5 flex flex-col gap-3.5">
              <div>
                <h2 className="text-[15.5px] font-bold text-black">
                  Top-selling products
                </h2>
                <p className="text-[12px] text-[#8a8a8a] mt-0.5">
                  Highest revenue items · {activePeriodLabel}
                </p>
              </div>
              {data.top_products.length === 0 ? (
                <p className="text-[12.5px] text-[#767676] py-6 text-center bg-[#f7f7f7] rounded-[12px]">
                  No product sales recorded for{' '}
                  {activePeriodLabel.toLowerCase()}.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-[#f1f1f1]">
                  {data.top_products.map((tp) => {
                    const matched = products.find(
                      (p) => p.id === tp.product_id,
                    );
                    return (
                      <div
                        key={tp.product_id}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {matched?.primary_image?.image_url ? (
                            <img
                              src={matched.primary_image.image_url}
                              alt={tp.product_name}
                              className="w-10 h-10 rounded-[10px] object-cover border border-[#ececec] shrink-0"
                            />
                          ) : (
                            <span className="w-10 h-10 rounded-[10px] bg-[#f7f7f7] border border-[#ececec] flex items-center justify-center shrink-0">
                              <FigmaIcon
                                name="package"
                                className="w-4 h-4 text-[#979797]"
                              />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-black truncate">
                              {tp.product_name}
                            </p>
                            <p className="text-[11px] text-[#8a8a8a]">
                              {tp.total_sold} sold
                            </p>
                          </div>
                        </div>
                        <span className="text-[13px] font-bold text-[#ff6e20] shrink-0">
                          ${Number(tp.revenue).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="bg-white border border-[#ececec] rounded-[18px] p-5 flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-[15.5px] font-bold text-black">
                    Inventory alerts
                  </h2>
                  <p className="text-[12px] text-[#8a8a8a] mt-0.5">
                    Immediate restock needed
                  </p>
                </div>
                {inv.low_stock_count > 0 && (
                  <StatusPill
                    label={`${inv.low_stock_count} low stock`}
                    tone="red"
                  />
                )}
              </div>
              {lowStockProducts.length === 0 ? (
                <p className="text-[12.5px] text-[#029500] py-5 text-center bg-[#e7f6e7] rounded-[12px] font-semibold">
                  All SKUs are well-stocked.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-[#f1f1f1]">
                  {lowStockProducts.map((p) => (
                    <Link
                      key={p.id}
                      to="/seller/inventory"
                      className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0 hover:opacity-80 transition-opacity"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-black truncate">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-[#8a8a8a] font-mono">
                          {p.sku}
                        </p>
                      </div>
                      <StatusPill
                        label={
                          p.stock_quantity === 0
                            ? 'Out of stock'
                            : `${p.stock_quantity} left`
                        }
                        tone="red"
                      />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. Seller Products List (/seller/products) — Exact Figma Seller · 02
// ==========================================
type ProductFilterTab =
  | 'all'
  | 'published'
  | 'draft'
  | 'out_of_stock'
  | 'archived';

export function SellerProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, khrRate, categories, showToast, refreshCatalog } = useStore();
  const { confirmDelete } = useConfirmDelete();

  const [tab, setTab] = useState<ProductFilterTab>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    try {
      const saved = window.localStorage.getItem('kova_seller_products_view');
      return saved === 'grid' ? 'grid' : 'table';
    } catch {
      return 'table';
    }
  });

  const [products, setProducts] = useState<SellerProductItem[]>([]);
  const productsRef = useRef<SellerProductItem[]>([]);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Full Product Detail Modal state
  const [detailProduct, setDetailProduct] = useState<SellerProductItem | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);

  // Add / Edit Product Modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  const openAddProductModal = useCallback(() => {
    setEditingProductId(null);
    setFormModalOpen(true);
  }, []);

  const openEditProductModal = useCallback((id: number) => {
    setEditingProductId(id);
    setFormModalOpen(true);
  }, []);

  const closeProductFormModal = useCallback(() => {
    setFormModalOpen(false);
    setEditingProductId(null);
    if (searchParams.has('add') || searchParams.has('edit')) {
      const next = new URLSearchParams(searchParams);
      next.delete('add');
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSetViewMode = (mode: 'table' | 'grid') => {
    setViewMode(mode);
    setPage(1);
    try {
      window.localStorage.setItem('kova_seller_products_view', mode);
    } catch {
      // ignore storage quota errors
    }
  };

  const openProductDetail = useCallback(
    async (productOrId: SellerProductItem | number) => {
      const id = typeof productOrId === 'number' ? productOrId : productOrId.id;
      const initial =
        typeof productOrId === 'number'
          ? productsRef.current.find((item) => item.id === productOrId) || null
          : productOrId;

      if (initial) {
        setDetailProduct(initial);
        setActiveImageUrl(
          initial.primary_image?.image_url ||
            initial.images?.[0]?.image_url ||
            null,
        );
      } else {
        setDetailProduct(null);
        setActiveImageUrl(null);
      }
      setDetailLoading(true);

      try {
        const full = await storeOwnerApi.getProduct(id);
        setDetailProduct(full);
        const primaryImg =
          full.images?.find((img) => img.is_primary)?.image_url ||
          full.primary_image?.image_url ||
          full.images?.[0]?.image_url ||
          null;
        setActiveImageUrl(primaryImg);
      } catch (err) {
        if (!initial) {
          showToast(
            err instanceof ApiError
              ? err.message
              : 'We could not load the product details right now.',
          );
          setDetailProduct(null);
        }
      } finally {
        setDetailLoading(false);
      }
    },
    [showToast],
  );

  const closeProductDetail = useCallback(() => {
    setDetailProduct(null);
    setDetailLoading(false);
    setActiveImageUrl(null);
    if (searchParams.has('view')) {
      const next = new URLSearchParams(searchParams);
      next.delete('view');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Open product detail or form modal automatically when navigated via ?view=<id>, ?add=1, or ?edit=<id>
  const viewParam = searchParams.get('view');
  const addParam = searchParams.get('add');
  const editParam = searchParams.get('edit');
  const urlEditProductId =
    editParam && Number.isFinite(Number(editParam)) && Number(editParam) > 0
      ? Number(editParam)
      : null;
  const effectiveFormModalOpen =
    formModalOpen ||
    addParam === '1' ||
    addParam === 'true' ||
    Boolean(urlEditProductId);
  const effectiveEditingProductId = formModalOpen
    ? editingProductId
    : urlEditProductId;

  useEffect(() => {
    if (!viewParam) return;
    const id = Number(viewParam);
    if (!Number.isFinite(id) || id <= 0) return;
    void openProductDetail(id);
  }, [viewParam, openProductDetail]);

  const loadProducts = useCallback(async () => {
    try {
      const res = await storeOwnerApi.getProducts({ per_page: 100 });
      setProducts(res.data);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to load products.',
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void loadProducts();
    });
    return () => {
      active = false;
    };
  }, [loadProducts]);

  const counts = useMemo(
    () => ({
      all: products.length,
      published: products.filter((p) => p.status === 'published').length,
      draft: products.filter((p) => p.status === 'draft').length,
      out_of_stock: products.filter((p) => p.stock_quantity === 0).length,
      archived: products.filter((p) => p.status === 'archived').length,
    }),
    [products],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (tab === 'published' && p.status !== 'published') return false;
      if (tab === 'draft' && p.status !== 'draft') return false;
      if (tab === 'out_of_stock' && p.stock_quantity !== 0) return false;
      if (tab === 'archived' && p.status !== 'archived') return false;
      if (categoryFilter && String(p.category_id) !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      );
    });
  }, [products, tab, categoryFilter, search]);

  const perPage = viewMode === 'grid' ? 12 : 10;
  const lastPage = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, lastPage);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const allOnPageSelected =
    paged.length > 0 && paged.every((p) => selectedIds.includes(p.id));

  const toggleSelectAllPage = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !paged.some((p) => p.id === id)),
      );
    } else {
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...paged.map((p) => p.id)])),
      );
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleBulkStatus = async (
    nextStatus: 'published' | 'draft' | 'archived',
  ) => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          storeOwnerApi.updateProduct(id, { status: nextStatus }),
        ),
      );
      showToast(`Updated ${selectedIds.length} products to ${nextStatus}.`);
      setSelectedIds([]);
      await Promise.all([loadProducts(), refreshCatalog()]);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Bulk update failed.');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDelete = (p: SellerProductItem) => {
    confirmDelete({
      title: 'Delete product?',
      description: `"${p.name}" will be removed from your store catalog.`,
      itemLabel: p.name,
      onOptimisticRemove: () => {
        setProducts((prev) => prev.filter((item) => item.id !== p.id));
        setSelectedIds((prev) => prev.filter((id) => id !== p.id));
        if (detailProduct?.id === p.id) {
          closeProductDetail();
        }
      },
      onUndo: () => {
        void loadProducts();
      },
      onCommit: async () => {
        setDeletingId(p.id);
        try {
          await storeOwnerApi.deleteProduct(p.id);
          showToast(`Deleted "${p.name}".`);
          setSelectedIds((prev) => prev.filter((id) => id !== p.id));
          await Promise.all([loadProducts(), refreshCatalog()]);
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const handleExport = () => {
    exportRowsToCsv(
      `kova-products-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Name',
        'SKU',
        'Category',
        'Regular USD',
        'Discount USD',
        'Stock',
        'Status',
      ],
      filtered.map((p) => [
        p.name,
        p.sku,
        p.category?.name || '',
        Number(p.regular_price).toFixed(2),
        p.discount_price ? Number(p.discount_price).toFixed(2) : '',
        p.stock_quantity,
        p.status,
      ]),
    );
    showToast('Products catalog CSV exported.');
  };

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Products"
        subtitle="Manage your catalog, pricing, SKU inventory, and product statuses."
        actions={
          <>
            <button
              type="button"
              onClick={handleExport}
              className="bg-white border border-[#ececec] hover:border-[#cccccc] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full transition-colors"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={openAddProductModal}
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors cursor-pointer"
            >
              Add product
            </button>
          </>
        }
      />

      <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterPillTabs<ProductFilterTab>
            value={tab}
            onChange={(next) => {
              setTab(next);
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All', count: counts.all },
              { id: 'published', label: 'Active', count: counts.published },
              { id: 'draft', label: 'Draft', count: counts.draft },
              {
                id: 'out_of_stock',
                label: 'Out of Stock',
                count: counts.out_of_stock,
              },
              { id: 'archived', label: 'Archived', count: counts.archived },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by category"
              className="bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-full px-3.5 h-[36px] text-[12px] font-medium text-black outline-none"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 bg-[#f7f7f7] border border-[#ececec] focus-within:border-[#ff6e20] focus-within:bg-white rounded-full px-3.5 h-[36px] w-[200px]">
              <FigmaIcon name="search" className="w-3.5 h-3.5 text-[#979797]" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search SKU or title..."
                className="flex-1 bg-transparent text-[12px] text-black placeholder:text-[#979797] outline-none min-w-0"
              />
            </div>

            <div
              className="inline-flex items-center bg-[#f7f7f7] border border-[#ececec] rounded-full p-0.5 h-[36px]"
              role="group"
              aria-label="Product view layout"
            >
              <button
                type="button"
                onClick={() => handleSetViewMode('table')}
                title="Table view"
                aria-label="Table view"
                aria-pressed={viewMode === 'table'}
                className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[12px] font-semibold transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-[#ff6e20] text-white'
                    : 'text-[#767676] hover:text-black'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode('grid')}
                title="Grid view"
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
                className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[12px] font-semibold transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[#ff6e20] text-white'
                    : 'text-[#767676] hover:text-black'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Contextual Bulk Action Bar (Exact Figma Seller · 02 orange strip) */}
        {selectedIds.length > 0 && (
          <div className="bg-[#ffefe6] border border-[#ffd8c2] rounded-[14px] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[12.5px] font-bold text-[#ff6e20]">
              {selectedIds.length} product{selectedIds.length > 1 ? 's' : ''}{' '}
              selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void handleBulkStatus('published')}
                className="bg-white hover:bg-[#fafafa] text-black text-[12px] font-semibold px-3.5 py-1.5 rounded-full border border-[#f2d4c2] disabled:opacity-50"
              >
                Set Active
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void handleBulkStatus('draft')}
                className="bg-white hover:bg-[#fafafa] text-black text-[12px] font-semibold px-3.5 py-1.5 rounded-full border border-[#f2d4c2] disabled:opacity-50"
              >
                Move to Draft
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void handleBulkStatus('archived')}
                className="bg-white hover:bg-[#fafafa] text-[#e5322d] text-[12px] font-semibold px-3.5 py-1.5 rounded-full border border-[#f2d4c2] disabled:opacity-50"
              >
                Archive
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <DashboardTableSkeleton rows={6} />
        ) : paged.length === 0 ? (
          <div className="py-14 text-center bg-[#f7f7f7] rounded-[14px] flex flex-col items-center gap-3">
            <FigmaIcon name="package" className="w-8 h-8 text-[#979797]" />
            <p className="text-[14.5px] font-semibold text-black">
              No products found
            </p>
            <button
              type="button"
              onClick={openAddProductModal}
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-5 py-2 rounded-full cursor-pointer"
            >
              Add product
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paged.map((p) => {
              const regular = Number(p.regular_price || 0);
              const discount =
                p.discount_price !== null &&
                p.discount_price !== undefined &&
                Number(p.discount_price) > 0 &&
                Number(p.discount_price) < regular
                  ? Number(p.discount_price)
                  : null;
              const price = discount ?? regular;
              const discountPct =
                discount && regular > 0
                  ? Math.round(((regular - discount) / regular) * 100)
                  : 0;
              const low = p.stock_quantity <= (p.low_stock_threshold ?? 5);
              const isChecked = selectedIds.includes(p.id);
              const rating = p.reviews_avg_rating
                ? Number(p.reviews_avg_rating)
                : 0;
              const reviewsCount = Number(p.reviews_count ?? 0);
              const storeName = user?.store?.name || 'My Store';
              const storeVerified = Boolean(user?.store?.is_verified);

              return (
                <div
                  key={p.id}
                  className={`group bg-white border transition-all rounded-[20px] flex flex-col gap-2 pb-3 overflow-hidden ${
                    isChecked
                      ? 'border-[#ff6e20] ring-2 ring-[#ff6e20]/15'
                      : 'border-[#ececec] hover:border-[#ff6e20]/60 hover:shadow-md'
                  }`}
                >
                  {/* Photo Box — matches client ProductCard */}
                  <div className="relative aspect-[276/260] w-full overflow-hidden rounded-[20px] bg-[#f7f7f7]">
                    <button
                      type="button"
                      onClick={() => void openProductDetail(p)}
                      className="block w-full h-full cursor-pointer text-left"
                    >
                      {p.primary_image?.image_url ? (
                        <img
                          src={p.primary_image.image_url}
                          alt={p.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#979797]">
                          <FigmaIcon name="package" className="w-10 h-10" />
                        </div>
                      )}
                    </button>

                    {/* Top-left High-Contrast Status Badge */}
                    {/* <div className="absolute top-2.5 left-2.5">
                      <span
                        className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm ${
                          p.stock_quantity === 0
                            ? 'bg-[#e5322d] text-white'
                            : p.status === 'published'
                              ? 'bg-[#029500] text-white'
                              : p.status === 'draft'
                                ? 'bg-[#ff6e20] text-white'
                                : 'bg-[#333333] text-white'
                        }`}
                      >
                        {p.stock_quantity === 0
                          ? 'Out of stock'
                          : p.status === 'published'
                            ? 'Active'
                            : p.status === 'draft'
                              ? 'Draft'
                              : 'Archived'}
                      </span>
                    </div> */}

                    {/* Discount Badge */}
                    {discountPct > 0 && (
                      <div className="absolute top-2.5 right-2.5 bg-[#e5322d] text-white text-[11px] font-bold leading-[1.35] px-2 py-[3px] rounded-full">
                        -{discountPct}%
                      </div>
                    )}

                    {/* Free Delivery Badge (bottom-left corner — matches client ProductCard) */}
                    {p.free_shipping && (
                      <div className="absolute bottom-0 left-0 z-10 bg-green-600 rounded-tr-[14px] px-2.5 py-1 flex items-center gap-1 leading-none shadow-sm">
                        <span className="text-[11.5px] text-[#ffe169]">
                          Free
                        </span>
                        <span className="text-[11.5px] text-white">
                          Delivery
                        </span>
                      </div>
                    )}

                    {p.stock_quantity === 0 && (
                      <div className="absolute bottom-2 right-2 bg-black/75 text-white text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full">
                        Out of stock
                      </div>
                    )}
                  </div>

                  {/* Card Info — matches client ProductCard */}
                  <div className="px-3 flex flex-col gap-[5px] flex-1">
                    <button
                      type="button"
                      onClick={() => void openProductDetail(p)}
                      className="text-left text-[14px] font-medium leading-[1.35] text-black line-clamp-2 min-h-[38px] group-hover:text-[#ff6e20] transition-colors cursor-pointer"
                    >
                      {p.name}
                    </button>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="bg-[#ffefe6] text-[#ff6e20] text-[10px] font-semibold leading-[1.35] px-1.5 py-[2px] rounded-[6px] inline-flex items-center gap-1 max-w-[140px]">
                        <span className="truncate">{storeName}</span>
                        {storeVerified && <VerifiedBadge size="xs" />}
                      </span>
                      {reviewsCount > 0 && (
                        <span className="text-[11px] text-[#979797] leading-[1.35]">
                          ★ {rating.toFixed(1)} ({reviewsCount})
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-1.5 mt-auto pt-0.5">
                      <span className="text-[21px] font-bold leading-[1.2] text-[#ff6e20]">
                        ${price.toFixed(2)}
                      </span>
                      <span className="text-[11px] font-semibold text-[#ff6e20]">
                        USD
                      </span>
                      {regular > price && (
                        <span className="text-[11px] text-[#979797] line-through">
                          ${regular.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-[#767676]">
                        {formatKhr(price, price >= 300, khrRate)}
                      </span>
                      <span
                        className={`font-semibold ${
                          p.stock_quantity === 0 || low
                            ? 'text-[#e5322d]'
                            : 'text-[#029500]'
                        }`}
                      >
                        {p.stock_quantity} in stock
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 pt-2 mt-1 border-t border-[#f1f1f1]">
                      <button
                        type="button"
                        onClick={() => void openProductDetail(p)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#ffefe6] hover:bg-[#ff6e20] text-[#ff6e20] hover:text-white text-[12px] font-semibold py-1.5 px-3 rounded-full transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View detail</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditProductModal(p.id)}
                        title="Edit product"
                        aria-label={`Edit ${p.name}`}
                        className="w-8 h-8 rounded-full bg-[#f7f7f7] hover:bg-[#ffefe6] border border-[#ececec] hover:border-[#ff6e20]/40 text-[#555555] hover:text-[#ff6e20] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === p.id}
                        onClick={() => void handleDelete(p)}
                        title="Delete product"
                        aria-label={`Delete ${p.name}`}
                        className="w-8 h-8 rounded-full bg-[#f7f7f7] hover:bg-[#fff0f0] border border-[#ececec] hover:border-[#e5322d]/40 text-[#767676] hover:text-[#e5322d] flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                  <th className="py-2.5 pl-3 pr-2 rounded-l-[10px] w-9">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAllPage}
                      aria-label="Select all products on page"
                      className="accent-[#ff6e20]"
                    />
                  </th>
                  <th className="py-2.5 px-2.5">Product</th>
                  <th className="py-2.5 px-2.5">SKU</th>
                  <th className="py-2.5 px-2.5">Category</th>
                  <th className="py-2.5 px-2.5">Price</th>
                  <th className="py-2.5 px-2.5">Stock</th>
                  <th className="py-2.5 px-2.5">Status</th>
                  <th className="py-2.5 px-2.5">Created</th>
                  <th className="py-2.5 px-3 rounded-r-[10px] text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                {paged.map((p) => {
                  const price = Number(p.discount_price || p.regular_price);
                  const low = p.stock_quantity <= (p.low_stock_threshold ?? 5);
                  const isChecked = selectedIds.includes(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isChecked ? 'bg-[#fff9f5]' : 'hover:bg-[#fafafa]'
                      }`}
                    >
                      <td className="py-3.5 pl-3 pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(p.id)}
                          aria-label={`Select ${p.name}`}
                          className="accent-[#ff6e20]"
                        />
                      </td>
                      <td className="py-3.5 px-2.5">
                        <button
                          type="button"
                          onClick={() => void openProductDetail(p)}
                          className="flex items-center gap-3 text-left group cursor-pointer"
                        >
                          {p.primary_image?.image_url ? (
                            <img
                              src={p.primary_image.image_url}
                              alt={p.name}
                              className="w-11 h-11 rounded-[10px] object-cover border border-[#ececec] shrink-0"
                            />
                          ) : (
                            <span className="w-11 h-11 rounded-[10px] bg-[#f7f7f7] border border-[#ececec] flex items-center justify-center shrink-0">
                              <FigmaIcon
                                name="package"
                                className="w-4 h-4 text-[#979797]"
                              />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-black group-hover:text-[#ff6e20] transition-colors truncate max-w-[190px]">
                              {p.name}
                            </p>
                            <p className="text-[11px] text-[#8a8a8a] truncate">
                              {p.category?.name || 'Standard'}
                            </p>
                          </div>
                        </button>
                      </td>
                      <td className="py-3.5 px-2.5 font-mono text-[12px] text-[#555555] whitespace-nowrap">
                        {p.sku}
                      </td>
                      <td className="py-3.5 px-2.5 text-[#555555]">
                        {p.category?.name || '—'}
                      </td>
                      <td className="py-3.5 px-2.5 whitespace-nowrap">
                        <p className="font-bold text-[#ff6e20]">
                          ${price.toFixed(2)}
                        </p>
                        <p className="text-[11px] text-[#8a8a8a]">
                          {formatRiel(price, khrRate)}
                        </p>
                      </td>
                      <td className="py-3.5 px-2.5 whitespace-nowrap">
                        <span
                          className={`text-[12.5px] font-semibold ${
                            p.stock_quantity === 0 || low
                              ? 'text-[#e5322d]'
                              : 'text-[#029500]'
                          }`}
                        >
                          {p.stock_quantity === 0
                            ? '0 in stock'
                            : low
                              ? `${p.stock_quantity} low stock`
                              : `${p.stock_quantity} in stock`}
                        </span>
                      </td>
                      <td className="py-3.5 px-2.5">
                        <StatusPill
                          label={
                            p.stock_quantity === 0
                              ? 'Out of stock'
                              : p.status === 'published'
                                ? 'Active'
                                : p.status
                          }
                        />
                      </td>
                      <td className="py-3.5 px-2.5 text-[#767676] whitespace-nowrap">
                        {formatShortDate(p.created_at)}
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => void openProductDetail(p)}
                            className="text-[12.5px] font-semibold text-black hover:text-[#ff6e20] transition-colors cursor-pointer"
                          >
                            View detail
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditProductModal(p.id)}
                            className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === p.id}
                            onClick={() => void handleDelete(p)}
                            className="text-[12.5px] font-semibold text-[#e5322d] hover:underline disabled:opacity-50 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <TablePagination
          page={safePage}
          lastPage={lastPage}
          total={filtered.length}
          perPage={perPage}
          itemLabel="products"
          onPageChange={setPage}
        />
      </section>

      {/* Full Product Detail Modal */}
      <DashboardModal
        open={Boolean(detailProduct) || detailLoading}
        onClose={closeProductDetail}
        title={detailProduct?.name || 'Product details'}
        subtitle={
          detailProduct
            ? `SKU: ${detailProduct.sku} · ${detailProduct.category?.name || 'Uncategorized'}`
            : 'Loading product information...'
        }
        widthClass="max-w-[860px]"
        footer={
          detailProduct ? (
            <div className="w-full flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const targetId = detailProduct.id;
                  closeProductDetail();
                  openEditProductModal(targetId);
                }}
                className="inline-flex items-center gap-1.5 bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13px] font-semibold px-5 py-2 rounded-full transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit product</span>
              </button>
              <button
                type="button"
                disabled={deletingId === detailProduct.id}
                onClick={() => handleDelete(detailProduct)}
                className="inline-flex items-center gap-1.5 bg-[#fff0f0] hover:bg-[#e5322d] text-[#e5322d] hover:text-white text-[13px] font-semibold px-4.5 py-2 rounded-full transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          ) : undefined
        }
      >
        {detailLoading && !detailProduct ? (
          <div className="py-12 text-center text-[13.5px] text-[#767676]">
            Loading product details...
          </div>
        ) : detailProduct ? (
          (() => {
            const p = detailProduct;
            const regular = Number(p.regular_price || 0);
            const discount =
              p.discount_price !== null &&
              p.discount_price !== undefined &&
              Number(p.discount_price) > 0 &&
              Number(p.discount_price) < regular
                ? Number(p.discount_price)
                : null;
            const effective = discount ?? regular;
            const discountPct =
              discount && regular > 0
                ? Math.round(((regular - discount) / regular) * 100)
                : 0;
            const low = p.stock_quantity <= (p.low_stock_threshold ?? 5);
            const rating = p.reviews_avg_rating
              ? Number(p.reviews_avg_rating)
              : 0;
            const reviewsCount = Number(p.reviews_count ?? 0);

            const gallery: { url: string; isPrimary?: boolean }[] = [];
            if (Array.isArray(p.images) && p.images.length > 0) {
              p.images.forEach((img) => {
                if (
                  img.image_url &&
                  !gallery.some((g) => g.url === img.image_url)
                ) {
                  gallery.push({
                    url: img.image_url,
                    isPrimary: Boolean(img.is_primary),
                  });
                }
              });
            }
            if (
              p.primary_image?.image_url &&
              !gallery.some((g) => g.url === p.primary_image?.image_url)
            ) {
              gallery.unshift({
                url: p.primary_image.image_url,
                isPrimary: true,
              });
            }
            const currentImg = activeImageUrl || gallery[0]?.url || null;

            const specEntries =
              p.specifications && typeof p.specifications === 'object'
                ? Object.entries(p.specifications).filter(([, v]) => Boolean(v))
                : [];

            return (
              <div className="flex flex-col gap-5">
                {/* Top 2-Column Hero: Gallery + Core Details */}
                <div className="grid grid-cols-1 md:grid-cols-[310px_minmax(0,1fr)] gap-5">
                  {/* Image Gallery */}
                  <div className="flex flex-col gap-2.5">
                    <div className="relative aspect-square w-full rounded-[18px] overflow-hidden bg-[#f7f7f7] border border-[#ececec] flex items-center justify-center">
                      {currentImg ? (
                        <img
                          src={currentImg}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FigmaIcon
                          name="package"
                          className="w-12 h-12 text-[#979797]"
                        />
                      )}
                      {discountPct > 0 && (
                        <span className="absolute top-3 right-3 bg-[#e5322d] text-white text-[11.5px] font-bold px-2.5 py-0.5 rounded-full">
                          -{discountPct}%
                        </span>
                      )}
                      {p.free_shipping && (
                        <div className="absolute bottom-0 left-0 bg-green-600 rounded-tr-[14px] px-3 py-1 flex items-center gap-1 leading-none">
                          <span className="text-[11.5px] text-[#ffe169]">
                            Free
                          </span>
                          <span className="text-[11.5px] text-white">
                            Delivery
                          </span>
                        </div>
                      )}
                    </div>

                    {gallery.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {gallery.map((img, idx) => (
                          <button
                            key={`${img.url}-${idx}`}
                            type="button"
                            onClick={() => setActiveImageUrl(img.url)}
                            className={`relative w-14 h-14 rounded-[10px] overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                              currentImg === img.url
                                ? 'border-[#ff6e20]'
                                : 'border-[#ececec] opacity-75 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={img.url}
                              alt={`${p.name} ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {img.isPrimary && (
                              <span className="absolute bottom-0 inset-x-0 bg-[#ff6e20]/90 text-white text-[9px] font-bold text-center leading-tight py-[1px]">
                                Main
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Summary Info */}
                  <div className="flex flex-col gap-3.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill
                        label={
                          p.stock_quantity === 0
                            ? 'Out of stock'
                            : p.status === 'published'
                              ? 'Active'
                              : p.status
                        }
                      />
                      {p.is_featured && (
                        <span className="bg-[#ffefe6] text-[#ff6e20] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                          Featured
                        </span>
                      )}
                      {p.free_shipping && (
                        <span className="bg-[#e7f6e7] text-[#029500] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                          Free shipping
                        </span>
                      )}
                      {reviewsCount > 0 && (
                        <span className="text-[12px] font-semibold text-[#767676]">
                          ★ {rating.toFixed(1)} ({reviewsCount} review
                          {reviewsCount === 1 ? '' : 's'})
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-[20px] font-bold text-black leading-snug">
                        {p.name}
                      </h3>
                      {p.short_description && (
                        <p className="text-[13px] text-[#666666] mt-1 leading-relaxed">
                          {p.short_description}
                        </p>
                      )}
                    </div>

                    {/* Price Card */}
                    <div className="bg-[#f7f7f7] border border-[#ececec] rounded-[14px] p-3.5 flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[26px] font-bold text-[#ff6e20] leading-none">
                          ${effective.toFixed(2)}
                        </span>
                        <span className="text-[12px] font-semibold text-[#ff6e20]">
                          USD
                        </span>
                        {discount && (
                          <span className="text-[13.5px] text-[#979797] line-through">
                            ${regular.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <span className="text-[12.5px] font-semibold text-[#767676]">
                        {formatRiel(effective, khrRate)}
                      </span>
                    </div>

                    {/* Key Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2.5 text-[12.5px]">
                      <div className="bg-[#fafafa] border border-[#ececec] rounded-[12px] px-3 py-2.5">
                        <p className="text-[11px] text-[#8a8a8a]">SKU</p>
                        <p className="font-mono font-semibold text-black mt-0.5 truncate">
                          {p.sku}
                        </p>
                      </div>
                      <div className="bg-[#fafafa] border border-[#ececec] rounded-[12px] px-3 py-2.5">
                        <p className="text-[11px] text-[#8a8a8a]">Category</p>
                        <p className="font-semibold text-black mt-0.5 truncate">
                          {p.category?.name || 'Uncategorized'}
                          {p.subcategory?.name
                            ? ` / ${p.subcategory.name}`
                            : ''}
                        </p>
                      </div>
                      <div className="bg-[#fafafa] border border-[#ececec] rounded-[12px] px-3 py-2.5">
                        <p className="text-[11px] text-[#8a8a8a]">Inventory</p>
                        <p
                          className={`font-semibold mt-0.5 ${
                            p.stock_quantity === 0 || low
                              ? 'text-[#e5322d]'
                              : 'text-[#029500]'
                          }`}
                        >
                          {p.stock_quantity} in stock
                          {p.low_stock_threshold !== undefined && (
                            <span className="text-[11px] font-normal text-[#8a8a8a]">
                              {' '}
                              (alert ≤ {p.low_stock_threshold})
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="bg-[#fafafa] border border-[#ececec] rounded-[12px] px-3 py-2.5">
                        <p className="text-[11px] text-[#8a8a8a]">
                          Listed / Updated
                        </p>
                        <p className="font-semibold text-black mt-0.5 truncate">
                          {formatShortDate(p.created_at)}
                          {p.updated_at
                            ? ` · ${formatShortDate(p.updated_at)}`
                            : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Full Description */}
                {p.description && (
                  <div className="bg-[#fafafa] border border-[#ececec] rounded-[14px] p-4 flex flex-col gap-1.5">
                    <h4 className="text-[13px] font-bold text-black">
                      Description
                    </h4>
                    <p className="text-[13px] text-[#555555] leading-relaxed whitespace-pre-line">
                      {p.description}
                    </p>
                  </div>
                )}

                {/* Variants */}
                {Array.isArray(p.variants) && p.variants.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[13px] font-bold text-black">
                      Variants ({p.variants.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {p.variants.map((v) => (
                        <div
                          key={v.id}
                          className="bg-[#fafafa] border border-[#ececec] rounded-[12px] p-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-black truncate">
                              {v.name}
                            </p>
                            {v.sku && (
                              <p className="text-[11px] font-mono text-[#8a8a8a]">
                                SKU: {v.sku}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[13px] font-bold text-[#ff6e20]">
                              ${Number(v.price).toFixed(2)}
                            </p>
                            <p className="text-[11px] text-[#767676]">
                              {v.stock_quantity} in stock
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Specifications & Attributes */}
                {(specEntries.length > 0 ||
                  (Array.isArray(p.attributes) && p.attributes.length > 0)) && (
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[13px] font-bold text-black">
                      Specifications &amp; attributes
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {specEntries.map(([k, v]) => (
                        <div
                          key={k}
                          className="bg-[#fafafa] border border-[#ececec] rounded-[10px] px-3 py-2"
                        >
                          <p className="text-[11px] text-[#8a8a8a]">{k}</p>
                          <p className="text-[12.5px] font-semibold text-black truncate">
                            {v}
                          </p>
                        </div>
                      ))}
                      {p.attributes?.map((attr, idx) => (
                        <div
                          key={`${attr.name}-${idx}`}
                          className="bg-[#fafafa] border border-[#ececec] rounded-[10px] px-3 py-2"
                        >
                          <p className="text-[11px] text-[#8a8a8a]">
                            {attr.name}
                          </p>
                          <p className="text-[12.5px] font-semibold text-black truncate">
                            {Array.isArray(attr.values)
                              ? attr.values.join(', ')
                              : attr.values || attr.value || '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SEO & Extra Metadata */}
                <div className="bg-[#fafafa] border border-[#ececec] rounded-[14px] p-4 flex flex-col gap-1.5 text-[12px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-black">
                      Listing &amp; SEO details
                    </span>
                    <span className="font-mono text-[11px] text-[#8a8a8a]">
                      /product/{p.slug}
                    </span>
                  </div>
                  {p.weight !== null && p.weight !== undefined && (
                    <p className="text-[#666666]">
                      <strong className="text-black">Weight:</strong> {p.weight}{' '}
                      kg
                    </p>
                  )}
                  {p.seo_title && (
                    <p className="text-[#666666]">
                      <strong className="text-black">SEO title:</strong>{' '}
                      {p.seo_title}
                    </p>
                  )}
                  {p.seo_description && (
                    <p className="text-[#666666]">
                      <strong className="text-black">SEO description:</strong>{' '}
                      {p.seo_description}
                    </p>
                  )}
                  {!p.seo_title && !p.seo_description && (
                    <p className="text-[#8a8a8a]">
                      Using default product title and description for storefront
                      search previews.
                    </p>
                  )}
                </div>
              </div>
            );
          })()
        ) : null}
      </DashboardModal>

      {/* Add / Edit Product Modal */}
      {effectiveFormModalOpen && (
        <SellerProductFormModal
          key={effectiveEditingProductId ?? 'new'}
          open
          productId={effectiveEditingProductId}
          onClose={closeProductFormModal}
          onSaved={async () => {
            await loadProducts();
          }}
        />
      )}
    </div>
  );
}

// ==========================================
// 3. Create / Edit Product Modal (and route wrapper)
// ==========================================
function SellerProductFormModal({
  open,
  productId,
  onClose,
  onSaved,
}: {
  open: boolean;
  productId: number | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEdit = Boolean(productId);
  const { user, categories, khrRate, showToast, refreshCatalog } = useStore();

  const [loading, setLoading] = useState(Boolean(productId));
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [regularPrice, setRegularPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('10');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>(
    'published',
  );
  const [isFeatured, setIsFeatured] = useState(false);
  const [freeShipping, setFreeShipping] = useState(false);
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<
    {
      id?: number;
      image_url: string;
      media_id?: number | null;
      is_primary: boolean;
    }[]
  >([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !productId) return;

    let active = true;
    storeOwnerApi
      .getProduct(productId)
      .then((p) => {
        if (!active) return;
        setName(p.name);
        setSku(p.sku);
        setCategoryId(p.category_id ? String(p.category_id) : '');
        setRegularPrice(String(p.regular_price));
        setDiscountPrice(p.discount_price ? String(p.discount_price) : '');
        setStockQuantity(String(p.stock_quantity));
        setLowStockThreshold(String(p.low_stock_threshold ?? 5));
        setStatus(p.status);
        setIsFeatured(Boolean(p.is_featured));
        setFreeShipping(Boolean(p.free_shipping));
        setShortDescription(p.short_description || '');
        setDescription(p.description || '');
        const rawImages = p.images || [];
        const hasPrimary = rawImages.some((img) => Boolean(img.is_primary));
        setImages(
          rawImages.map((img, i) => ({
            id: img.id,
            image_url: img.image_url,
            media_id: img.media_id ?? null,
            is_primary: hasPrimary ? Boolean(img.is_primary) : i === 0,
          })),
        );
      })
      .catch((err) => {
        showToast(
          err instanceof ApiError ? err.message : 'Unable to load product.',
        );
        onClose();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, productId, showToast, onClose]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remainingSlots = Math.max(0, 8 - images.length);
    if (remainingSlots === 0) {
      showToast('Maximum of 8 product images allowed.');
      e.target.value = '';
      return;
    }
    const filesToUpload = files.slice(0, remainingSlots);
    setUploadingImg(true);
    try {
      for (const file of filesToUpload) {
        const media = await storeOwnerApi.uploadProductImage(file);
        setImages((prev) => {
          const hasPrimary = prev.some((item) => item.is_primary);
          return [
            ...prev,
            {
              image_url: media.secure_url,
              media_id: media.id,
              is_primary: !hasPrimary && prev.length === 0,
            },
          ];
        });
      }
      showToast('Image uploaded successfully.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Image upload failed.');
    } finally {
      setUploadingImg(false);
      e.target.value = '';
    }
  };

  const handleSetPrimaryImage = (idx: number) => {
    setImages((prev) =>
      prev.map((item, i) => ({
        ...item,
        is_primary: i === idx,
      })),
    );
  };

  const handleRemoveImage = (idx: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length > 0 && !next.some((item) => item.is_primary)) {
        return next.map((item, i) => ({ ...item, is_primary: i === 0 }));
      }
      return next;
    });
  };

  const submitProduct = async (
    forcedStatus?: 'draft' | 'published' | 'archived',
  ) => {
    if (!name.trim() || !sku.trim() || !regularPrice) {
      showToast('Please fill in Product name, SKU, and Regular price.');
      return;
    }

    const finalStatus = forcedStatus ?? status;
    const effectiveCategory = categoryId ? Number(categoryId) : null;
    setSaving(true);
    try {
      const normalizedImages = images.map((img, idx) => ({
        id: img.id,
        image_url: img.image_url,
        media_id: img.media_id ?? null,
        sort_order: idx,
        is_primary: img.is_primary,
      }));

      if (isEdit && productId) {
        await storeOwnerApi.updateProduct(productId, {
          name: name.trim(),
          sku: sku.trim(),
          category_id: effectiveCategory,
          regular_price: Number(regularPrice),
          discount_price: discountPrice ? Number(discountPrice) : null,
          stock_quantity: Number(stockQuantity),
          low_stock_threshold: Number(lowStockThreshold) || 5,
          status: finalStatus,
          is_featured: isFeatured,
          free_shipping: freeShipping,
          short_description: shortDescription.trim() || null,
          description: description.trim() || null,
          images: normalizedImages,
        });
        showToast('Product updated.');
      } else {
        await storeOwnerApi.createProduct({
          name: name.trim(),
          sku: sku.trim(),
          category_id: effectiveCategory,
          regular_price: Number(regularPrice),
          discount_price: discountPrice ? Number(discountPrice) : null,
          stock_quantity: Number(stockQuantity),
          low_stock_threshold: Number(lowStockThreshold) || 5,
          status: finalStatus,
          is_featured: isFeatured,
          free_shipping: freeShipping,
          short_description: shortDescription.trim() || null,
          description: description.trim() || null,
          images: normalizedImages,
        });
        showToast(
          finalStatus === 'draft' ? 'Saved as draft.' : 'Product published.',
        );
      }
      await Promise.all([onSaved(), refreshCatalog()]);
      onClose();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to save product.',
      );
    } finally {
      setSaving(false);
    }
  };

  const parsedRegular = Number(regularPrice) || 0;
  const parsedDiscount = Number(discountPrice) || 0;
  const effectivePrice =
    parsedDiscount > 0 && parsedDiscount < parsedRegular
      ? parsedDiscount
      : parsedRegular;
  const discountPct =
    parsedDiscount > 0 && parsedDiscount < parsedRegular
      ? Math.round(((parsedRegular - parsedDiscount) / parsedRegular) * 100)
      : 0;
  const previewSlug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const formId = 'seller-product-modal-form';

  return (
    <DashboardModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit product' : 'Add new product'}
      subtitle="Create a product listing with pricing, product media, inventory, and SEO preview."
      widthClass="max-w-[960px]"
      footer={
        <div className="w-full flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={saving || uploadingImg}
            onClick={onClose}
            className="bg-white border border-[#ececec] hover:border-black text-[12.5px] font-semibold text-black px-4.5 py-2 rounded-full transition-colors cursor-pointer disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || uploadingImg || loading}
            onClick={() => void submitProduct('draft')}
            className="bg-[#ffefe6] hover:bg-[#ffe1cf] disabled:opacity-60 text-[#ff6e20] text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors cursor-pointer"
          >
            Save as draft
          </button>
          <button
            type="submit"
            form={formId}
            disabled={saving || uploadingImg || loading}
            className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full transition-colors cursor-pointer"
          >
            {saving ? 'Saving...' : isEdit ? 'Save product' : 'Publish product'}
          </button>
        </div>
      }
    >
      {loading ? (
        <DashboardTableSkeleton rows={5} />
      ) : (
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            void submitProduct();
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-4 items-start">
            <div className="flex flex-col gap-4">
              {/* Card 1: Basic Information */}
              <section className="bg-white border border-[#ececec] rounded-[18px] p-5 flex flex-col gap-4">
                <h2 className="text-[15.5px] font-bold text-black">
                  Basic information
                </h2>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-black">
                    Product name
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Studio Wireless Headphones — ANC Edition"
                    className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13.5px] outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-black">
                    Short summary
                  </span>
                  <input
                    type="text"
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="One-line highlight displayed on product cards"
                    className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13.5px] outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-black">
                    Product description
                  </span>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed specifications, warranty coverage, what's in the box..."
                    className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] p-3.5 text-[13.5px] outline-none"
                  />
                </label>
              </section>

              {/* Card 2: Product Media (Exact Figma orange dashed upload box) */}
              <section className="bg-white border border-[#ececec] rounded-[18px] p-5 flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[15.5px] font-bold text-black">
                      Product media
                    </h2>
                    <p className="text-[12px] text-[#8a8a8a] mt-0.5">
                      Upload up to 8 images (PNG, JPG, WebP) and choose a
                      primary cover image.
                    </p>
                  </div>
                  <span className="text-[11.5px] font-semibold text-[#8a8a8a] tabular-nums">
                    {images.length} / 8
                  </span>
                </div>
                <div className="flex flex-wrap items-stretch gap-3">
                  {images.map((img, idx) => (
                    <div
                      key={`${img.id ?? 'new'}-${img.image_url}-${idx}`}
                      className={`relative border rounded-[14px] p-1.5 w-[114px] flex flex-col gap-1.5 ${
                        img.is_primary
                          ? 'border-[#ff6e20] bg-[#fff8f4]'
                          : 'border-[#ececec] bg-white'
                      }`}
                    >
                      {img.is_primary && (
                        <span className="absolute top-2.5 left-2.5 bg-[#ff6e20] text-white text-[9.5px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                          Primary
                        </span>
                      )}
                      <img
                        src={img.image_url}
                        alt=""
                        className="w-full h-[88px] object-cover rounded-[10px]"
                      />
                      <div className="flex items-center justify-between text-[10.5px] px-0.5 gap-1">
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryImage(idx)}
                          className={`font-semibold transition-colors ${
                            img.is_primary
                              ? 'text-[#ff6e20]'
                              : 'text-[#555555] hover:text-[#ff6e20]'
                          }`}
                        >
                          {img.is_primary ? 'Main' : 'Set main'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="text-[#e5322d] hover:underline font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  {images.length < 8 && (
                    <label className="flex-1 min-w-[220px] min-h-[114px] border border-dashed border-[#ff6e20]/70 bg-[#fffaf7] hover:bg-[#ffefe6]/60 transition-colors rounded-[14px] px-4 py-5 flex flex-col items-center justify-center gap-1 cursor-pointer text-center">
                      <FigmaIcon
                        name="upload"
                        className="w-5 h-5 text-[#ff6e20]"
                      />
                      <span className="text-[13px] font-semibold text-[#ff6e20]">
                        {uploadingImg ? 'Uploading images...' : 'Upload images'}
                      </span>
                      <span className="text-[11px] text-[#8a8a8a]">
                        Click to select PNG, JPG, or WebP
                      </span>
                      <input
                        type="file"
                        multiple
                        disabled={uploadingImg}
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </section>

              {/* Card 3: Pricing & Margin */}
              <section className="bg-white border border-[#ececec] rounded-[18px] p-5 flex flex-col gap-4">
                <div>
                  <h2 className="text-[15.5px] font-bold text-black">
                    Pricing &amp; KHR conversion
                  </h2>
                  <p className="text-[12px] text-[#8a8a8a] mt-0.5">
                    Prices auto-convert to KHR at{' '}
                    {khrRate.toLocaleString('en-US')} KHR / USD.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-black">
                      Regular price (USD)
                    </span>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min={0}
                      value={regularPrice}
                      onChange={(e) => setRegularPrice(e.target.value)}
                      placeholder="0.00"
                      className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13.5px] outline-none"
                    />
                    <span className="text-[11px] text-[#8a8a8a]">
                      {formatRiel(parsedRegular, khrRate)}
                    </span>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-black">
                      Sale / Discount price (USD, optional)
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={discountPrice}
                      onChange={(e) => setDiscountPrice(e.target.value)}
                      placeholder="Optional promo price"
                      className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13.5px] outline-none"
                    />
                    <span className="text-[11px] text-[#029500] font-medium">
                      {discountPct > 0
                        ? `Shows -${discountPct}% discount (${formatRiel(effectivePrice, khrRate)})`
                        : 'Leave blank if not on sale'}
                    </span>
                  </label>
                </div>
              </section>

              {/* Card 4: Inventory & SKU */}
              <section className="bg-white border border-[#ececec] rounded-[18px] p-5 flex flex-col gap-4">
                <h2 className="text-[15.5px] font-bold text-black">
                  Inventory &amp; SKU
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-black">
                      SKU
                    </span>
                    <input
                      type="text"
                      required
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="e.g. KT-AUD-001"
                      className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13.5px] font-mono outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-black">
                      Stock quantity
                    </span>
                    <input
                      type="number"
                      required
                      min={0}
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value)}
                      className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13.5px] outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-black">
                      Low stock threshold
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13.5px] outline-none"
                    />
                  </label>
                </div>
              </section>
            </div>

            {/* Right Sidebar Cards (Exact Figma Seller · 03) */}
            <div className="flex flex-col gap-4">
              <section className="bg-white border border-[#ececec] rounded-[18px] p-5 flex flex-col gap-3.5">
                <h2 className="text-[15.5px] font-bold text-black">
                  Product status
                </h2>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-black">
                    Visibility
                  </span>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(
                        e.target.value as 'draft' | 'published' | 'archived',
                      )
                    }
                    className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] bg-white outline-none"
                  >
                    <option value="published">
                      Active — Visible on Marketplace
                    </option>
                    <option value="draft">Draft — Hidden from buyers</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <div className="pt-0.5">
                  <StatusPill label="Track inventory enabled" tone="green" />
                </div>
                <div className="pt-2.5 mt-1 border-t border-[#f1f1f1] flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12.5px] font-semibold text-black">
                      Feature on my storefront
                    </p>
                    <p className="text-[11px] text-[#8a8a8a] leading-snug mt-0.5">
                      Highlight this product in your store&apos;s featured
                      section.
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={isFeatured}
                    onChange={setIsFeatured}
                    ariaLabel="Toggle feature on my storefront"
                  />
                </div>

                <div className="pt-2.5 mt-1 border-t border-[#f1f1f1] flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12.5px] font-semibold text-black">
                      Free shipping
                    </p>
                    <p className="text-[11px] text-[#8a8a8a] leading-snug mt-0.5">
                      Offer free delivery for this product regardless of minimum
                      order amount.
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={freeShipping}
                    onChange={setFreeShipping}
                    ariaLabel="Toggle free shipping"
                  />
                </div>
              </section>

              <section className="bg-white border border-[#ececec] rounded-[18px] p-5 flex flex-col gap-3.5">
                <div>
                  <h2 className="text-[15.5px] font-bold text-black">
                    Organization
                  </h2>
                  <p className="text-[11.5px] text-[#8a8a8a] mt-0.5">
                    Optional — leave blank if not applicable.
                  </p>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-black">
                    Category (optional)
                  </span>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] bg-white outline-none"
                  >
                    <option value="">No category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              <section className="bg-white border border-[#ececec] rounded-[18px] p-5 flex flex-col gap-2">
                <h2 className="text-[15.5px] font-bold text-black">
                  Search engine preview
                </h2>
                <p className="text-[13.5px] font-semibold text-[#ff6e20] truncate">
                  {name.trim() || 'Your product title'} |{' '}
                  {user?.store?.name || 'Kova Store'}
                </p>
                <p className="text-[11.5px] text-[#029500] truncate">
                  kova.com.kh/product/{previewSlug || 'product-slug'}
                </p>
                <p className="text-[12px] text-[#767676] line-clamp-2 leading-relaxed">
                  {shortDescription.trim() ||
                    description.trim() ||
                    'Add a clear summary so Cambodia buyers find your listing faster.'}
                </p>
              </section>
            </div>
          </div>
        </form>
      )}
    </DashboardModal>
  );
}

export function SellerProductFormPage() {
  const { productId } = useParams<{ productId: string }>();
  return (
    <Navigate
      to={
        productId
          ? `/seller/products?edit=${encodeURIComponent(productId)}`
          : '/seller/products?add=1'
      }
      replace
    />
  );
}

// ==========================================
// 4. Inventory Control (/seller/inventory) — Exact Figma Seller · 06
// 4 KPI Cards + 2:1 (Stock Ledger with Tabs | Orange-Bordered Quick Stock Adjustment)
// ==========================================
type InventoryTab = 'all' | 'low' | 'out' | 'history';

export function SellerInventoryPage() {
  const { showToast } = useStore();
  const [tab, setTab] = useState<InventoryTab>('all');
  const [products, setProducts] = useState<SellerProductItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovementItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [type, setType] = useState<'restock' | 'adjustment'>('restock');
  const [qtyChange, setQtyChange] = useState('10');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [prodRes, movRes] = await Promise.all([
        storeOwnerApi.getProducts({ per_page: 100 }),
        storeOwnerApi.getInventoryMovements(1),
      ]);
      setProducts(prodRes.data);
      setMovements(movRes.data);
      setSelectedProductId((prev) => prev || prodRes.data[0]?.id || 0);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to load inventory.',
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void loadData();
    });
    return () => {
      active = false;
    };
  }, [loadData]);

  const totalUnits = products.reduce((sum, p) => sum + p.stock_quantity, 0);
  const totalValue = products.reduce(
    (sum, p) =>
      sum + p.stock_quantity * Number(p.discount_price || p.regular_price),
    0,
  );
  const lowProducts = products.filter(
    (p) =>
      p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold ?? 5),
  );
  const outProducts = products.filter((p) => p.stock_quantity === 0);

  const filteredProducts =
    tab === 'low' ? lowProducts : tab === 'out' ? outProducts : products;

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const deltaNum = Number(qtyChange) || 0;
  const projectedStock = selectedProduct
    ? Math.max(0, selectedProduct.stock_quantity + deltaNum)
    : 0;

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || deltaNum === 0) return;
    setSubmitting(true);
    try {
      const res = await storeOwnerApi.adjustStock({
        product_id: selectedProductId,
        quantity_change: deltaNum,
        type,
        notes: notes.trim() || undefined,
      });
      showToast(
        `Stock updated. New available quantity: ${res.data.current_stock} units.`,
      );
      setNotes('');
      await loadData();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to adjust stock.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    exportRowsToCsv(
      `kova-inventory-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Product', 'SKU', 'Available', 'Low Stock Threshold', 'Status'],
      products.map((p) => [
        p.name,
        p.sku,
        p.stock_quantity,
        p.low_stock_threshold ?? 5,
        p.stock_quantity === 0
          ? 'Out of stock'
          : p.stock_quantity <= (p.low_stock_threshold ?? 5)
            ? 'Low stock'
            : 'In stock',
      ]),
    );
    showToast('Inventory snapshot exported.');
  };

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Inventory control"
        subtitle="Track real-time stock levels, low-stock alerts, manual adjustments, and movement history."
        actions={
          <button
            type="button"
            onClick={handleExport}
            className="bg-white border border-[#ececec] hover:border-[#cccccc] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full transition-colors"
          >
            Export CSV
          </button>
        }
      />

      <KpiGrid
        items={[
          {
            label: 'Total SKUs',
            value: String(products.length),
            sub: 'Tracked in your store',
            badge: 'Active',
            tone: 'neutral',
          },
          {
            label: 'In stock units',
            value: totalUnits.toLocaleString('en-US'),
            sub: `Est. value $${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            badge: 'Healthy',
            tone: 'green',
          },
          {
            label: 'Low stock alerts',
            value: `${lowProducts.length} SKUs`,
            sub: 'At or below threshold',
            badge: lowProducts.length > 0 ? 'Restock' : 'Good',
            tone: lowProducts.length > 0 ? 'red' : 'green',
          },
          {
            label: 'Out of stock',
            value: `${outProducts.length} SKUs`,
            sub: 'Unavailable at checkout',
            badge: outProducts.length > 0 ? 'Urgent' : 'None',
            tone: outProducts.length > 0 ? 'red' : 'green',
          },
        ]}
      />

      {/* Exact Figma Seller · 06 2:1 Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(310px,1fr)] gap-5 items-start">
        <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-[15.5px] font-bold text-black">
              Stock levels &amp; SKU ledger
            </h2>
            <p className="text-[12px] text-[#8a8a8a] mt-0.5">
              Click Adjust on any product row to restock or deduct inventory on
              the right.
            </p>
          </div>

          <FilterPillTabs<InventoryTab>
            value={tab}
            onChange={setTab}
            options={[
              { id: 'all', label: 'All', count: products.length },
              { id: 'low', label: 'Low stock', count: lowProducts.length },
              { id: 'out', label: 'Out of stock', count: outProducts.length },
              {
                id: 'history',
                label: 'Stock history',
                count: movements.length,
              },
            ]}
          />

          {loading ? (
            <DashboardTableSkeleton rows={5} />
          ) : tab === 'history' ? (
            movements.length === 0 ? (
              <p className="py-12 text-center bg-[#f7f7f7] rounded-[14px] text-[13px] text-[#767676]">
                No stock movements recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                      <th className="py-2.5 px-3.5 rounded-l-[10px]">
                        Product
                      </th>
                      <th className="py-2.5 px-3.5">Type</th>
                      <th className="py-2.5 px-3.5">Change</th>
                      <th className="py-2.5 px-3.5">Notes</th>
                      <th className="py-2.5 px-3.5 rounded-r-[10px]">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                    {movements.map((m) => (
                      <tr
                        key={m.id}
                        className="hover:bg-[#fafafa] transition-colors"
                      >
                        <td className="py-3.5 px-3.5">
                          <p className="font-semibold text-black">
                            {m.product?.name || `Product #${m.product_id}`}
                          </p>
                          <p className="text-[11px] font-mono text-[#8a8a8a]">
                            {m.product?.sku}
                          </p>
                        </td>
                        <td className="py-3.5 px-3.5 capitalize text-[#555555]">
                          {m.type}
                        </td>
                        <td className="py-3.5 px-3.5 font-bold">
                          <span
                            className={
                              m.quantity_change >= 0
                                ? 'text-[#029500]'
                                : 'text-[#e5322d]'
                            }
                          >
                            {m.quantity_change >= 0
                              ? `+${m.quantity_change}`
                              : m.quantity_change}
                          </span>
                        </td>
                        <td className="py-3.5 px-3.5 text-[#767676]">
                          {m.notes || '—'}
                        </td>
                        <td className="py-3.5 px-3.5 text-[#767676] whitespace-nowrap">
                          {formatShortDate(m.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredProducts.length === 0 ? (
            <p className="py-12 text-center bg-[#f7f7f7] rounded-[14px] text-[13px] text-[#767676]">
              No products in this stock tier.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                    <th className="py-2.5 px-3.5 rounded-l-[10px]">Product</th>
                    <th className="py-2.5 px-3.5">SKU</th>
                    <th className="py-2.5 px-3.5">Available</th>
                    <th className="py-2.5 px-3.5">Status</th>
                    <th className="py-2.5 px-3.5 rounded-r-[10px] text-right">
                      Adjust
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                  {filteredProducts.map((p) => {
                    const isOut = p.stock_quantity === 0;
                    const isLow =
                      !isOut &&
                      p.stock_quantity <= (p.low_stock_threshold ?? 5);
                    const activeRow = p.id === selectedProductId;
                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors ${
                          activeRow ? 'bg-[#fff9f5]' : 'hover:bg-[#fafafa]'
                        }`}
                      >
                        <td className="py-3.5 px-3.5">
                          <div className="flex items-center gap-3">
                            {p.primary_image?.image_url ? (
                              <img
                                src={p.primary_image.image_url}
                                alt={p.name}
                                className="w-10 h-10 rounded-[10px] object-cover border border-[#ececec] shrink-0"
                              />
                            ) : (
                              <span className="w-10 h-10 rounded-[10px] bg-[#f7f7f7] border border-[#ececec] flex items-center justify-center shrink-0">
                                <FigmaIcon
                                  name="package"
                                  className="w-4 h-4 text-[#979797]"
                                />
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-black truncate max-w-[180px]">
                                {p.name}
                              </p>
                              <p className="text-[11px] text-[#8a8a8a]">
                                {p.category?.name || 'General'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3.5 font-mono text-[12px] text-[#555555]">
                          {p.sku}
                        </td>
                        <td
                          className={`py-3.5 px-3.5 font-bold ${
                            isOut || isLow ? 'text-[#e5322d]' : 'text-black'
                          }`}
                        >
                          {p.stock_quantity}
                        </td>
                        <td className="py-3.5 px-3.5">
                          <StatusPill
                            label={
                              isOut
                                ? 'Out of stock'
                                : isLow
                                  ? 'Low stock'
                                  : 'In stock'
                            }
                          />
                        </td>
                        <td className="py-3.5 px-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProductId(p.id);
                              setType(
                                isOut || isLow ? 'restock' : 'adjustment',
                              );
                              setQtyChange(isOut || isLow ? '20' : '5');
                            }}
                            className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline"
                          >
                            {isOut ? 'Restock' : 'Adjust'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Exact Figma Seller · 06 Orange-Bordered Stock Adjustment Panel */}
        <form
          onSubmit={handleAdjust}
          className="bg-white border border-[#ff6e20]/60 rounded-[20px] p-5 flex flex-col gap-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-[15.5px] font-bold text-black">
                Stock adjustment
              </h2>
              <p className="text-[12px] text-[#8a8a8a] truncate mt-0.5">
                {selectedProduct
                  ? `${selectedProduct.name} (${selectedProduct.sku})`
                  : 'Select a product'}
              </p>
            </div>
            {selectedProduct && (
              <StatusPill
                label={`Stock: ${selectedProduct.stock_quantity}`}
                tone={
                  selectedProduct.stock_quantity <=
                  (selectedProduct.low_stock_threshold ?? 5)
                    ? 'red'
                    : 'green'
                }
              />
            )}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Product
            </span>
            <select
              required
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(Number(e.target.value))}
              className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] bg-white outline-none"
            >
              {products.length === 0 && (
                <option value={0}>No products yet</option>
              )}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.stock_quantity} left)
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Adjustment type
            </span>
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value as 'restock' | 'adjustment')
              }
              className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] bg-white outline-none"
            >
              <option value="restock">Add stock (+ Incoming shipment)</option>
              <option value="adjustment">Manual adjustment (+/-)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Quantity change (negative to deduct)
            </span>
            <input
              type="number"
              required
              value={qtyChange}
              onChange={(e) => setQtyChange(e.target.value)}
              className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] outline-none"
            />
            {selectedProduct && (
              <span className="text-[11.5px] text-[#767676]">
                New available quantity:{' '}
                <strong className="text-black">{projectedStock} units</strong>
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Internal notes
            </span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Supplier restock batch #12..."
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] p-3 text-[13px] outline-none"
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setQtyChange('10');
                setNotes('');
              }}
              className="bg-white border border-[#ececec] hover:border-[#cccccc] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedProductId || deltaNum === 0}
              className="flex-1 bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold py-2.5 rounded-full transition-colors"
            >
              {submitting ? 'Updating...' : 'Confirm adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
