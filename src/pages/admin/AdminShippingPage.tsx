import { useCallback, useEffect, useState } from 'react';
import {
  DashboardPageHeader,
  KpiGrid,
  SlideOverDrawer,
  StatusPill,
} from '../../components/DashboardPrimitives';
import { DashboardKpiSkeleton } from '../../components/Skeleton';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { useStore } from '../../context/StoreContext';
import { useConfirmDelete } from '../../context/ConfirmDeleteContext';
import { ApiError } from '../../services/api';
import {
  adminApi,
  type AdminShipmentItem,
  type AdminShippingMethod,
  type AdminShippingStats,
} from '../../services/dashboardApi';

const SHIPMENT_FILTERS = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'In transit' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'completed', label: 'Completed' },
] as const;

export function AdminShippingPage() {
  const { showToast } = useStore();
  const { confirmDelete } = useConfirmDelete();
  const [methods, setMethods] = useState<AdminShippingMethod[]>([]);
  const [shipments, setShipments] = useState<AdminShipmentItem[]>([]);
  const [stats, setStats] = useState<AdminShippingStats>({
    active_methods: 0,
    total_methods: 0,
    pending_dispatch: 0,
    in_transit: 0,
    delivered: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Method drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AdminShippingMethod | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [calcType, setCalcType] = useState<
    'fixed' | 'weight_based' | 'free' | 'distance_based'
  >('fixed');
  const [baseCost, setBaseCost] = useState('1.50');
  const [freeThreshold, setFreeThreshold] = useState('25');
  const [estDays, setEstDays] = useState('1-2 business days');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Shipment drawer state
  const [selectedShipment, setSelectedShipment] =
    useState<AdminShipmentItem | null>(null);
  const [shipStatus, setShipStatus] = useState<
    'processing' | 'shipped' | 'delivered' | 'completed'
  >('shipped');
  const [shipCarrier, setShipCarrier] = useState('');
  const [shipTracking, setShipTracking] = useState('');
  const [shipNotes, setShipNotes] = useState('');
  const [savingShipment, setSavingShipment] = useState(false);

  const loadData = useCallback(
    async (opts?: { status?: string; search?: string }) => {
      try {
        const res = await adminApi.getShipping({
          status: (opts?.status ?? statusFilter) || undefined,
          search: (opts?.search ?? search).trim() || undefined,
        });
        setMethods(res.methods);
        setShipments(res.shipments);
        setStats(res.stats);
      } catch (err) {
        showToast(
          err instanceof ApiError
            ? err.message
            : 'Unable to load shipping & logistics.',
        );
      } finally {
        setLoading(false);
      }
    },
    [showToast, statusFilter, search],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadData();
    }, 150);
    return () => window.clearTimeout(t);
  }, [loadData]);

  const openNewDrawer = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setCalcType('fixed');
    setBaseCost('1.50');
    setFreeThreshold('25');
    setEstDays('1-2 business days');
    setIsActive(true);
    setDrawerOpen(true);
  };

  const openEditDrawer = (m: AdminShippingMethod) => {
    setEditing(m);
    setName(m.name);
    setDescription(m.description || '');
    setCalcType(m.calculation_type);
    setBaseCost(String(m.base_cost));
    setFreeThreshold(
      m.free_shipping_threshold ? String(m.free_shipping_threshold) : '',
    );
    setEstDays(m.estimated_delivery_days || '');
    setIsActive(Boolean(m.is_active));
    setDrawerOpen(true);
  };

  const handleSaveMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        calculation_type: calcType,
        base_cost: calcType === 'free' ? 0 : Number(baseCost),
        free_shipping_threshold:
          calcType === 'free'
            ? null
            : freeThreshold
              ? Number(freeThreshold)
              : null,
        estimated_delivery_days: estDays.trim() || null,
        is_active: isActive,
      };
      if (editing) {
        await adminApi.updateShippingMethod(editing.id, payload);
        showToast('Shipping method updated.');
      } else {
        await adminApi.createShippingMethod(payload);
        showToast('Shipping method added.');
      }
      setDrawerOpen(false);
      await loadData();
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to save shipping method.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (m: AdminShippingMethod) => {
    try {
      await adminApi.updateShippingMethod(m.id, { is_active: !m.is_active });
      showToast(
        !m.is_active
          ? `${m.name} activated for checkout.`
          : `${m.name} paused.`,
      );
      await loadData();
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to update shipping method.',
      );
    }
  };

  const handleDeleteMethod = (id: number) => {
    const target = methods.find((m) => m.id === id);
    const label = target?.name || 'shipping method';
    confirmDelete({
      title: 'Delete shipping method?',
      description: `"${label}" will be removed from platform shipping options.`,
      itemLabel: label,
      onOptimisticRemove: () => {
        setMethods((prev) => prev.filter((m) => m.id !== id));
      },
      onUndo: () => {
        void loadData();
      },
      onCommit: async () => {
        await adminApi.deleteShippingMethod(id);
        showToast('Shipping method removed.');
        await loadData();
      },
    });
  };

  const openShipmentDrawer = (ord: AdminShipmentItem) => {
    setSelectedShipment(ord);
    setShipStatus(
      ord.status === 'completed'
        ? 'completed'
        : ord.status === 'delivered'
          ? 'completed'
          : ord.status === 'shipped'
            ? 'delivered'
            : 'shipped',
    );
    setShipCarrier(ord.shipping_carrier || ord.shipping_method_name || '');
    setShipTracking(ord.tracking_number || '');
    setShipNotes('');
  };

  const handleSaveShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment) return;
    setSavingShipment(true);
    try {
      await adminApi.updateShipment(selectedShipment.id, {
        status: shipStatus,
        shipping_carrier: shipCarrier.trim() || undefined,
        tracking_number: shipTracking.trim() || undefined,
        notes: shipNotes.trim() || undefined,
      });
      showToast(
        `Shipment #${selectedShipment.order_number} updated to ${shipStatus}.`,
      );
      setSelectedShipment(null);
      await loadData();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to update shipment.',
      );
    } finally {
      setSavingShipment(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Shipping & logistics"
        subtitle="Manage platform-wide Cambodian courier options, delivery rates, and monitor active shipments across all stores."
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
            value: String(stats.active_methods),
            sub: 'Shown at buyer checkout',
            badge: 'Configured',
            tone: 'green',
          },
          {
            label: 'Pending dispatch',
            value: String(stats.pending_dispatch),
            sub: 'Orders waiting to ship',
            badge: stats.pending_dispatch > 0 ? 'Queue' : 'Clear',
            tone: stats.pending_dispatch > 0 ? 'orange' : 'green',
          },
          {
            label: 'In transit',
            value: String(stats.in_transit),
            sub: 'Phnom Penh & provinces',
            tone: 'green',
          },
          {
            label: 'Delivered',
            value: String(stats.delivered),
            sub: 'Completed deliveries',
            badge: 'Completed',
            tone: 'neutral',
          },
        ]}
      />

      {/* Platform-wide Logistics Carriers */}
      <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-[15.5px] font-bold text-black">
            Configured delivery methods
          </h2>
          <p className="text-[12px] text-[#8a8a8a] mt-0.5">
            Global Cambodia shipping options managed by Root Admin and available
            to buyers across all Kova stores at checkout
          </p>
        </div>

        {loading ? (
          <DashboardKpiSkeleton count={4} />
        ) : methods.length === 0 ? (
          <div className="py-10 text-center bg-[#f7f7f7] rounded-[14px] flex flex-col items-center gap-3">
            <p className="text-[13.5px] text-[#767676]">
              No platform shipping methods configured yet.
            </p>
            <button
              type="button"
              onClick={openNewDrawer}
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-5 py-2 rounded-full transition-colors"
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
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(m)}
                      title="Toggle active status"
                    >
                      <StatusPill
                        label={m.is_active ? 'Active' : 'Paused'}
                        tone={m.is_active ? 'green' : 'neutral'}
                      />
                    </button>
                  </div>
                  {m.description && (
                    <p className="text-[11.5px] text-[#767676] mt-1 line-clamp-2">
                      {m.description}
                    </p>
                  )}
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
                      onClick={() => void handleDeleteMethod(m.id)}
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

      {/* Active Shipments across all stores */}
      <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15.5px] font-bold text-black">
              Active shipments
            </h2>
            <p className="text-[12px] text-[#8a8a8a] mt-0.5">
              Live fulfillment and courier tracking across all verified stores
            </p>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search #order, tracking, store, buyer..."
            className="bg-[#f7f7f7] focus:bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 py-2 text-[12.5px] text-black outline-none w-full sm:w-[270px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {SHIPMENT_FILTERS.map((f) => {
            const active = statusFilter === f.id;
            return (
              <button
                key={f.id || 'all'}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                  active
                    ? 'bg-[#ff6e20] text-white'
                    : 'bg-[#f7f7f7] text-[#555555] hover:bg-[#ffefe6] hover:text-[#ff6e20]'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {shipments.length === 0 ? (
          <p className="py-10 text-center bg-[#f7f7f7] rounded-[14px] text-[13px] text-[#767676]">
            No matching shipments found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                  <th className="py-2.5 px-3.5 rounded-l-[10px]">Tracking #</th>
                  <th className="py-2.5 px-3.5">Order #</th>
                  <th className="py-2.5 px-3.5">Store</th>
                  <th className="py-2.5 px-3.5">Recipient</th>
                  <th className="py-2.5 px-3.5">Provider</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5 rounded-r-[10px] text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                {shipments.map((ord) => (
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
                      <span className="inline-flex items-center gap-1 font-medium text-black">
                        <span>{ord.store?.name || 'Kova Store'}</span>
                        {ord.store?.is_verified && <VerifiedBadge size="xs" />}
                      </span>
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
                      <button
                        type="button"
                        onClick={() => openShipmentDrawer(ord)}
                        className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline"
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add / Edit Global Shipping Method Drawer */}
      <SlideOverDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          editing ? `Edit shipping · ${editing.name}` : 'Add shipping method'
        }
        subtitle="Configure platform-wide delivery options shown to buyers at checkout."
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
              form="admin-shipping-form"
              disabled={saving}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
            >
              {saving ? 'Saving...' : editing ? 'Save method' : 'Create method'}
            </button>
          </>
        }
      >
        <form
          id="admin-shipping-form"
          onSubmit={handleSaveMethod}
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
              className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13.5px] outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Description (optional)
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Doorstep delivery across Phnom Penh & 25 provinces"
              className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] outline-none"
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
              className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] bg-white outline-none"
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
                className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] outline-none disabled:bg-[#f7f7f7]"
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
                disabled={calcType === 'free'}
                value={calcType === 'free' ? '' : freeThreshold}
                onChange={(e) => setFreeThreshold(e.target.value)}
                placeholder={calcType === 'free' ? 'Always free' : 'Optional'}
                className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] outline-none disabled:bg-[#f7f7f7]"
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
              className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] outline-none"
            />
          </label>

          <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-[#ff6e20]"
            />
            <span className="text-[13px] font-medium text-black">
              Active (visible at buyer checkout)
            </span>
          </label>
        </form>
      </SlideOverDrawer>

      {/* Update Active Shipment Drawer */}
      <SlideOverDrawer
        open={Boolean(selectedShipment)}
        onClose={() => setSelectedShipment(null)}
        title={
          selectedShipment
            ? `Shipment · #${selectedShipment.order_number}`
            : 'Update shipment'
        }
        subtitle={
          selectedShipment
            ? `${selectedShipment.store?.name || 'Store'} → ${selectedShipment.customer_name}`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setSelectedShipment(null)}
              className="bg-white border border-[#ececec] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="admin-shipment-update-form"
              disabled={savingShipment}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
            >
              {savingShipment ? 'Updating...' : 'Save shipment'}
            </button>
          </>
        }
      >
        <form
          id="admin-shipment-update-form"
          onSubmit={handleSaveShipment}
          className="flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Delivery status
            </span>
            <select
              value={shipStatus}
              onChange={(e) =>
                setShipStatus(
                  e.target.value as
                    | 'processing'
                    | 'shipped'
                    | 'delivered'
                    | 'completed',
                )
              }
              className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] bg-white outline-none"
            >
              <option value="processing">Processing</option>
              <option value="shipped">Shipped (In transit)</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Courier / Provider
            </span>
            <input
              type="text"
              value={shipCarrier}
              onChange={(e) => setShipCarrier(e.target.value)}
              placeholder="e.g. J&T Express Cambodia"
              className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Tracking number
            </span>
            <input
              type="text"
              value={shipTracking}
              onChange={(e) => setShipTracking(e.target.value)}
              placeholder="e.g. JT-KH-20260001"
              className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] font-mono outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Notes (optional)
            </span>
            <textarea
              rows={3}
              value={shipNotes}
              onChange={(e) => setShipNotes(e.target.value)}
              placeholder="Dispatch or delivery note..."
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none resize-none"
            />
          </label>
        </form>
      </SlideOverDrawer>
    </div>
  );
}
