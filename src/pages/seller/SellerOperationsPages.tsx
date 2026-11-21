import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { ApiError } from '../../services/api';
import {
  storeOwnerApi,
  type BakongTxItem,
  type SellerBakongStatus,
  type SellerDashboardData,
  type SellerOrderItem,
  type SellerPayoutItem,
  type SellerPromotionItem,
  type SellerShippingMethod,
  type SellerStoreProfile,
} from '../../services/dashboardApi';
import { formatRiel, formatShortDate } from '../../utils/currency';
import { exportRowsToCsv } from '../../utils/csv';
import {
  DashboardPageHeader,
  FilterPillTabs,
  KpiGrid,
  SlideOverDrawer,
  StatusPill,
  TablePagination,
} from '../../components/DashboardPrimitives';
import { FigmaIcon } from '../../components/FigmaIcon';
import {
  DashboardKpiSkeleton,
  DashboardTableSkeleton,
} from '../../components/Skeleton';
import { VerifiedBadge } from '../../components/VerifiedBadge';

// ==========================================
// 5. Seller Orders (/seller/orders) — Figma Seller · 07 + Seller · 08 Drawer
// ==========================================
type OrderStatusTab =
  | ''
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export function SellerOrdersPage() {
  const [searchParams] = useSearchParams();
  const { khrRate, showToast } = useStore();

  const [statusFilter, setStatusFilter] = useState<OrderStatusTab>('');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<SellerOrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Order Detail & Fulfillment Drawer (Figma Seller · 08)
  const [selectedOrder, setSelectedOrder] = useState<SellerOrderItem | null>(
    null,
  );
  const [nextStatus, setNextStatus] = useState<
    'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled'
  >('processing');
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const res = await storeOwnerApi.getOrders({ page: 1 });
      setOrders(res.data);
      setSelectedOrder((prev) =>
        prev ? res.data.find((o) => o.id === prev.id) ?? null : null,
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to load orders.',
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void loadOrders();
    });
    return () => {
      active = false;
    };
  }, [loadOrders]);

  const counts = useMemo(
    () => ({
      all: orders.length,
      pending: orders.filter((o) => o.status === 'pending').length,
      processing: orders.filter((o) => o.status === 'processing').length,
      shipped: orders.filter((o) => o.status === 'shipped').length,
      delivered: orders.filter((o) => o.status === 'delivered').length,
      completed: orders.filter((o) => o.status === 'completed').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
    }),
    [orders],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        (o.customer_phone || '').toLowerCase().includes(q)
      );
    });
  }, [orders, statusFilter, search]);

  const perPage = 10;
  const lastPage = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, lastPage);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const openOrderDrawer = (ord: SellerOrderItem) => {
    setSelectedOrder(ord);
    setNextStatus(
      ord.status === 'pending'
        ? 'processing'
        : ord.status === 'processing'
          ? 'shipped'
          : ord.status === 'shipped'
            ? 'delivered'
            : 'completed',
    );
    setCarrier(ord.shipping_carrier || ord.shipping_method_name || '');
    setTracking(ord.tracking_number || '');
    setNotes('');
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setUpdating(true);
    try {
      await storeOwnerApi.updateOrderStatus(selectedOrder.id, {
        status: nextStatus,
        shipping_carrier: carrier.trim() || undefined,
        tracking_number: tracking.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      showToast(
        `Order #${selectedOrder.order_number} updated to ${nextStatus}.`,
      );
      setSelectedOrder(null);
      await loadOrders();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to update order.',
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleExport = () => {
    exportRowsToCsv(
      `kova-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Order #',
        'Customer',
        'Phone',
        'Items',
        'Total USD',
        'Payment Status',
        'Fulfillment',
        'Carrier',
        'Tracking #',
        'Date',
      ],
      filtered.map((o) => [
        o.order_number,
        o.customer_name,
        o.customer_phone || '',
        o.items?.length ?? 0,
        Number(o.total_amount).toFixed(2),
        o.payment_status,
        o.status,
        o.shipping_carrier || '',
        o.tracking_number || '',
        formatShortDate(o.created_at),
      ]),
    );
    showToast('Orders CSV exported.');
  };

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Orders"
        subtitle="Process incoming customer orders, verify payments, and update courier tracking."
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
            label: 'New & pending',
            value: String(counts.pending),
            sub: 'Awaiting seller confirmation',
            badge: counts.pending > 0 ? 'Action needed' : 'Clear',
            tone: counts.pending > 0 ? 'orange' : 'green',
          },
          {
            label: 'Ready / Processing',
            value: String(counts.processing),
            sub: 'Being packed for courier',
            badge: 'Packing',
            tone: 'orange',
          },
          {
            label: 'In transit',
            value: String(counts.shipped),
            sub: 'Dispatched with courier',
            badge: 'On schedule',
            tone: 'green',
          },
          {
            label: 'Delivered / Cancelled',
            value: `${counts.delivered + counts.completed} / ${counts.cancelled}`,
            sub: 'Completed vs cancelled',
            badge: 'History',
            tone: 'neutral',
          },
        ]}
      />

      <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterPillTabs<OrderStatusTab>
            value={statusFilter}
            onChange={(next) => {
              setStatusFilter(next);
              setPage(1);
            }}
            options={[
              { id: '', label: 'All', count: counts.all },
              { id: 'pending', label: 'Pending', count: counts.pending },
              {
                id: 'processing',
                label: 'Processing',
                count: counts.processing,
              },
              { id: 'shipped', label: 'Shipped', count: counts.shipped },
              { id: 'delivered', label: 'Delivered', count: counts.delivered },
              { id: 'completed', label: 'Completed', count: counts.completed },
              { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
            ]}
          />

          <div className="flex items-center gap-2 bg-[#f7f7f7] border border-[#ececec] focus-within:border-[#ff6e20] focus-within:bg-white rounded-full px-3.5 h-[36px] w-full sm:w-[230px]">
            <FigmaIcon name="search" className="w-3.5 h-3.5 text-[#979797]" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search order # or buyer..."
              className="flex-1 bg-transparent text-[12px] text-black placeholder:text-[#979797] outline-none min-w-0"
            />
          </div>
        </div>

        {loading ? (
          <DashboardTableSkeleton rows={6} />
        ) : paged.length === 0 ? (
          <p className="py-14 text-center bg-[#f7f7f7] rounded-[14px] text-[13.5px] text-[#767676]">
            No orders match this filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                  <th className="py-2.5 px-3.5 rounded-l-[10px]">Order #</th>
                  <th className="py-2.5 px-3.5">Customer</th>
                  <th className="py-2.5 px-3.5">Date</th>
                  <th className="py-2.5 px-3.5">Items</th>
                  <th className="py-2.5 px-3.5">Total</th>
                  <th className="py-2.5 px-3.5">Payment</th>
                  <th className="py-2.5 px-3.5">Fulfillment</th>
                  <th className="py-2.5 px-3.5">Delivery</th>
                  <th className="py-2.5 px-3.5 rounded-r-[10px] text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                {paged.map((ord) => (
                  <tr
                    key={ord.id}
                    className="hover:bg-[#fafafa] transition-colors"
                  >
                    <td className="py-3.5 px-3.5 font-semibold text-black whitespace-nowrap">
                      #{ord.order_number}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <p className="font-semibold text-black">
                        {ord.customer_name}
                      </p>
                      <p className="text-[11px] text-[#8a8a8a]">
                        {ord.shipping_address?.province || ord.customer_phone}
                      </p>
                    </td>
                    <td className="py-3.5 px-3.5 text-[#767676] whitespace-nowrap">
                      {formatShortDate(ord.created_at)}
                    </td>
                    <td className="py-3.5 px-3.5 text-[#555555]">
                      {ord.items?.length ?? 0} item
                      {(ord.items?.length ?? 0) === 1 ? '' : 's'}
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
                    <td className="py-3.5 px-3.5 text-[#555555]">
                      {ord.shipping_carrier || ord.shipping_method_name || 'Standard'}
                    </td>
                    <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openOrderDrawer(ord)}
                        className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline"
                      >
                        {ord.status === 'pending'
                          ? 'Review'
                          : ord.status === 'processing'
                            ? 'Ship'
                            : 'Details'}
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
          total={filtered.length}
          perPage={perPage}
          itemLabel="orders"
          onPageChange={setPage}
        />
      </section>

      {/* Rich Order Detail & Fulfillment Drawer (Exact Figma Seller · 08 layout) */}
      <SlideOverDrawer
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Order #${selectedOrder.order_number}` : ''}
        subtitle={
          selectedOrder
            ? `Placed ${formatShortDate(selectedOrder.created_at)} · ${selectedOrder.payment_method || 'KHQR'} · ${selectedOrder.items?.length ?? 0} items`
            : undefined
        }
        widthClass="max-w-[640px]"
        footer={
          <>
            <button
              type="button"
              onClick={() => setSelectedOrder(null)}
              className="bg-white border border-[#ececec] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full"
            >
              Close
            </button>
            <button
              type="submit"
              form="seller-order-fulfillment-form"
              disabled={updating}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
            >
              {updating ? 'Updating...' : 'Update order status'}
            </button>
          </>
        }
      >
        {selectedOrder && (
          <div className="flex flex-col gap-5">
            {/* Workflow strip */}
            <div className="bg-[#ffefe6] border border-[#ffd8c2] rounded-[14px] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span className="font-semibold text-[#ff6e20]">
                Order status: {selectedOrder.status.toUpperCase()}
              </span>
              <StatusPill label={selectedOrder.payment_status} />
            </div>

            {/* Ordered products */}
            <div className="border border-[#ececec] rounded-[16px] p-4 flex flex-col gap-3">
              <h3 className="text-[14px] font-bold text-black">
                Ordered products
              </h3>
              {selectedOrder.items && selectedOrder.items.length > 0 ? (
                <div className="divide-y divide-[#f1f1f1] text-[12.5px]">
                  {selectedOrder.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-black truncate">
                          {it.product_name}
                        </p>
                        <p className="text-[11px] text-[#8a8a8a]">
                          Qty {it.quantity} × ${Number(it.unit_price).toFixed(2)}
                          {it.product_sku ? ` · ${it.product_sku}` : ''}
                        </p>
                      </div>
                      <span className="font-bold text-[#ff6e20] shrink-0">
                        ${Number(it.total).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12.5px] text-[#767676]">
                  No line items loaded.
                </p>
              )}
            </div>

            {/* Payment & Payout Breakdown */}
            <div className="border border-[#ececec] rounded-[16px] p-4 flex flex-col gap-2 text-[12.5px]">
              <h3 className="text-[14px] font-bold text-black pb-1">
                Payment breakdown
              </h3>
              <div className="flex justify-between text-[#555555]">
                <span>Subtotal</span>
                <span className="font-semibold text-black">
                  ${Number(selectedOrder.subtotal_amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-[#555555]">
                <span>Shipping fee</span>
                <span className="font-semibold text-black">
                  ${Number(selectedOrder.shipping_amount).toFixed(2)}
                </span>
              </div>
              {Number(selectedOrder.discount_amount) > 0 && (
                <div className="flex justify-between text-[#e5322d]">
                  <span>Voucher discount</span>
                  <span>
                    -${Number(selectedOrder.discount_amount).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="mt-2 bg-[#e7f6e7] rounded-[12px] px-3.5 py-2.5 flex items-center justify-between">
                <span className="font-semibold text-[#029500]">
                  Customer paid total
                </span>
                <span className="font-bold text-[#029500]">
                  ${Number(selectedOrder.total_amount).toFixed(2)} (
                  {formatRiel(Number(selectedOrder.total_amount), khrRate)})
                </span>
              </div>
            </div>

            {/* Customer & shipping */}
            <div className="border border-[#ececec] rounded-[16px] p-4 flex flex-col gap-1.5 text-[12.5px]">
              <h3 className="text-[14px] font-bold text-black pb-0.5">
                Customer &amp; shipping address
              </h3>
              <p className="font-semibold text-black">
                {selectedOrder.customer_name}
              </p>
              <p className="text-[#767676]">
                {[selectedOrder.customer_phone, selectedOrder.customer_email]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {selectedOrder.shipping_address && (
                <p className="text-[#333333] pt-1">
                  {[
                    selectedOrder.shipping_address.address_line_1,
                    selectedOrder.shipping_address.commune,
                    selectedOrder.shipping_address.district,
                    selectedOrder.shipping_address.province,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
            </div>

            {/* Fulfillment Update Form */}
            <form
              id="seller-order-fulfillment-form"
              onSubmit={handleUpdateOrder}
              className="border border-[#ececec] rounded-[16px] p-4 flex flex-col gap-3.5"
            >
              <h3 className="text-[14px] font-bold text-black">
                Update fulfillment &amp; tracking
              </h3>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-black">
                  Next status
                </span>
                <select
                  value={nextStatus}
                  onChange={(e) =>
                    setNextStatus(
                      e.target.value as
                        | 'processing'
                        | 'shipped'
                        | 'delivered'
                        | 'completed'
                        | 'cancelled',
                    )
                  }
                  className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] bg-white outline-none"
                >
                  <option value="processing">Processing (Confirmed)</option>
                  <option value="shipped">Shipped (Handed to courier)</option>
                  <option value="delivered">Delivered</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-black">
                    Courier / Carrier
                  </span>
                  <input
                    type="text"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    placeholder="J&T Express, Virak Buntham..."
                    className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2 text-[13px] outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-black">
                    Tracking number
                  </span>
                  <input
                    type="text"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    placeholder="e.g. JT-KH-88412"
                    className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2 text-[13px] font-mono outline-none"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-black">
                  Internal fulfillment note
                </span>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional packing or rider note..."
                  className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2 text-[13px] outline-none"
                />
              </label>
            </form>
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
}

// ==========================================
// 6. Shipping & Logistics (/seller/shipping) — Exact Figma Seller · 09
// 4 KPI Cards + Provider Cards Grid + Active Shipments Table + Add Method Drawer
// ==========================================
export function SellerShippingPage() {
  const { showToast } = useStore();
  const [methods, setMethods] = useState<SellerShippingMethod[]>([]);
  const [orders, setOrders] = useState<SellerOrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<SellerShippingMethod | null>(null);
  const [name, setName] = useState('');
  const [calcType, setCalcType] = useState<
    'fixed' | 'weight_based' | 'free' | 'distance_based'
  >('fixed');
  const [baseCost, setBaseCost] = useState('1.50');
  const [freeThreshold, setFreeThreshold] = useState('25');
  const [estDays, setEstDays] = useState('1-2 business days');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [mRes, oRes] = await Promise.all([
        storeOwnerApi.getShippingMethods(),
        storeOwnerApi.getOrders({ page: 1 }),
      ]);
      setMethods(mRes);
      setOrders(oRes.data);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to load shipping.',
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

  const openNewDrawer = () => {
    setEditing(null);
    setName('');
    setCalcType('fixed');
    setBaseCost('1.50');
    setFreeThreshold('25');
    setEstDays('1-2 business days');
    setDrawerOpen(true);
  };

  const openEditDrawer = (m: SellerShippingMethod) => {
    setEditing(m);
    setName(m.name);
    setCalcType(m.calculation_type);
    setBaseCost(String(m.base_cost));
    setFreeThreshold(
      m.free_shipping_threshold ? String(m.free_shipping_threshold) : '',
    );
    setEstDays(m.estimated_delivery_days || '');
    setDrawerOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        calculation_type: calcType,
        base_cost: calcType === 'free' ? 0 : Number(baseCost),
        free_shipping_threshold: freeThreshold ? Number(freeThreshold) : null,
        estimated_delivery_days: estDays.trim() || null,
        is_active: true,
      };
      if (editing) {
        await storeOwnerApi.updateShippingMethod(editing.id, payload);
        showToast('Shipping method updated.');
      } else {
        await storeOwnerApi.createShippingMethod(payload);
        showToast('Shipping method added.');
      }
      setDrawerOpen(false);
      await loadData();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to save shipping.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await storeOwnerApi.deleteShippingMethod(id);
      showToast('Shipping method removed.');
      await loadData();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to delete.');
    }
  };

  const pendingShip = orders.filter(
    (o) => o.status === 'pending' || o.status === 'processing',
  ).length;
  const inTransit = orders.filter((o) => o.status === 'shipped').length;
  const delivered = orders.filter(
    (o) => o.status === 'delivered' || o.status === 'completed',
  ).length;
  const activeShipments = orders.filter(
    (o) => o.status !== 'cancelled',
  ).slice(0, 10);

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Shipping & logistics"
        subtitle="Configure Cambodian courier options, base delivery rates, and monitor active order shipments."
        actions={
          <button
            type="button"
            onClick={openNewDrawer}
            className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors"
          >
            Add shipping method
          </button>
        }
      />

      <KpiGrid
        items={[
          {
            label: 'Active methods',
            value: String(methods.filter((m) => m.is_active).length),
            sub: 'Shown at buyer checkout',
            badge: 'Configured',
            tone: 'green',
          },
          {
            label: 'Pending dispatch',
            value: String(pendingShip),
            sub: 'Orders waiting to ship',
            badge: pendingShip > 0 ? 'Today' : 'Clear',
            tone: pendingShip > 0 ? 'orange' : 'green',
          },
          {
            label: 'In transit',
            value: String(inTransit),
            sub: 'Phnom Penh & provinces',
            badge: 'Live',
            tone: 'green',
          },
          {
            label: 'Delivered',
            value: String(delivered),
            sub: 'Completed deliveries',
            badge: 'Completed',
            tone: 'neutral',
          },
        ]}
      />

      {/* Connected Logistics Providers Grid (Exact Figma Seller · 09 card row) */}
      <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-[15.5px] font-bold text-black">
            Configured delivery methods
          </h2>
          <p className="text-[12px] text-[#8a8a8a] mt-0.5">
            Active Cambodia shipping options available to buyers at checkout
          </p>
        </div>

        {loading ? (
          <DashboardKpiSkeleton count={4} />
        ) : methods.length === 0 ? (
          <div className="py-10 text-center bg-[#f7f7f7] rounded-[14px] flex flex-col items-center gap-3">
            <p className="text-[13.5px] text-[#767676]">
              No shipping methods configured yet.
            </p>
            <button
              type="button"
              onClick={openNewDrawer}
              className="bg-[#ff6e20] text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
            >
              Add your first carrier
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {methods.map((m) => (
              <div
                key={m.id}
                className="border border-[#ececec] rounded-[16px] p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[14px] font-bold text-black">{m.name}</p>
                    <StatusPill
                      label={m.is_active ? 'Active' : 'Paused'}
                      tone={m.is_active ? 'green' : 'neutral'}
                    />
                  </div>
                  <p className="text-[11.5px] text-[#767676] mt-1">
                    {m.estimated_delivery_days || 'Standard delivery'}
                    {m.free_shipping_threshold
                      ? ` · Free over $${Number(m.free_shipping_threshold).toFixed(0)}`
                      : ''}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#f1f1f1]">
                  <span className="text-[12.5px] font-bold text-[#ff6e20]">
                    {m.calculation_type === 'free'
                      ? 'Free delivery'
                      : `From $${Number(m.base_cost).toFixed(2)}`}
                  </span>
                  <div className="flex items-center gap-2.5 text-[12px] font-semibold">
                    <button
                      type="button"
                      onClick={() => openEditDrawer(m)}
                      className="text-black hover:text-[#ff6e20]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(m.id)}
                      className="text-[#e5322d] hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Shipments Table (Exact Figma Seller · 09) */}
      <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15.5px] font-bold text-black">
            Active shipments
          </h2>
          <Link
            to="/seller/orders"
            className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline"
          >
            Manage orders
          </Link>
        </div>

        {activeShipments.length === 0 ? (
          <p className="py-10 text-center bg-[#f7f7f7] rounded-[14px] text-[13px] text-[#767676]">
            No active shipments yet. Dispatched orders will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                  <th className="py-2.5 px-3.5 rounded-l-[10px]">Tracking #</th>
                  <th className="py-2.5 px-3.5">Order #</th>
                  <th className="py-2.5 px-3.5">Recipient</th>
                  <th className="py-2.5 px-3.5">Provider</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5 rounded-r-[10px] text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                {activeShipments.map((ord) => (
                  <tr
                    key={ord.id}
                    className="hover:bg-[#fafafa] transition-colors"
                  >
                    <td className="py-3.5 px-3.5 font-mono text-[12px] font-semibold text-black">
                      {ord.tracking_number || 'Pending label'}
                    </td>
                    <td className="py-3.5 px-3.5 font-medium text-[#555555]">
                      #{ord.order_number}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <p className="font-semibold text-black">
                        {ord.customer_name}
                      </p>
                      <p className="text-[11px] text-[#8a8a8a]">
                        {ord.shipping_address?.province || ord.customer_phone}
                      </p>
                    </td>
                    <td className="py-3.5 px-3.5 text-[#555555]">
                      {ord.shipping_carrier || ord.shipping_method_name || '—'}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <StatusPill label={ord.status} />
                    </td>
                    <td className="py-3.5 px-3.5 text-right">
                      <Link
                        to={`/seller/orders?search=${encodeURIComponent(ord.order_number)}`}
                        className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline"
                      >
                        Update
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SlideOverDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? `Edit shipping · ${editing.name}` : 'Add shipping method'}
        subtitle="Set delivery cost and free-shipping threshold for Cambodia buyers."
        footer={
          <>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="bg-white border border-[#ececec] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="seller-shipping-form"
              disabled={saving}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
            >
              {saving
                ? 'Saving...'
                : editing
                  ? 'Save method'
                  : 'Create method'}
            </button>
          </>
        }
      >
        <form
          id="seller-shipping-form"
          onSubmit={handleSave}
          className="flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Carrier / Method name
            </span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. J&T Express Cambodia"
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Rate calculation
            </span>
            <select
              value={calcType}
              onChange={(e) =>
                setCalcType(
                  e.target.value as
                    | 'fixed'
                    | 'weight_based'
                    | 'free'
                    | 'distance_based',
                )
              }
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] bg-white outline-none"
            >
              <option value="fixed">Fixed rate</option>
              <option value="free">Free delivery</option>
              <option value="weight_based">Weight based</option>
              <option value="distance_based">Distance based</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-black">
                Base cost (USD)
              </span>
              <input
                type="number"
                step="0.01"
                min={0}
                disabled={calcType === 'free'}
                value={calcType === 'free' ? '0' : baseCost}
                onChange={(e) => setBaseCost(e.target.value)}
                className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none disabled:bg-[#f7f7f7]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-black">
                Free over (USD)
              </span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={freeThreshold}
                onChange={(e) => setFreeThreshold(e.target.value)}
                placeholder="Optional"
                className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Estimated delivery time
            </span>
            <input
              type="text"
              value={estDays}
              onChange={(e) => setEstDays(e.target.value)}
              placeholder="e.g. Same-day Phnom Penh · 1-3 days provinces"
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none"
            />
          </label>
        </form>
      </SlideOverDrawer>
    </div>
  );
}

// ==========================================
// 7. Discounts & Promotions (/seller/promotions) — Exact Figma Seller · 15
// 4 KPI Cards + Full-Width Table + Create Discount Drawer
// ==========================================
type PromoFilterTab = 'all' | 'active' | 'percentage' | 'fixed_amount' | 'free_shipping';

export function SellerPromotionsPage() {
  const { showToast, refreshCatalog } = useStore();
  const [promos, setPromos] = useState<SellerPromotionItem[]>([]);
  const [tab, setTab] = useState<PromoFilterTab>('all');
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [discountType, setDiscountType] = useState<
    'percentage' | 'fixed_amount' | 'free_shipping'
  >('percentage');
  const [discountValue, setDiscountValue] = useState('10');
  const [minOrder, setMinOrder] = useState('20');
  const [usageLimit, setUsageLimit] = useState('');
  const [saving, setSaving] = useState(false);

  const loadPromos = useCallback(async () => {
    try {
      const res = await storeOwnerApi.getPromotions();
      setPromos(res.data);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to load promotions.',
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void loadPromos();
    });
    return () => {
      active = false;
    };
  }, [loadPromos]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await storeOwnerApi.createPromotion({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        discount_type: discountType,
        discount_value:
          discountType === 'free_shipping' ? 0 : Number(discountValue),
        min_order_amount: minOrder ? Number(minOrder) : null,
        usage_limit: usageLimit ? Number(usageLimit) : null,
        is_active: true,
      });
      setCode('');
      setName('');
      setUsageLimit('');
      setDrawerOpen(false);
      showToast('Discount voucher created.');
      await Promise.all([loadPromos(), refreshCatalog()]);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to create promotion.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (pr: SellerPromotionItem) => {
    try {
      await storeOwnerApi.updatePromotion(pr.id, { is_active: !pr.is_active });
      showToast(pr.is_active ? 'Voucher paused.' : 'Voucher activated.');
      await Promise.all([loadPromos(), refreshCatalog()]);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to update.');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await storeOwnerApi.deletePromotion(id);
      showToast('Promotion deleted.');
      await Promise.all([loadPromos(), refreshCatalog()]);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to delete.');
    }
  };

  const activeCount = promos.filter((p) => p.is_active).length;
  const totalUses = promos.reduce((s, p) => s + (p.used_count ?? 0), 0);
  const filtered = promos.filter((p) => {
    if (tab === 'active') return p.is_active;
    if (tab === 'percentage' || tab === 'fixed_amount' || tab === 'free_shipping') {
      return p.discount_type === tab;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Discounts & promotions"
        subtitle="Manage store coupon codes, percentage sales, and free-shipping vouchers."
        actions={
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors"
          >
            Create discount
          </button>
        }
      />

      <KpiGrid
        items={[
          {
            label: 'Active promotions',
            value: String(activeCount),
            sub: `${promos.length} total vouchers created`,
            badge: 'Live',
            tone: 'green',
          },
          {
            label: 'Total redemptions',
            value: String(totalUses),
            sub: 'Applied by buyers at checkout',
            badge: 'Claims',
            tone: 'orange',
          },
          {
            label: 'Coupon codes',
            value: String(
              promos.filter((p) => p.discount_type !== 'free_shipping').length,
            ),
            sub: 'Percentage & fixed-amount',
            badge: 'Codes',
            tone: 'neutral',
          },
          {
            label: 'Free shipping promos',
            value: String(
              promos.filter((p) => p.discount_type === 'free_shipping').length,
            ),
            sub: 'Delivery fee waivers',
            badge: 'Logistics',
            tone: 'neutral',
          },
        ]}
      />

      <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
        <FilterPillTabs<PromoFilterTab>
          value={tab}
          onChange={setTab}
          options={[
            { id: 'all', label: 'All', count: promos.length },
            { id: 'active', label: 'Active', count: activeCount },
            {
              id: 'percentage',
              label: 'Percentage',
              count: promos.filter((p) => p.discount_type === 'percentage')
                .length,
            },
            {
              id: 'fixed_amount',
              label: 'Fixed amount',
              count: promos.filter((p) => p.discount_type === 'fixed_amount')
                .length,
            },
            {
              id: 'free_shipping',
              label: 'Free shipping',
              count: promos.filter((p) => p.discount_type === 'free_shipping')
                .length,
            },
          ]}
        />

        {loading ? (
          <DashboardTableSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center bg-[#f7f7f7] rounded-[14px] flex flex-col items-center gap-3">
            <p className="text-[13.5px] text-[#767676]">
              No store vouchers found for this filter.
            </p>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="bg-[#ff6e20] text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
            >
              Create first voucher
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                  <th className="py-2.5 px-3.5 rounded-l-[10px]">
                    Discount &amp; Code
                  </th>
                  <th className="py-2.5 px-3.5">Type</th>
                  <th className="py-2.5 px-3.5">Value</th>
                  <th className="py-2.5 px-3.5">Usage</th>
                  <th className="py-2.5 px-3.5">Min spend</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5 rounded-r-[10px] text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                {filtered.map((pr) => (
                  <tr
                    key={pr.id}
                    className="hover:bg-[#fafafa] transition-colors"
                  >
                    <td className="py-3.5 px-3.5">
                      <p className="font-semibold text-black">{pr.name}</p>
                      <p className="text-[11.5px] font-mono text-[#ff6e20] font-semibold">
                        Code: {pr.code}
                      </p>
                    </td>
                    <td className="py-3.5 px-3.5 capitalize text-[#555555]">
                      {pr.discount_type.replace('_', ' ')}
                    </td>
                    <td className="py-3.5 px-3.5 font-semibold text-black">
                      {pr.discount_type === 'percentage'
                        ? `${pr.discount_value}% off`
                        : pr.discount_type === 'fixed_amount'
                          ? `-$${Number(pr.discount_value).toFixed(2)}`
                          : 'Free shipping'}
                    </td>
                    <td className="py-3.5 px-3.5 text-[#555555]">
                      {pr.used_count ?? 0} / {pr.usage_limit ?? '∞'}
                    </td>
                    <td className="py-3.5 px-3.5 text-[#767676]">
                      {pr.min_order_amount
                        ? `$${Number(pr.min_order_amount).toFixed(2)}`
                        : 'No minimum'}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <StatusPill
                        label={pr.is_active ? 'Active' : 'Paused'}
                        tone={pr.is_active ? 'green' : 'neutral'}
                      />
                    </td>
                    <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(pr)}
                          className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline"
                        >
                          {pr.is_active ? 'Pause' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(pr.id)}
                          className="text-[12.5px] font-semibold text-[#e5322d] hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SlideOverDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Create discount voucher"
        subtitle="Customers can claim and apply this code in their Kova shopping cart."
        footer={
          <>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="bg-white border border-[#ececec] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="seller-promo-form"
              disabled={saving}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
            >
              {saving ? 'Creating...' : 'Create voucher'}
            </button>
          </>
        }
      >
        <form
          id="seller-promo-form"
          onSubmit={handleCreate}
          className="flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Voucher code
            </span>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. KOVA10"
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] font-mono uppercase outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Campaign name
            </span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 10% Weekend Audio Drop"
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Discount type
            </span>
            <select
              value={discountType}
              onChange={(e) =>
                setDiscountType(
                  e.target.value as
                    | 'percentage'
                    | 'fixed_amount'
                    | 'free_shipping',
                )
              }
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] bg-white outline-none"
            >
              <option value="percentage">Percentage off (%)</option>
              <option value="fixed_amount">Fixed amount off (USD)</option>
              <option value="free_shipping">Free shipping</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-black">
                Discount value
              </span>
              <input
                type="number"
                step="0.01"
                min={0}
                disabled={discountType === 'free_shipping'}
                value={discountType === 'free_shipping' ? '0' : discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none disabled:bg-[#f7f7f7]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-black">
                Min spend (USD)
              </span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Total usage limit (optional)
            </span>
            <input
              type="number"
              min={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="Leave empty for unlimited"
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none"
            />
          </label>
        </form>
      </SlideOverDrawer>
    </div>
  );
}

// ==========================================
// 8. Bakong KHQR Settings & Ledger (/seller/bakong) — Figma Seller · 26
// ==========================================
export function SellerBakongPage() {
  const { user, showToast } = useStore();
  const [status, setStatus] = useState<SellerBakongStatus | null>(null);
  const [txStats, setTxStats] = useState<{
    total_volume: number;
    successful_count: number;
    pending_count: number;
    failed_count: number;
  } | null>(null);
  const [txs, setTxs] = useState<BakongTxItem[]>([]);
  const [txFilter, setTxFilter] = useState<'all' | 'successful' | 'pending' | 'expired'>('all');
  const [loading, setLoading] = useState(true);

  const [accountId, setAccountId] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState(user?.email || '');
  const [apiToken, setApiToken] = useState('');
  const [merchantName, setMerchantName] = useState(user?.store?.name || '');
  const [merchantCity, setMerchantCity] = useState('Phnom Penh');
  const [saving, setSaving] = useState(false);

  const loadBakong = useCallback(async () => {
    try {
      const [st, txRes] = await Promise.all([
        storeOwnerApi.getBakongStatus(),
        storeOwnerApi.getBakongTransactions(),
      ]);
      setStatus(st);
      setTxStats(txRes.stats);
      setTxs(txRes.transactions.data);
      if (st.account) {
        setAccountId(st.account.bakong_account_id);
        setRegisteredEmail(st.account.registered_email);
        setMerchantName(st.account.merchant_name);
        setMerchantCity(st.account.merchant_city || 'Phnom Penh');
      }
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to load Bakong config.',
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void loadBakong();
    });
    return () => {
      active = false;
    };
  }, [loadBakong]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await storeOwnerApi.connectBakong({
        bakong_account_id: accountId.trim(),
        registered_email: registeredEmail.trim(),
        api_token: apiToken.trim(),
        merchant_name: merchantName.trim(),
        merchant_city: merchantCity.trim() || 'Phnom Penh',
      });
      setApiToken('');
      showToast(res.message || 'Bakong merchant connected.');
      await loadBakong();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Failed to connect Bakong.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleHealthCheck = async () => {
    try {
      const res = await storeOwnerApi.checkBakongHealth();
      showToast(res.message || 'Bakong connection verified.');
      await loadBakong();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Health check failed.',
      );
    }
  };

  const handleToggle = async () => {
    if (!status) return;
    try {
      await storeOwnerApi.toggleBakong(!status.is_enabled);
      showToast(
        !status.is_enabled ? 'Bakong KHQR enabled.' : 'Bakong KHQR paused.',
      );
      await loadBakong();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Update failed.');
    }
  };

  const handleDisconnect = async () => {
    try {
      await storeOwnerApi.disconnectBakong();
      showToast('Bakong disconnected.');
      await loadBakong();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Disconnect failed.');
    }
  };

  const filteredTxs = txs.filter((t) => {
    if (txFilter === 'all') return true;
    if (txFilter === 'expired') {
      return t.payment_status === 'expired' || t.payment_status === 'failed';
    }
    return t.payment_status === txFilter;
  });

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Bakong KHQR & payment settings"
        subtitle="Connect your NBC Bakong merchant credentials to accept direct KHQR payments across Cambodia."
        actions={
          status && (
            <>
              <StatusPill
                label={status.connection_status}
                tone={status.is_connected ? 'green' : 'orange'}
              />
              {status.is_connected && (
                <button
                  type="button"
                  onClick={() => void handleHealthCheck()}
                  className="bg-white border border-[#ececec] hover:border-[#cccccc] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full"
                >
                  Check health
                </button>
              )}
            </>
          )
        }
      />

      {loading ? (
        <>
          <DashboardKpiSkeleton count={4} />
          <DashboardTableSkeleton rows={4} />
        </>
      ) : (
        <>
          {txStats && (
            <KpiGrid
              items={[
                {
                  label: 'KHQR paid volume',
                  value: `$${txStats.total_volume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  sub: 'Direct Bakong receipts',
                  badge: 'Settled',
                  tone: 'green',
                },
                {
                  label: 'Successful payments',
                  value: String(txStats.successful_count),
                  sub: 'Verified via NBC Bakong',
                  badge: 'Paid',
                  tone: 'green',
                },
                {
                  label: 'Pending scans',
                  value: String(txStats.pending_count),
                  sub: 'Awaiting buyer payment',
                  badge: 'Live',
                  tone: 'orange',
                },
                {
                  label: 'Expired / Failed',
                  value: String(txStats.failed_count),
                  sub: 'Timed-out QR invoices',
                  badge: txStats.failed_count > 0 ? 'Review' : 'Clean',
                  tone: txStats.failed_count > 0 ? 'red' : 'neutral',
                },
              ]}
            />
          )}

          {/* 2:1 Configuration + Connection Status (Exact Figma Seller · 26 proportions) */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] gap-5 items-start">
            <form
              onSubmit={handleConnect}
              className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[15.5px] font-bold text-black">
                    {status?.is_connected
                      ? 'Bakong merchant credentials'
                      : 'Connect Bakong merchant account'}
                  </h2>
                  <p className="text-[12px] text-[#8a8a8a] mt-0.5">
                    Credentials are encrypted at rest on the Kova server.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full transition-colors"
                >
                  {saving ? 'Connecting...' : 'Save configuration'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-black">
                    Bakong Account ID
                  </span>
                  <input
                    type="text"
                    required
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    placeholder="yourstore@aclb"
                    className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] font-mono outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-black">
                    Registered Bakong email
                  </span>
                  <input
                    type="email"
                    required
                    value={registeredEmail}
                    onChange={(e) => setRegisteredEmail(e.target.value)}
                    className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[12px] font-semibold text-black">
                    Bakong Open API JWT token
                  </span>
                  <input
                    type="password"
                    required
                    minLength={10}
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder="Paste NBC Bakong Open API JWT token"
                    className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-black">
                    Merchant display name
                  </span>
                  <input
                    type="text"
                    required
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-black">
                    Merchant city
                  </span>
                  <input
                    type="text"
                    value={merchantCity}
                    onChange={(e) => setMerchantCity(e.target.value)}
                    className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none"
                  />
                </label>
              </div>
            </form>

            <aside className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[15.5px] font-bold text-black">
                  Connection status
                </h2>
                {status && (
                  <StatusPill
                    label={status.is_enabled ? 'Checkout Active' : 'Disabled'}
                    tone={status.is_enabled ? 'green' : 'neutral'}
                  />
                )}
              </div>

              <dl className="flex flex-col divide-y divide-[#f1f1f1] text-[12.5px]">
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[#767676]">Bakong ID</dt>
                  <dd className="font-mono font-semibold text-black">
                    {status?.account?.bakong_account_id || 'Not connected'}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[#767676]">Merchant</dt>
                  <dd className="font-semibold text-black">
                    {status?.account?.merchant_name || '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[#767676]">Last checked</dt>
                  <dd className="text-[#555555]">
                    {status?.account?.last_checked_at
                      ? formatShortDate(status.account.last_checked_at)
                      : '—'}
                  </dd>
                </div>
              </dl>

              {status?.is_connected && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-[#f1f1f1]">
                  <button
                    type="button"
                    onClick={() => void handleToggle()}
                    className="bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[12px] font-semibold text-black px-3.5 py-2 rounded-full transition-colors"
                  >
                    {status.is_enabled ? 'Pause KHQR' : 'Enable KHQR'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDisconnect()}
                    className="bg-[#fdecec] hover:bg-[#fad8d8] text-[12px] font-semibold text-[#e5322d] px-3.5 py-2 rounded-full transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </aside>
          </div>

          {/* Full-width Store KHQR Transactions Ledger */}
          <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[15.5px] font-bold text-black">
                Store KHQR transactions
              </h2>
              <FilterPillTabs<'all' | 'successful' | 'pending' | 'expired'>
                value={txFilter}
                onChange={setTxFilter}
                options={[
                  { id: 'all', label: 'All', count: txs.length },
                  {
                    id: 'successful',
                    label: 'Successful',
                    count: txs.filter((t) => t.payment_status === 'successful')
                      .length,
                  },
                  {
                    id: 'pending',
                    label: 'Pending',
                    count: txs.filter((t) => t.payment_status === 'pending')
                      .length,
                  },
                  {
                    id: 'expired',
                    label: 'Expired / Failed',
                    count: txs.filter(
                      (t) =>
                        t.payment_status === 'expired' ||
                        t.payment_status === 'failed',
                    ).length,
                  },
                ]}
              />
            </div>

            {filteredTxs.length === 0 ? (
              <p className="py-10 text-center bg-[#f7f7f7] rounded-[14px] text-[13px] text-[#767676]">
                No KHQR transactions found for this filter.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                      <th className="py-2.5 px-3.5 rounded-l-[10px]">Bill #</th>
                      <th className="py-2.5 px-3.5">Order #</th>
                      <th className="py-2.5 px-3.5">Amount</th>
                      <th className="py-2.5 px-3.5">Status</th>
                      <th className="py-2.5 px-3.5 rounded-r-[10px]">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                    {filteredTxs.map((t) => (
                      <tr
                        key={t.id}
                        className="hover:bg-[#fafafa] transition-colors"
                      >
                        <td className="py-3.5 px-3.5 font-mono text-[12px] font-semibold text-black">
                          {t.bill_number}
                        </td>
                        <td className="py-3.5 px-3.5 text-[#555555]">
                          {t.child_order?.order_number
                            ? `#${t.child_order.order_number}`
                            : '—'}
                        </td>
                        <td className="py-3.5 px-3.5 font-bold text-[#ff6e20]">
                          {t.currency} {Number(t.amount).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-3.5">
                          <StatusPill label={t.payment_status} />
                        </td>
                        <td className="py-3.5 px-3.5 text-[#767676] whitespace-nowrap">
                          {formatShortDate(t.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ==========================================
// 9. Finance & Payouts (/seller/payouts) — Exact Figma Seller · 20
// ==========================================
export function SellerPayoutsPage() {
  const { khrRate, showToast } = useStore();
  const [dash, setDash] = useState<SellerDashboardData | null>(null);
  const [bakong, setBakong] = useState<SellerBakongStatus | null>(null);
  const [payouts, setPayouts] = useState<SellerPayoutItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'bakong' | 'bank_transfer'>('bakong');
  const [submitting, setSubmitting] = useState(false);

  const loadPayouts = useCallback(async () => {
    try {
      const [d, p, b] = await Promise.allSettled([
        storeOwnerApi.getDashboard(),
        storeOwnerApi.getPayouts(),
        storeOwnerApi.getBakongStatus(),
      ]);
      if (d.status === 'fulfilled') setDash(d.value);
      if (p.status === 'fulfilled') setPayouts(p.value.data);
      if (b.status === 'fulfilled') setBakong(b.value);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to load payouts.',
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void loadPayouts();
    });
    return () => {
      active = false;
    };
  }, [loadPayouts]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await storeOwnerApi.requestPayout({
        amount: Number(amount),
        payout_method: method,
      });
      setAmount('');
      setDrawerOpen(false);
      showToast(res.message || 'Payout request submitted.');
      await loadPayouts();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to request payout.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const avail = dash?.financials.available_balance ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Payouts & bank accounts"
        subtitle="Track net earnings settlements to your Cambodian bank or Bakong account and request withdrawals."
        actions={
          <>
            <Link
              to="/seller/bakong"
              className="bg-white border border-[#ececec] hover:border-[#cccccc] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full transition-colors"
            >
              Configure Bakong
            </Link>
            <button
              type="button"
              onClick={() => {
                setAmount(avail >= 10 ? avail.toFixed(2) : '10.00');
                setDrawerOpen(true);
              }}
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors"
            >
              Withdraw ${avail.toFixed(2)}
            </button>
          </>
        }
      />

      {loading || !dash ? (
        <>
          <DashboardKpiSkeleton count={4} />
          <DashboardTableSkeleton rows={4} />
        </>
      ) : (
        <>
          <KpiGrid
            items={[
              {
                label: 'Available balance',
                value: `$${dash.financials.available_balance.toFixed(2)}`,
                sub: formatRiel(dash.financials.available_balance, khrRate),
                badge: 'Ready',
                tone: 'green',
              },
              {
                label: 'Net earnings',
                value: `$${dash.financials.net_earnings.toFixed(2)}`,
                sub: `After $${dash.financials.platform_commission.toFixed(2)} platform fees`,
                badge: 'Lifetime',
                tone: 'neutral',
              },
              {
                label: 'Pending payouts',
                value: `$${dash.financials.pending_payouts.toFixed(2)}`,
                sub: 'Processing settlement',
                badge:
                  dash.financials.pending_payouts > 0 ? 'In progress' : 'None',
                tone:
                  dash.financials.pending_payouts > 0 ? 'orange' : 'neutral',
              },
              {
                label: 'Paid payouts',
                value: `$${dash.financials.paid_payouts.toFixed(2)}`,
                sub: 'Transferred to your account',
                badge: 'Settled',
                tone: 'green',
              },
            ]}
          />

          {/* Exact Figma Seller · 20 2:1 Layout (Payout History | Linked Payout Accounts) */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] gap-5 items-start">
            <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
              <div>
                <h2 className="text-[15.5px] font-bold text-black">
                  Payout history
                </h2>
                <p className="text-[12px] text-[#8a8a8a] mt-0.5">
                  On-demand withdrawals &amp; marketplace settlements
                </p>
              </div>

              {payouts.length === 0 ? (
                <p className="py-12 text-center bg-[#f7f7f7] rounded-[14px] text-[13px] text-[#767676]">
                  No payout requests submitted yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                        <th className="py-2.5 px-3.5 rounded-l-[10px]">
                          Payout ID
                        </th>
                        <th className="py-2.5 px-3.5">Destination</th>
                        <th className="py-2.5 px-3.5">Amount</th>
                        <th className="py-2.5 px-3.5">Status</th>
                        <th className="py-2.5 px-3.5 rounded-r-[10px]">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                      {payouts.map((po) => (
                        <tr
                          key={po.id}
                          className="hover:bg-[#fafafa] transition-colors"
                        >
                          <td className="py-3.5 px-3.5 font-mono text-[12px] font-semibold text-black">
                            {po.payout_reference}
                          </td>
                          <td className="py-3.5 px-3.5 capitalize text-[#555555]">
                            {po.payment_method.replace('_', ' ')}
                          </td>
                          <td className="py-3.5 px-3.5">
                            <p
                              className={`font-bold ${
                                po.status === 'paid'
                                  ? 'text-[#029500]'
                                  : 'text-[#ff6e20]'
                              }`}
                            >
                              ${Number(po.amount).toFixed(2)}
                            </p>
                            <p className="text-[11px] text-[#8a8a8a]">
                              {formatRiel(Number(po.amount), khrRate)}
                            </p>
                          </td>
                          <td className="py-3.5 px-3.5">
                            <StatusPill label={po.status} />
                          </td>
                          <td className="py-3.5 px-3.5 text-[#767676] whitespace-nowrap">
                            {formatShortDate(po.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Right Linked Payout Accounts Card (Exact Figma Seller · 20) */}
            <aside className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-3.5">
              <div>
                <h2 className="text-[15.5px] font-bold text-black">
                  Linked payout accounts
                </h2>
                <p className="text-[12px] text-[#8a8a8a] mt-0.5">
                  Instant Bakong &amp; Cambodian bank transfers
                </p>
              </div>

              <div
                className={`rounded-[14px] p-4 border flex items-start justify-between gap-2 ${
                  bakong?.is_connected
                    ? 'border-[#ff6e20]/70 bg-[#fff9f5]'
                    : 'border-[#ececec] bg-[#fafafa]'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-black">
                    Bakong Wallet KHQR
                  </p>
                  <p className="text-[11.5px] font-mono text-[#767676] truncate mt-0.5">
                    {bakong?.account?.bakong_account_id || 'Not connected yet'}
                  </p>
                </div>
                <StatusPill
                  label={bakong?.is_connected ? 'Primary' : 'Setup'}
                  tone={bakong?.is_connected ? 'orange' : 'neutral'}
                />
              </div>

              <div className="rounded-[14px] p-4 border border-[#ececec] bg-[#fafafa] flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13.5px] font-bold text-black">
                    Cambodia Bank Transfer
                  </p>
                  <p className="text-[11.5px] text-[#767676] mt-0.5">
                    ABA / ACLEDA / Wing USD settlement
                  </p>
                </div>
                <StatusPill label="Available" tone="green" />
              </div>
            </aside>
          </div>
        </>
      )}

      <SlideOverDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Request payout withdrawal"
        subtitle={`Available balance: $${avail.toFixed(2)} (min $10.00)`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="bg-white border border-[#ececec] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="seller-payout-form"
              disabled={submitting}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
            >
              {submitting ? 'Submitting...' : 'Submit withdrawal'}
            </button>
          </>
        }
      >
        <form
          id="seller-payout-form"
          onSubmit={handleRequest}
          className="flex flex-col gap-4"
        >
          <div className="bg-[#f7f7f7] rounded-[14px] p-4 flex items-center justify-between">
            <span className="text-[12.5px] text-[#767676]">
              Withdrawable balance
            </span>
            <span className="text-[18px] font-bold text-[#029500]">
              ${avail.toFixed(2)}
            </span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Withdrawal amount (USD, min $10)
            </span>
            <input
              type="number"
              required
              min={10}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10.00"
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Payout destination
            </span>
            <select
              value={method}
              onChange={(e) =>
                setMethod(e.target.value as 'bakong' | 'bank_transfer')
              }
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] bg-white outline-none"
            >
              <option value="bakong">Bakong Account</option>
              <option value="bank_transfer">Cambodia Bank Transfer</option>
            </select>
          </label>
        </form>
      </SlideOverDrawer>
    </div>
  );
}

// ==========================================
// 10. Storefront Profile & Branding (/seller/storefront) — Exact Figma Seller · 11
// ==========================================
export function SellerStorefrontPage() {
  const { showToast, refreshUser, refreshCatalog } = useStore();
  const [profile, setProfile] = useState<SellerStoreProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [announcements, setAnnouncements] = useState('');
  const [policies, setPolicies] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const p = await storeOwnerApi.getProfile();
      setProfile(p);
      setName(p.name || '');
      setPhone(p.phone || '');
      setEmail(p.email || '');
      setAddress(p.address || '');
      setDescription(p.description || '');
      setAnnouncements(p.announcements || '');
      setPolicies(p.policies || '');
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to load store profile.',
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void loadProfile();
    });
    return () => {
      active = false;
    };
  }, [loadProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await storeOwnerApi.updateProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        description: description.trim() || null,
        announcements: announcements.trim() || null,
        policies: policies.trim() || null,
      });
      await Promise.all([loadProfile(), refreshUser(), refreshCatalog()]);
      showToast('Storefront profile updated.');
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to save storefront.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleBrandingUpload = async (
    kind: 'logo' | 'banner',
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await storeOwnerApi.updateBranding({ [kind]: file });
      await Promise.all([loadProfile(), refreshUser(), refreshCatalog()]);
      showToast('Image uploaded successfully.');
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : `Failed to upload ${kind}.`,
      );
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (loading || !profile) {
    return <DashboardTableSkeleton rows={6} />;
  }

  return (
    <form onSubmit={handleSaveProfile} className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Storefront profile"
        subtitle="Manage your public store identity, logo, cover banner, contact info, and buyer policies."
        actions={
          <>
            <Link
              to={`/store/${profile.slug}`}
              className="bg-white border border-[#ececec] hover:border-[#cccccc] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full transition-colors"
            >
              Preview live store
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full transition-colors"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </>
        }
      />

      {/* Exact Figma Seller · 11 2:1 Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] gap-5 items-start">
        <div className="flex flex-col gap-4">
          <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
            <h2 className="text-[15.5px] font-bold text-black">
              Store identity &amp; URL
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-black">
                  Store name
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-black">
                  Store URL
                </span>
                <div className="border border-[#ececec] bg-[#f7f7f7] rounded-[12px] px-3.5 py-2.5 text-[13px] text-[#767676] truncate">
                  kova.com.kh/store/{profile.slug}
                </div>
              </div>

              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12px] font-semibold text-black">
                  Store description
                </span>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell buyers what you specialize in and your warranty promise..."
                  className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] p-3.5 text-[13.5px] outline-none"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-black">
                  Support phone
                </span>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-black">
                  Support email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
                />
              </label>

              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12px] font-semibold text-black">
                  Store pickup address
                </span>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, Sangkat, Khan, Phnom Penh"
                  className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
                />
              </label>
            </div>
          </section>

          <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-[15.5px] font-bold text-black">
                Store announcements &amp; policies
              </h2>
              <p className="text-[12px] text-[#8a8a8a] mt-0.5">
                Displayed on your public storefront and product pages
              </p>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-black">
                Storefront announcement banner
              </span>
              <input
                type="text"
                value={announcements}
                onChange={(e) => setAnnouncements(e.target.value)}
                placeholder="e.g. Same-day delivery inside Phnom Penh for orders before 2:00 PM"
                className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-black">
                Return &amp; warranty policy
              </span>
              <textarea
                rows={3}
                value={policies}
                onChange={(e) => setPolicies(e.target.value)}
                placeholder="7-day hassle-free returns for unopened items. 12-month warranty..."
                className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] p-3.5 text-[13.5px] outline-none"
              />
            </label>
          </section>
        </div>

        {/* Right Logo & Banner + Status Cards (Exact Figma Seller · 11) */}
        <div className="flex flex-col gap-4">
          <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
            <h2 className="text-[15.5px] font-bold text-black">
              Logo &amp; banner
            </h2>

            <div className="flex flex-col gap-2">
              {profile.banner ? (
                <img
                  src={profile.banner}
                  alt="Store cover banner"
                  className="w-full h-[128px] rounded-[14px] object-cover border border-[#ececec]"
                />
              ) : (
                <div className="w-full h-[128px] rounded-[14px] bg-[#f7f7f7] border border-dashed border-[#dcdcdc] flex flex-col items-center justify-center gap-1 text-[#8a8a8a]">
                  <FigmaIcon name="upload" className="w-5 h-5 text-[#979797]" />
                  <span className="text-[12px] font-medium">
                    No cover banner uploaded
                  </span>
                </div>
              )}
              <label className="inline-flex items-center justify-center bg-white border border-[#ececec] hover:border-[#ff6e20] text-[12px] font-semibold text-black px-4 py-2 rounded-full cursor-pointer transition-colors w-full">
                {uploading ? 'Uploading...' : 'Upload cover banner'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploading}
                  onChange={(e) => void handleBrandingUpload('banner', e)}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex items-center gap-3.5 pt-2 border-t border-[#f1f1f1]">
              {profile.logo ? (
                <img
                  src={profile.logo}
                  alt={profile.name}
                  className="w-14 h-14 rounded-[14px] object-cover border border-[#ececec] shrink-0"
                />
              ) : (
                <span className="w-14 h-14 rounded-[14px] bg-[#ff6e20] text-white text-[16px] font-bold flex items-center justify-center shrink-0">
                  {profile.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="flex flex-col gap-1.5 min-w-0">
                <p className="text-[12.5px] font-bold text-black">
                  Store logo (512×512)
                </p>
                <label className="inline-flex items-center justify-center bg-white border border-[#ececec] hover:border-[#ff6e20] text-[12px] font-semibold text-black px-3.5 py-1.5 rounded-full cursor-pointer transition-colors w-fit">
                  {uploading ? 'Uploading...' : 'Upload new logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploading}
                    onChange={(e) => void handleBrandingUpload('logo', e)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-3">
            <h2 className="text-[15.5px] font-bold text-black">
              Store verification &amp; status
            </h2>
            <dl className="flex flex-col divide-y divide-[#f1f1f1] text-[12.5px]">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#767676]">Store status</dt>
                <dd className="font-semibold text-[#029500] inline-flex items-center gap-1 capitalize">
                  <span>
                    {profile.is_verified ? 'Live & Verified' : profile.status}
                  </span>
                  {profile.is_verified && <VerifiedBadge size="xs" />}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#767676]">Commission rate</dt>
                <dd className="font-semibold text-black">
                  {profile.commission_rate !== null &&
                  profile.commission_rate !== undefined
                    ? `${profile.commission_rate}%`
                    : 'Platform default'}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#767676]">Bakong KHQR</dt>
                <dd>
                  <StatusPill
                    label={
                      profile.bakong_account?.connection_status ||
                      'Not configured'
                    }
                  />
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </form>
  );
}
