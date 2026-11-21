import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { ApiError } from '../../services/api';
import {
  adminApi,
  type AdminBakongOverview,
  type AdminDashboardData,
  type AdminDisputeItem,
  type AdminStoreApplication,
  type AdminStoreItem,
  type BakongTxItem,
} from '../../services/dashboardApi';
import { formatRiel, formatShortDate } from '../../utils/currency';
import { exportRowsToCsv } from '../../utils/csv';
import {
  DashboardPageHeader,
  FilterPillTabs,
  KpiGrid,
  ProgressBreakdownCard,
  SlideOverDrawer,
  StatusPill,
  TablePagination,
  TrendAreaChart,
  type BreakdownBarItem,
  type KpiCardItem,
  type TrendSeriesPoint,
} from '../../components/DashboardPrimitives';
import { FigmaIcon } from '../../components/FigmaIcon';
import {
  DashboardKpiSkeleton,
  DashboardTableSkeleton,
} from '../../components/Skeleton';
import { VerifiedBadge } from '../../components/VerifiedBadge';

type OverviewRange = 'today' | '7d' | '30d' | 'ytd';

function buildAdminTrendPoints(
  txs: BakongTxItem[],
  range: OverviewRange,
  fallbackGmv: number,
  fallbackCommission: number,
): TrendSeriesPoint[] {
  const now = new Date();
  const bucketCount = range === 'today' ? 6 : range === '7d' ? 7 : range === '30d' ? 8 : 6;
  const daysSpan = range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 180;
  const stepMs = (daysSpan * 24 * 60 * 60 * 1000) / bucketCount;
  const startMs = now.getTime() - daysSpan * 24 * 60 * 60 * 1000;

  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const endDate = new Date(startMs + stepMs * (i + 1));
    const label =
      range === 'today'
        ? endDate.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
        : range === 'ytd'
          ? endDate.toLocaleDateString('en-US', { month: 'short' })
          : endDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    return {
      label,
      start: startMs + stepMs * i,
      end: startMs + stepMs * (i + 1),
      primary: 0,
      secondary: 0,
    };
  });

  const paidTxs = txs.filter((t) => t.payment_status === 'successful');
  const commRatio =
    fallbackGmv > 0 ? Math.min(fallbackCommission / fallbackGmv, 0.5) : 0.05;

  let cumulativeGmv = 0;
  let cumulativeComm = 0;

  if (paidTxs.length > 0) {
    for (const b of buckets) {
      for (const tx of paidTxs) {
        const ts = new Date(tx.created_at).getTime();
        if (ts >= b.start && ts <= b.end) {
          const amt = Number(tx.amount) || 0;
          cumulativeGmv += amt;
          cumulativeComm += amt * commRatio;
        }
      }
      b.primary = Number(cumulativeGmv.toFixed(2));
      b.secondary = Number(cumulativeComm.toFixed(2));
    }
  } else if (fallbackGmv > 0) {
    // Live orders exist outside recent KHQR window — plot final point truthfully
    buckets[buckets.length - 1].primary = Number(fallbackGmv.toFixed(2));
    buckets[buckets.length - 1].secondary = Number(fallbackCommission.toFixed(2));
  }

  return buckets.map(({ label, primary, secondary }) => ({
    label,
    primary,
    secondary,
  }));
}

// ==========================================
// 1. Admin Platform Overview (/admin) — Figma Admin · 01
// ==========================================
export function AdminOverviewPage() {
  const { khrRate, showToast, refreshCatalog } = useStore();
  const [range, setRange] = useState<OverviewRange>('30d');
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [bakong, setBakong] = useState<AdminBakongOverview | null>(null);
  const [recentTxs, setRecentTxs] = useState<BakongTxItem[]>([]);
  const [pendingApps, setPendingApps] = useState<AdminStoreApplication[]>([]);
  const [openDisputes, setOpenDisputes] = useState<AdminDisputeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [dashRes, appsRes, bakongRes, txRes, dispRes] =
        await Promise.allSettled([
          adminApi.getDashboard(),
          adminApi.getStoreApplications({ status: 'pending', per_page: 6 }),
          adminApi.getBakongOverview(),
          adminApi.getBakongTransactions({ page: 1 }),
          adminApi.getDisputes({ status: 'open', page: 1 }),
        ]);

      if (dashRes.status === 'fulfilled') setData(dashRes.value);
      else throw dashRes.reason;

      if (appsRes.status === 'fulfilled') setPendingApps(appsRes.value.data);
      if (bakongRes.status === 'fulfilled') setBakong(bakongRes.value);
      if (txRes.status === 'fulfilled') setRecentTxs(txRes.value.data);
      if (dispRes.status === 'fulfilled') {
        setOpenDisputes(dispRes.value.data.slice(0, 4));
      }
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Failed to load platform analytics.',
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

  const handleQuickApprove = async (id: number) => {
    setBusyId(id);
    try {
      const res = await adminApi.approveApplication(id);
      showToast(res.message || 'Store application approved.');
      await Promise.all([loadData(), refreshCatalog()]);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to approve store.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const trendPoints = useMemo(() => {
    if (!data) return [];
    return buildAdminTrendPoints(
      recentTxs,
      range,
      data.metrics.total_gross_revenue,
      data.metrics.total_platform_commission,
    );
  }, [recentTxs, range, data]);

  if (loading || !data) {
    return (
      <div className="flex flex-col gap-5">
        <DashboardPageHeader
          title="Platform overview"
          subtitle="Real-time marketplace command center across Cambodia."
        />
        <DashboardKpiSkeleton count={8} />
        <DashboardTableSkeleton rows={5} />
      </div>
    );
  }

  const m = data.metrics;
  const avgTakeRate =
    m.total_gross_revenue > 0
      ? ((m.total_platform_commission / m.total_gross_revenue) * 100).toFixed(1)
      : '0.0';

  const kpis: KpiCardItem[] = [
    {
      label: 'Marketplace GMV',
      value: `$${m.total_gross_revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${formatRiel(m.total_gross_revenue, khrRate)} · ${m.total_orders} orders`,
      badge: 'Live GMV',
      tone: 'green',
    },
    {
      label: 'Commission earned',
      value: `$${m.total_platform_commission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `Avg take rate ${avgTakeRate}%`,
      badge: 'Settled',
      tone: 'green',
    },
    {
      label: 'Bakong KHQR volume',
      value: `$${m.successful_payments_volume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${m.pending_payments_count} pending KHQR invoices`,
      badge: 'KHQR',
      tone: 'orange',
    },
    {
      label: 'Total orders',
      value: m.total_orders.toLocaleString('en-US'),
      sub: 'Across all marketplace stores',
      badge: 'Orders',
      tone: 'neutral',
    },
    {
      label: 'Active stores',
      value: String(m.total_stores),
      sub: `${m.pending_store_applications} pending approval`,
      badge:
        m.pending_store_applications > 0
          ? `${m.pending_store_applications} pending`
          : 'Up to date',
      tone: m.pending_store_applications > 0 ? 'orange' : 'green',
    },
    {
      label: 'Total customers',
      value: m.total_customers.toLocaleString('en-US'),
      sub: 'Registered buyer accounts',
      badge: 'Buyers',
      tone: 'green',
    },
    {
      label: 'Total products',
      value: m.total_products.toLocaleString('en-US'),
      sub: 'Active marketplace catalog',
      badge: 'Catalog',
      tone: 'neutral',
    },
    {
      label: 'Pending queue',
      value: String(m.pending_store_applications + openDisputes.length),
      sub: `${m.pending_store_applications} KYC · ${openDisputes.length} disputes`,
      badge:
        m.pending_store_applications + openDisputes.length > 0
          ? 'Action needed'
          : 'All clear',
      tone:
        m.pending_store_applications + openDisputes.length > 0 ? 'red' : 'green',
    },
  ];

  // Real breakdown bars derived from live Bakong & Store metrics
  const totalTxCount =
    (bakong?.transactions.successful_count ?? 0) +
    (bakong?.transactions.pending_count ?? 0) +
    (bakong?.transactions.failed_count ?? 0);

  const totalStoreConnections =
    (bakong?.stores.connected ?? 0) +
    (bakong?.stores.disconnected_or_expired ?? 0) +
    (bakong?.stores.not_configured ?? 0);

  const pct = (part: number, whole: number) =>
    whole > 0 ? Math.round((part / whole) * 100) : 0;

  const breakdownItems: BreakdownBarItem[] = [
    {
      label: 'KHQR Paid Payments',
      rightText: `${pct(bakong?.transactions.successful_count ?? 0, totalTxCount)}% · $${(bakong?.transactions.total_volume ?? m.successful_payments_volume).toFixed(2)}`,
      percent: pct(bakong?.transactions.successful_count ?? 0, totalTxCount),
      color: 'orange',
    },
    {
      label: 'Connected Bakong Stores',
      rightText: `${pct(bakong?.stores.connected ?? 0, totalStoreConnections)}% · ${bakong?.stores.connected ?? 0} stores`,
      percent: pct(bakong?.stores.connected ?? 0, totalStoreConnections),
      color: 'green',
    },
    {
      label: 'Pending KHQR Invoices',
      rightText: `${pct(bakong?.transactions.pending_count ?? m.pending_payments_count, totalTxCount)}% · ${bakong?.transactions.pending_count ?? m.pending_payments_count} tx`,
      percent: pct(
        bakong?.transactions.pending_count ?? m.pending_payments_count,
        totalTxCount,
      ),
      color: 'neutral',
    },
    {
      label: 'Expired / Failed KHQR',
      rightText: `${pct(bakong?.transactions.failed_count ?? 0, totalTxCount)}% · ${bakong?.transactions.failed_count ?? 0} tx`,
      percent: pct(bakong?.transactions.failed_count ?? 0, totalTxCount),
      color: 'red',
    },
  ];

  const handleExportReport = () => {
    exportRowsToCsv(
      `kova-platform-overview-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Metric', 'Value'],
      kpis.map((k) => [k.label, k.value]),
    );
    showToast('Platform overview CSV exported.');
  };

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Platform overview"
        subtitle={`Real-time marketplace command center across ${m.total_stores} stores, ${m.total_customers} customers, and ${m.total_products} products.`}
        actions={
          <>
            <div className="inline-flex items-center gap-1.5">
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: '7d', label: '7D' },
                  { id: '30d', label: '30D' },
                  { id: 'ytd', label: 'YTD' },
                ] as { id: OverviewRange; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRange(t.id)}
                  className={`px-3.5 py-[7px] rounded-full text-[12px] font-semibold transition-colors ${
                    range === t.id
                      ? 'bg-[#ff6e20] text-white border border-[#ff6e20]'
                      : 'bg-white border border-[#ececec] text-[#555555] hover:border-[#cccccc] hover:text-black'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleExportReport}
              className="bg-white border border-[#ececec] hover:border-[#cccccc] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full transition-colors"
            >
              Export report
            </button>
          </>
        }
      />

      {/* 8 KPI Cards (2 rows of 4 — Exact Figma Admin · 01) */}
      <KpiGrid items={kpis} />

      {/* Middle 2:1 Analytics Row (Exact Figma Admin · 01) */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(310px,1fr)] gap-4">
        <TrendAreaChart
          title="Platform GMV & commission revenue"
          subtitle="Marketplace transaction volume across Cambodia (USD)"
          badge={bakong ? `ENV: ${bakong.environment}` : 'Live'}
          badgeTone="green"
          primaryLabel="GMV"
          secondaryLabel="Commission"
          points={trendPoints}
          emptyHint="Trend lines populate automatically as customer KHQR payments settle."
        />

        <ProgressBreakdownCard
          title="Payment & merchant health"
          subtitle="Live Bakong KHQR & store readiness"
          items={breakdownItems}
          footerPills={[
            {
              label: `${bakong?.stores.connected ?? 0} Connected`,
              tone: 'green',
            },
            {
              label: `${m.pending_payments_count} Pending`,
              tone: 'orange',
            },
            {
              label: `${bakong?.stores.not_configured ?? 0} Unconfigured`,
              tone: 'neutral',
            },
          ]}
        />
      </div>

      {/* Bottom 2:1 Operations Row (Exact Figma Admin · 01) */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(310px,1fr)] gap-4 items-start">
        <section className="bg-white border border-[#ececec] rounded-[18px] p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[15.5px] font-bold text-black">
                Pending approvals &amp; system alerts
              </h2>
              <p className="text-[12px] text-[#8a8a8a] mt-0.5">
                Requires Root Admin review
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <StatusPill
                label={`${pendingApps.length} stores · ${openDisputes.length} disputes`}
                tone={
                  pendingApps.length + openDisputes.length > 0
                    ? 'orange'
                    : 'green'
                }
              />
              <Link
                to="/admin/stores?tab=applications"
                className="text-[12px] font-semibold text-[#ff6e20] hover:underline"
              >
                View all
              </Link>
            </div>
          </div>

          {pendingApps.length === 0 && openDisputes.length === 0 ? (
            <div className="py-12 text-center bg-[#f7f7f7] rounded-[14px]">
              <p className="text-[14px] font-semibold text-black">
                All queues are clear
              </p>
              <p className="text-[12.5px] text-[#767676] mt-1">
                New store applications and escalated customer disputes will
                appear here immediately.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                    <th className="py-2.5 px-3.5 rounded-l-[10px]">
                      Queue item
                    </th>
                    <th className="py-2.5 px-3.5">Owner / Entity</th>
                    <th className="py-2.5 px-3.5">Submitted</th>
                    <th className="py-2.5 px-3.5">Type</th>
                    <th className="py-2.5 px-3.5 rounded-r-[10px] text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                  {pendingApps.map((app) => (
                    <tr
                      key={`app-${app.id}`}
                      className="hover:bg-[#fafafa] transition-colors"
                    >
                      <td className="py-3.5 px-3.5">
                        <p className="font-semibold text-black">
                          {app.store_name}
                        </p>
                        <p className="text-[11.5px] text-[#8a8a8a] truncate max-w-[220px]">
                          {app.store_address || app.email}
                        </p>
                      </td>
                      <td className="py-3.5 px-3.5 text-[#333333] font-medium">
                        {app.user?.name || app.phone}
                      </td>
                      <td className="py-3.5 px-3.5 text-[#767676] whitespace-nowrap">
                        {formatShortDate(app.created_at)}
                      </td>
                      <td className="py-3.5 px-3.5">
                        <StatusPill label="New store" tone="orange" />
                      </td>
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            disabled={busyId === app.id}
                            onClick={() => void handleQuickApprove(app.id)}
                            className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline disabled:opacity-50"
                          >
                            {busyId === app.id ? 'Approving...' : 'Approve'}
                          </button>
                          <Link
                            to="/admin/stores?tab=applications"
                            className="text-[12.5px] font-semibold text-[#555555] hover:text-black"
                          >
                            Review
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {openDisputes.map((disp) => (
                    <tr
                      key={`disp-${disp.id}`}
                      className="hover:bg-[#fafafa] transition-colors"
                    >
                      <td className="py-3.5 px-3.5">
                        <p className="font-semibold text-black">
                          Dispute #{disp.id}
                          {disp.refund?.amount
                            ? ` ($${Number(disp.refund.amount).toFixed(2)})`
                            : ''}
                        </p>
                        <p className="text-[11.5px] text-[#8a8a8a] truncate max-w-[220px]">
                          {disp.reason || 'Refund dispute'}
                        </p>
                      </td>
                      <td className="py-3.5 px-3.5 text-[#333333] font-medium">
                        {disp.user?.name || 'Customer'} vs{' '}
                        {disp.store?.name || 'Store'}
                      </td>
                      <td className="py-3.5 px-3.5 text-[#767676] whitespace-nowrap">
                        {formatShortDate(disp.created_at)}
                      </td>
                      <td className="py-3.5 px-3.5">
                        <StatusPill label="Dispute" tone="red" />
                      </td>
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <Link
                          to="/admin/disputes"
                          className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline"
                        >
                          Mediate
                        </Link>
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
                Top-performing stores
              </h2>
              <p className="text-[12px] text-[#8a8a8a] mt-0.5">
                Gross marketplace sales
              </p>
            </div>
            {data.top_stores.length === 0 ? (
              <p className="text-[12.5px] text-[#767676] py-6 text-center bg-[#f7f7f7] rounded-[12px]">
                No store sales recorded yet.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-[#f1f1f1]">
                {data.top_stores.map((s) => (
                  <Link
                    key={s.id}
                    to={`/store/${s.slug}`}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:opacity-85 transition-opacity"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {s.logo ? (
                        <img
                          src={s.logo}
                          alt={s.name}
                          className="w-9 h-9 rounded-[10px] object-cover border border-[#ececec] shrink-0"
                        />
                      ) : (
                        <span className="w-9 h-9 rounded-[10px] bg-[#ff6e20] text-white text-[12px] font-bold flex items-center justify-center shrink-0">
                          {s.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-black truncate">
                          {s.name}
                        </p>
                        <p className="text-[11px] text-[#8a8a8a] truncate">
                          /store/{s.slug}
                        </p>
                      </div>
                    </div>
                    <span className="text-[13.5px] font-bold text-[#029500] shrink-0">
                      ${Number(s.total_sales).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white border border-[#ececec] rounded-[18px] p-5 flex flex-col gap-3.5">
            <div>
              <h2 className="text-[15.5px] font-bold text-black">
                Best-selling products
              </h2>
              <p className="text-[12px] text-[#8a8a8a] mt-0.5">
                Platform-wide unit volume
              </p>
            </div>
            {data.best_selling_products.length === 0 ? (
              <p className="text-[12.5px] text-[#767676] py-6 text-center bg-[#f7f7f7] rounded-[12px]">
                No product orders recorded yet.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-[#f1f1f1]">
                {data.best_selling_products.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2.5 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-black truncate">
                        {p.name}
                      </p>
                      <p className="text-[11px] text-[#8a8a8a] truncate">
                        {p.store?.name || p.sku}
                      </p>
                    </div>
                    <span className="text-[12.5px] font-bold text-[#ff6e20] shrink-0">
                      {p.units_sold} sold
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. Admin Store & Application Management (/admin/stores)
// Matches Figma Admin · 02 (Table) + Admin · 03 (Store Administration Drawer)
// ==========================================
type StoreFilterMode =
  | 'all_stores'
  | 'active_stores'
  | 'pending_apps'
  | 'suspended_stores'
  | 'rejected_apps';

export function AdminStoresPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast, refreshCatalog } = useStore();

  const initialFilter: StoreFilterMode =
    searchParams.get('tab') === 'applications' ? 'pending_apps' : 'all_stores';

  const [filterMode, setFilterMode] = useState<StoreFilterMode>(initialFilter);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(1);

  const [stores, setStores] = useState<AdminStoreItem[]>([]);
  const [applications, setApplications] = useState<AdminStoreApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Store Administration Drawer (Figma Admin · 03)
  const [selectedStore, setSelectedStore] = useState<AdminStoreItem | null>(null);
  const [commissionDraft, setCommissionDraft] = useState('');

  // Application KYC Review Drawer
  const [selectedApp, setSelectedApp] = useState<AdminStoreApplication | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [storesRes, appsRes] = await Promise.all([
        adminApi.getStores({ per_page: 100 }),
        adminApi.getStoreApplications({ per_page: 100 }),
      ]);
      setStores(storesRes.data);
      setApplications(appsRes.data);

      setSelectedStore((prev) =>
        prev ? storesRes.data.find((s) => s.id === prev.id) ?? null : null,
      );
      setSelectedApp((prev) =>
        prev ? appsRes.data.find((a) => a.id === prev.id) ?? null : null,
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to load stores.',
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

  const activeCount = stores.filter((s) => s.status === 'approved').length;
  const suspendedCount = stores.filter((s) => s.status === 'suspended').length;
  const pendingAppCount = applications.filter(
    (a) => a.status === 'pending',
  ).length;
  const rejectedAppCount = applications.filter(
    (a) => a.status === 'rejected',
  ).length;

  const isAppTab =
    filterMode === 'pending_apps' || filterMode === 'rejected_apps';

  const q = search.trim().toLowerCase();

  const filteredStores = useMemo(() => {
    return stores.filter((s) => {
      if (filterMode === 'active_stores' && s.status !== 'approved') {
        return false;
      }
      if (filterMode === 'suspended_stores' && s.status !== 'suspended') {
        return false;
      }
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.owner?.name || '').toLowerCase().includes(q) ||
        (s.address || '').toLowerCase().includes(q)
      );
    });
  }, [stores, filterMode, q]);

  const filteredApps = useMemo(() => {
    return applications.filter((a) => {
      if (filterMode === 'pending_apps' && a.status !== 'pending') return false;
      if (filterMode === 'rejected_apps' && a.status !== 'rejected') {
        return false;
      }
      if (!q) return true;
      return (
        a.store_name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.user?.name || '').toLowerCase().includes(q)
      );
    });
  }, [applications, filterMode, q]);

  const perPage = 10;
  const activeListLen = isAppTab ? filteredApps.length : filteredStores.length;
  const lastPage = Math.max(1, Math.ceil(activeListLen / perPage));
  const safePage = Math.min(page, lastPage);
  const pagedStores = filteredStores.slice(
    (safePage - 1) * perPage,
    safePage * perPage,
  );
  const pagedApps = filteredApps.slice(
    (safePage - 1) * perPage,
    safePage * perPage,
  );

  const openStoreDrawer = (store: AdminStoreItem) => {
    setSelectedStore(store);
    setCommissionDraft(
      store.commission_rate !== null && store.commission_rate !== undefined
        ? String(store.commission_rate)
        : '',
    );
  };

  const openAppDrawer = (app: AdminStoreApplication) => {
    setSelectedApp(app);
    setRejectReason(app.rejection_reason || '');
    setShowRejectBox(false);
  };

  const handleApproveApp = async (appId: number) => {
    setBusyId(appId);
    try {
      const res = await adminApi.approveApplication(appId);
      showToast(res.message || 'Store application approved.');
      setSelectedApp(null);
      await Promise.all([loadData(), refreshCatalog()]);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Approve failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !rejectReason.trim()) return;
    setBusyId(selectedApp.id);
    try {
      const res = await adminApi.rejectApplication(
        selectedApp.id,
        rejectReason.trim(),
      );
      showToast(res.message || 'Application rejected.');
      setSelectedApp(null);
      setRejectReason('');
      setShowRejectBox(false);
      await loadData();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Reject failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleVerify = async (store: AdminStoreItem) => {
    setBusyId(store.id);
    try {
      const res = await adminApi.toggleStoreVerification(store.id);
      showToast(res.message || 'Store verification updated.');
      await Promise.all([loadData(), refreshCatalog()]);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Update failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleSuspend = async (store: AdminStoreItem) => {
    setBusyId(store.id);
    try {
      const nextStatus =
        store.status === 'suspended' ? 'approved' : 'suspended';
      const res = await adminApi.toggleStoreSuspension(store.id, nextStatus);
      showToast(res.message || `Store status set to ${nextStatus}.`);
      await Promise.all([loadData(), refreshCatalog()]);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Update failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore) return;
    setBusyId(selectedStore.id);
    try {
      const parsed =
        commissionDraft.trim() === '' ? null : Number(commissionDraft);
      const res = await adminApi.updateStoreCommission(
        selectedStore.id,
        parsed,
      );
      showToast(res.message || 'Commission rate saved.');
      await loadData();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Save failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleExportDirectory = () => {
    exportRowsToCsv(
      `kova-stores-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'ID',
        'Store Name',
        'Owner',
        'Email',
        'Products',
        'Orders',
        'Status',
        'Verified',
        'Commission %',
      ],
      stores.map((s) => [
        s.id,
        s.name,
        s.owner?.name || '',
        s.email || s.owner?.email || '',
        s.products_count ?? 0,
        s.orders_count ?? 0,
        s.status,
        s.is_verified ? 'Yes' : 'No',
        s.commission_rate ?? 'Default',
      ]),
    );
    showToast('Store directory CSV exported.');
  };

  const kpis: KpiCardItem[] = [
    {
      label: 'Active stores',
      value: String(activeCount),
      sub: 'Verified & selling on Kova',
      badge: 'Live',
      tone: 'green',
    },
    {
      label: 'Pending approval',
      value: String(pendingAppCount),
      sub: 'Awaiting KYC review',
      badge: pendingAppCount > 0 ? 'Action' : 'Clear',
      tone: pendingAppCount > 0 ? 'orange' : 'green',
    },
    {
      label: 'Suspended stores',
      value: String(suspendedCount),
      sub: 'SLA / policy hold',
      badge: suspendedCount > 0 ? 'Review' : 'None',
      tone: suspendedCount > 0 ? 'red' : 'neutral',
    },
    {
      label: 'Rejected apps',
      value: String(rejectedAppCount),
      sub: 'Incomplete or declined docs',
      badge: `${applications.length} total`,
      tone: 'neutral',
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Store management"
        subtitle="Approve new seller applications, verify Cambodia business KYC, and manage store commissions and status."
        actions={
          <>
            <Link
              to="/admin/catalog"
              className="bg-white border border-[#ececec] hover:border-[#cccccc] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full transition-colors"
            >
              Store categories
            </Link>
            <button
              type="button"
              onClick={handleExportDirectory}
              className="bg-white border border-[#ececec] hover:border-[#cccccc] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full transition-colors"
            >
              Export directory
            </button>
          </>
        }
      />

      <KpiGrid items={kpis} />

      {/* Main White Table Card (Exact Figma Admin · 02) */}
      <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterPillTabs<StoreFilterMode>
            value={filterMode}
            onChange={(next) => {
              setFilterMode(next);
              setPage(1);
              if (next === 'pending_apps' || next === 'rejected_apps') {
                setSearchParams({ tab: 'applications' });
              } else {
                setSearchParams({});
              }
            }}
            options={[
              { id: 'all_stores', label: 'All stores', count: stores.length },
              { id: 'active_stores', label: 'Active', count: activeCount },
              {
                id: 'pending_apps',
                label: 'Pending approval',
                count: pendingAppCount,
              },
              {
                id: 'suspended_stores',
                label: 'Suspended',
                count: suspendedCount,
              },
              {
                id: 'rejected_apps',
                label: 'Rejected',
                count: rejectedAppCount,
              },
            ]}
          />

          <div className="flex items-center gap-2 bg-[#f7f7f7] border border-[#ececec] focus-within:border-[#ff6e20] focus-within:bg-white rounded-full px-3.5 h-[36px] w-full sm:w-[250px] transition-colors">
            <FigmaIcon name="search" className="w-3.5 h-3.5 text-[#979797]" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search store or owner..."
              className="flex-1 bg-transparent text-[12.5px] text-black placeholder:text-[#979797] outline-none min-w-0"
            />
          </div>
        </div>

        {loading ? (
          <DashboardTableSkeleton rows={6} />
        ) : isAppTab ? (
          pagedApps.length === 0 ? (
            <div className="py-14 text-center bg-[#f7f7f7] rounded-[14px] text-[13.5px] text-[#767676]">
              No store applications match this filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                    <th className="py-2.5 px-3.5 rounded-l-[10px]">Store</th>
                    <th className="py-2.5 px-3.5">Owner</th>
                    <th className="py-2.5 px-3.5">Submitted</th>
                    <th className="py-2.5 px-3.5">Business ID / Tax</th>
                    <th className="py-2.5 px-3.5">Status</th>
                    <th className="py-2.5 px-3.5 rounded-r-[10px] text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                  {pagedApps.map((app) => (
                    <tr
                      key={app.id}
                      className="hover:bg-[#fafafa] transition-colors"
                    >
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-[10px] bg-[#767676] text-white text-[12px] font-bold flex items-center justify-center shrink-0">
                            {app.store_name.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-black truncate max-w-[200px]">
                              {app.store_name}
                            </p>
                            <p className="text-[11.5px] text-[#8a8a8a] truncate max-w-[220px]">
                              {app.store_address || app.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5">
                        <p className="font-medium text-black">
                          {app.user?.name || 'Applicant'}
                        </p>
                        <p className="text-[11.5px] text-[#8a8a8a]">
                          {app.phone}
                        </p>
                      </td>
                      <td className="py-3.5 px-3.5 text-[#767676] whitespace-nowrap">
                        {formatShortDate(app.created_at)}
                      </td>
                      <td className="py-3.5 px-3.5 text-[12px] text-[#555555]">
                        {app.business_registration_number || app.tax_id || '—'}
                      </td>
                      <td className="py-3.5 px-3.5">
                        <StatusPill label={app.status} />
                      </td>
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-3">
                          {app.status === 'pending' && (
                            <button
                              type="button"
                              disabled={busyId === app.id}
                              onClick={() => void handleApproveApp(app.id)}
                              className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline disabled:opacity-50"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openAppDrawer(app)}
                            className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline"
                          >
                            Review KYC
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : pagedStores.length === 0 ? (
          <div className="py-14 text-center bg-[#f7f7f7] rounded-[14px] text-[13.5px] text-[#767676]">
            No stores match this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                  <th className="py-2.5 px-3.5 rounded-l-[10px]">Store</th>
                  <th className="py-2.5 px-3.5">Owner</th>
                  <th className="py-2.5 px-3.5">Registered</th>
                  <th className="py-2.5 px-3.5">Products</th>
                  <th className="py-2.5 px-3.5">Commission</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5">KYC</th>
                  <th className="py-2.5 px-3.5 rounded-r-[10px] text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                {pagedStores.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-[#fafafa] transition-colors"
                  >
                    <td className="py-3.5 px-3.5">
                      <div className="flex items-center gap-3">
                        {s.logo ? (
                          <img
                            src={s.logo}
                            alt={s.name}
                            className="w-9 h-9 rounded-[10px] object-cover border border-[#ececec] shrink-0"
                          />
                        ) : (
                          <span
                            className={`w-9 h-9 rounded-[10px] text-white text-[12px] font-bold flex items-center justify-center shrink-0 ${
                              s.status === 'suspended'
                                ? 'bg-[#e5322d]'
                                : 'bg-[#ff6e20]'
                            }`}
                          >
                            {s.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-black inline-flex items-center gap-1">
                            <span className="truncate max-w-[180px]">
                              {s.name}
                            </span>
                            {s.is_verified && <VerifiedBadge size="xs" />}
                          </p>
                          <p className="text-[11.5px] text-[#8a8a8a] truncate max-w-[200px]">
                            {s.address || s.email || s.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5">
                      <p className="font-medium text-black">
                        {s.owner?.name || '—'}
                      </p>
                      <p className="text-[11.5px] text-[#8a8a8a]">
                        {s.owner?.email || s.email}
                      </p>
                    </td>
                    <td className="py-3.5 px-3.5 text-[#767676] whitespace-nowrap">
                      {formatShortDate(s.created_at)}
                    </td>
                    <td className="py-3.5 px-3.5 font-semibold text-black">
                      {s.products_count ?? 0}
                    </td>
                    <td className="py-3.5 px-3.5 text-[#555555] font-medium">
                      {s.commission_rate !== null &&
                      s.commission_rate !== undefined
                        ? `${s.commission_rate}%`
                        : 'Platform default'}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <StatusPill
                        label={s.status === 'approved' ? 'Active' : s.status}
                      />
                    </td>
                    <td className="py-3.5 px-3.5">
                      <StatusPill
                        label={s.is_verified ? 'Verified' : 'Standard'}
                        tone={s.is_verified ? 'green' : 'neutral'}
                      />
                    </td>
                    <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openStoreDrawer(s)}
                        className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <TablePagination
          page={safePage}
          lastPage={lastPage}
          total={activeListLen}
          perPage={perPage}
          itemLabel={isAppTab ? 'applications' : 'stores'}
          onPageChange={setPage}
        />
      </section>

      {/* Store Administration Drawer (Exact Figma Admin · 03 structure) */}
      <SlideOverDrawer
        open={Boolean(selectedStore)}
        onClose={() => setSelectedStore(null)}
        title={
          selectedStore ? `${selectedStore.name} — Store administration` : ''
        }
        subtitle={
          selectedStore
            ? `Owner: ${selectedStore.owner?.name || '—'} · Registered ${formatShortDate(selectedStore.created_at)}`
            : undefined
        }
        widthClass="max-w-[620px]"
        footer={
          selectedStore && (
            <>
              <Link
                to={`/store/${selectedStore.slug}`}
                className="bg-white border border-[#ececec] hover:border-black text-black text-[12.5px] font-semibold px-4 py-2 rounded-full"
              >
                View storefront
              </Link>
              <button
                type="button"
                disabled={busyId === selectedStore.id}
                onClick={() => void handleToggleSuspend(selectedStore)}
                className={`text-[12.5px] font-semibold px-4 py-2 rounded-full disabled:opacity-60 ${
                  selectedStore.status === 'suspended'
                    ? 'bg-[#e7f6e7] text-[#029500] hover:bg-[#d5efd5]'
                    : 'bg-[#e5322d] text-white hover:bg-[#c92823]'
                }`}
              >
                {selectedStore.status === 'suspended'
                  ? 'Reactivate store'
                  : 'Suspend store'}
              </button>
              <button
                type="button"
                disabled={busyId === selectedStore.id}
                onClick={() => void handleToggleVerify(selectedStore)}
                className="bg-[#029500] hover:bg-[#027d00] disabled:opacity-60 text-white text-[12.5px] font-semibold px-4.5 py-2 rounded-full"
              >
                {selectedStore.is_verified ? 'Remove badge' : 'Verify store'}
              </button>
            </>
          )
        }
      >
        {selectedStore && (
          <div className="flex flex-col gap-5">
            {/* Mini KPI strip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#f7f7f7] rounded-[14px] p-3.5">
                <p className="text-[11px] font-medium text-[#767676]">
                  Products
                </p>
                <p className="text-[20px] font-bold text-black mt-1">
                  {selectedStore.products_count ?? 0}
                </p>
              </div>
              <div className="bg-[#f7f7f7] rounded-[14px] p-3.5">
                <p className="text-[11px] font-medium text-[#767676]">Orders</p>
                <p className="text-[20px] font-bold text-black mt-1">
                  {selectedStore.orders_count ?? 0}
                </p>
              </div>
              <div className="bg-[#f7f7f7] rounded-[14px] p-3.5">
                <p className="text-[11px] font-medium text-[#767676]">Status</p>
                <div className="mt-1.5">
                  <StatusPill
                    label={
                      selectedStore.status === 'approved'
                        ? 'Active'
                        : selectedStore.status
                    }
                  />
                </div>
              </div>
            </div>

            {/* Store & owner profile details */}
            <div className="border border-[#ececec] rounded-[16px] p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-black">
                  Store &amp; owner profile
                </h3>
                {selectedStore.is_verified ? (
                  <StatusPill label="Business Verified" tone="green" />
                ) : (
                  <StatusPill label="Standard Seller" tone="neutral" />
                )}
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12.5px]">
                <div>
                  <dt className="text-[#8a8a8a]">Store name</dt>
                  <dd className="font-semibold text-black mt-0.5 flex items-center gap-1">
                    {selectedStore.name}
                    {selectedStore.is_verified && <VerifiedBadge size="xs" />}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#8a8a8a]">Owner</dt>
                  <dd className="font-semibold text-black mt-0.5">
                    {selectedStore.owner?.name || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#8a8a8a]">Email</dt>
                  <dd className="font-medium text-black mt-0.5">
                    {selectedStore.email || selectedStore.owner?.email || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#8a8a8a]">Phone</dt>
                  <dd className="font-medium text-black mt-0.5">
                    {selectedStore.phone || selectedStore.owner?.phone || '—'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[#8a8a8a]">Address</dt>
                  <dd className="font-medium text-black mt-0.5">
                    {selectedStore.address || '—'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[#8a8a8a]">Bakong KHQR Connection</dt>
                  <dd className="mt-1">
                    {selectedStore.bakong_account ? (
                      <div className="inline-flex items-center gap-2">
                        <span className="font-mono text-[12px] font-semibold text-black">
                          {selectedStore.bakong_account.bakong_account_id}
                        </span>
                        <StatusPill
                          label={selectedStore.bakong_account.connection_status}
                        />
                      </div>
                    ) : (
                      <span className="text-[#767676]">Not configured</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Commission override card */}
            <form
              onSubmit={handleSaveCommission}
              className="border border-[#ececec] rounded-[16px] p-4 flex flex-col gap-3"
            >
              <div>
                <h3 className="text-[14px] font-bold text-black">
                  Store commission override
                </h3>
                <p className="text-[12px] text-[#767676] mt-0.5">
                  Leave empty to inherit the global platform commission rate.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  value={commissionDraft}
                  onChange={(e) => setCommissionDraft(e.target.value)}
                  placeholder="Platform default (e.g. 5)"
                  className="flex-1 min-w-[180px] border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2 text-[13px] outline-none"
                />
                <button
                  type="submit"
                  disabled={busyId === selectedStore.id}
                  className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
                >
                  Save commission
                </button>
              </div>
            </form>
          </div>
        )}
      </SlideOverDrawer>

      {/* Application KYC Review Drawer */}
      <SlideOverDrawer
        open={Boolean(selectedApp)}
        onClose={() => {
          setSelectedApp(null);
          setShowRejectBox(false);
        }}
        title={selectedApp ? `KYC Review — ${selectedApp.store_name}` : ''}
        subtitle={
          selectedApp
            ? `Submitted ${formatShortDate(selectedApp.created_at)}`
            : undefined
        }
        footer={
          selectedApp &&
          selectedApp.status === 'pending' &&
          !showRejectBox && (
            <>
              <button
                type="button"
                onClick={() => setShowRejectBox(true)}
                className="bg-[#fdecec] hover:bg-[#fad8d8] text-[#e5322d] text-[12.5px] font-semibold px-4.5 py-2 rounded-full"
              >
                Reject application
              </button>
              <button
                type="button"
                disabled={busyId === selectedApp.id}
                onClick={() => void handleApproveApp(selectedApp.id)}
                className="bg-[#029500] hover:bg-[#027d00] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
              >
                {busyId === selectedApp.id
                  ? 'Approving...'
                  : 'Approve & activate store'}
              </button>
            </>
          )
        }
      >
        {selectedApp && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between bg-[#f7f7f7] rounded-[14px] p-4">
              <div>
                <p className="text-[11.5px] text-[#767676]">
                  Application status
                </p>
                <p className="text-[15px] font-bold text-black mt-0.5">
                  {selectedApp.store_name}
                </p>
              </div>
              <StatusPill label={selectedApp.status} />
            </div>

            <dl className="border border-[#ececec] rounded-[16px] p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-[12.5px]">
              <div>
                <dt className="text-[#8a8a8a]">Applicant name</dt>
                <dd className="font-semibold text-black mt-0.5">
                  {selectedApp.user?.name || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[#8a8a8a]">Contact phone</dt>
                <dd className="font-semibold text-black mt-0.5">
                  {selectedApp.phone}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[#8a8a8a]">Business email</dt>
                <dd className="font-medium text-black mt-0.5">
                  {selectedApp.email}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[#8a8a8a]">Business address</dt>
                <dd className="font-medium text-black mt-0.5">
                  {selectedApp.store_address || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[#8a8a8a]">Business Reg #</dt>
                <dd className="font-mono font-medium text-black mt-0.5">
                  {selectedApp.business_registration_number || 'Not provided'}
                </dd>
              </div>
              <div>
                <dt className="text-[#8a8a8a]">Cambodia Tax TIN</dt>
                <dd className="font-mono font-medium text-black mt-0.5">
                  {selectedApp.tax_id || 'Not provided'}
                </dd>
              </div>
              {selectedApp.store_description && (
                <div className="sm:col-span-2">
                  <dt className="text-[#8a8a8a]">Store description</dt>
                  <dd className="text-[#333333] mt-0.5 leading-relaxed">
                    {selectedApp.store_description}
                  </dd>
                </div>
              )}
              {selectedApp.rejection_reason && (
                <div className="sm:col-span-2 bg-[#fdecec] rounded-[10px] p-3">
                  <dt className="text-[#e5322d] font-semibold">
                    Rejection reason
                  </dt>
                  <dd className="text-[#a11d19] mt-0.5">
                    {selectedApp.rejection_reason}
                  </dd>
                </div>
              )}
            </dl>

            {showRejectBox && selectedApp.status === 'pending' && (
              <form
                onSubmit={handleRejectApp}
                className="border border-[#f5c2c0] bg-[#fff8f8] rounded-[16px] p-4 flex flex-col gap-3"
              >
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold text-[#e5322d]">
                    Reason for rejection
                  </span>
                  <textarea
                    rows={3}
                    required
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Explain clearly what documents or business details need correction..."
                    className="bg-white border border-[#ececec] focus:border-[#e5322d] rounded-[12px] p-3 text-[13px] outline-none"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRejectBox(false)}
                    className="bg-white border border-[#ececec] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busyId === selectedApp.id}
                    className="bg-[#e5322d] hover:bg-[#c92823] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
                  >
                    Confirm reject
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
}
