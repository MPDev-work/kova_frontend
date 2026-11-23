import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { useConfirmDelete } from '../../context/ConfirmDeleteContext';
import { ApiError } from '../../services/api';
import {
  storeOwnerApi,
  type InventoryMovementItem,
  type SellerDashboardData,
  type SellerProductItem,
} from '../../services/dashboardApi';
import { formatRiel, formatShortDate } from '../../utils/currency';
import { exportRowsToCsv } from '../../utils/csv';
import {
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
              to="/seller/products/new"
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
  const [searchParams] = useSearchParams();
  const { khrRate, categories, showToast, refreshCatalog } = useStore();
  const { confirmDelete } = useConfirmDelete();

  const [tab, setTab] = useState<ProductFilterTab>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(1);

  const [products, setProducts] = useState<SellerProductItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const perPage = 10;
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
            <Link
              to="/seller/products/new"
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors"
            >
              Add product
            </Link>
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
            <Link
              to="/seller/products/new"
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
            >
              Add product
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                  <th className="py-2.5 pl-3.5 pr-2 rounded-l-[10px] w-9">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAllPage}
                      aria-label="Select all products on page"
                      className="accent-[#ff6e20]"
                    />
                  </th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Price</th>
                  <th className="py-2.5 px-3">Stock</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3.5 rounded-r-[10px] text-right">
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
                      <td className="py-3.5 pl-3.5 pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(p.id)}
                          aria-label={`Select ${p.name}`}
                          className="accent-[#ff6e20]"
                        />
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
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
                            <p className="font-semibold text-black truncate max-w-[210px]">
                              {p.name}
                            </p>
                            <p className="text-[11px] text-[#8a8a8a] truncate">
                              {p.category?.name || 'Standard'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[12px] text-[#555555] whitespace-nowrap">
                        {p.sku}
                      </td>
                      <td className="py-3.5 px-3 text-[#555555]">
                        {p.category?.name || '—'}
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-bold text-[#ff6e20]">
                          ${price.toFixed(2)}
                        </p>
                        <p className="text-[11px] text-[#8a8a8a]">
                          {formatRiel(price, khrRate)}
                        </p>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
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
                      <td className="py-3.5 px-3">
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
                      <td className="py-3.5 px-3 text-[#767676] whitespace-nowrap">
                        {formatShortDate(p.created_at)}
                      </td>
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2.5">
                          <Link
                            to={`/seller/products/${p.id}/edit`}
                            className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline"
                          >
                            Edit
                          </Link>
                          {/* <Link
                            to={`/product/${p.slug}`}
                            className="text-[12.5px] font-semibold text-[#555555] hover:text-black"
                          >
                            View
                          </Link> */}
                          <button
                            type="button"
                            disabled={deletingId === p.id}
                            onClick={() => void handleDelete(p)}
                            className="text-[12.5px] font-semibold text-[#e5322d] hover:underline disabled:opacity-50"
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
    </div>
  );
}

// ==========================================
// 3. Create / Edit Product — Exact Figma Seller · 03 2-Column Layout
// ==========================================
export function SellerProductFormPage() {
  const { productId } = useParams<{ productId: string }>();
  const isEdit = Boolean(productId);
  const navigate = useNavigate();
  const { user, categories, khrRate, showToast, refreshCatalog } = useStore();

  const [loading, setLoading] = useState(isEdit);
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
    if (!isEdit || !productId) return;
    let active = true;
    storeOwnerApi
      .getProduct(Number(productId))
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
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isEdit, productId, showToast]);

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
        await storeOwnerApi.updateProduct(Number(productId), {
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
      await refreshCatalog();
      navigate('/seller/products');
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to save product.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <DashboardTableSkeleton rows={6} />;
  }

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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submitProduct();
      }}
      className="flex flex-col gap-5"
    >
      <DashboardPageHeader
        title={isEdit ? 'Edit product' : 'Add new product'}
        subtitle="Create a product listing with pricing, product media, inventory, and SEO preview."
        actions={
          <>
            <button
              type="button"
              disabled={saving || uploadingImg}
              onClick={() => void submitProduct('draft')}
              className="bg-[#ffefe6] hover:bg-[#ffe1cf] disabled:opacity-60 text-[#ff6e20] text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors"
            >
              Save as draft
            </button>
            <button
              type="submit"
              disabled={saving || uploadingImg}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full transition-colors"
            >
              {saving
                ? 'Saving...'
                : isEdit
                  ? 'Save product'
                  : 'Publish product'}
            </button>
          </>
        }
      />

      {/* Exact Figma Seller · 03 2:1 Structured Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(290px,1fr)] gap-5 items-start">
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
                  Upload up to 8 images (PNG, JPG, WebP) and choose a primary
                  cover image.
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
                  <FigmaIcon name="upload" className="w-5 h-5 text-[#ff6e20]" />
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
                Prices auto-convert to KHR at {khrRate.toLocaleString('en-US')}{' '}
                KHR / USD.
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
                  Highlight this product in your store&apos;s featured section.
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
