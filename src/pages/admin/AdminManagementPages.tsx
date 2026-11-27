import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Image } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useConfirmDelete } from '../../context/ConfirmDeleteContext';
import { ApiError } from '../../services/api';
import {
  adminApi,
  type AdminBakongAccount,
  type AdminBakongOverview,
  type AdminCategoryItem,
  type AdminDisputeItem,
  type AdminUserItem,
  type AuditLogItem,
  type BakongTxItem,
  type PlatformSettingItem,
} from '../../services/dashboardApi';
import { formatShortDate } from '../../utils/currency';
import { exportRowsToCsv } from '../../utils/csv';
import {
  DashboardPageHeader,
  FilterPillTabs,
  KpiGrid,
  SlideOverDrawer,
  StatusPill,
  TablePagination,
  type KpiCardItem,
} from '../../components/DashboardPrimitives';
import { FigmaIcon } from '../../components/FigmaIcon';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { PasswordInput } from '../../components/PasswordInput';
import {
  DashboardKpiSkeleton,
  DashboardTableSkeleton,
} from '../../components/Skeleton';

// ==========================================
// 3. Users & Roles (/admin/users) — Figma Admin · 04
// ==========================================
type UserFilterTab = 'all' | 'customer' | 'store_owner' | 'admin' | 'suspended';

export function AdminUsersPage() {
  const [searchParams] = useSearchParams();
  const { showToast } = useStore();

  const [tab, setTab] = useState<UserFilterTab>('all');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  // User Detail & Role Drawer
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);
  const [draftRoles, setDraftRoles] = useState<string[]>([]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await adminApi.getUsers({ page: 1 });
      setUsers(res.data);
      setSelectedUser((prev) =>
        prev ? (res.data.find((u) => u.id === prev.id) ?? null) : null,
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to load users.',
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void loadUsers();
    });
    return () => {
      active = false;
    };
  }, [loadUsers]);

  const counts = useMemo(
    () => ({
      all: users.length,
      customer: users.filter((u) => u.roles.some((r) => r.slug === 'customer'))
        .length,
      store_owner: users.filter((u) =>
        u.roles.some((r) => r.slug === 'store_owner'),
      ).length,
      admin: users.filter((u) => u.roles.some((r) => r.slug === 'admin'))
        .length,
      suspended: users.filter((u) => u.status === 'suspended').length,
    }),
    [users],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (tab === 'suspended' && u.status !== 'suspended') return false;
      if (
        (tab === 'customer' || tab === 'store_owner' || tab === 'admin') &&
        !u.roles.some((r) => r.slug === tab)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q)
      );
    });
  }, [users, tab, search]);

  const perPage = 10;
  const lastPage = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, lastPage);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const openDrawer = (u: AdminUserItem) => {
    setSelectedUser(u);
    setDraftRoles(u.roles.map((r) => r.slug));
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;
    if (draftRoles.length === 0) {
      showToast('A user must keep at least one role.');
      return;
    }
    setBusyId(selectedUser.id);
    try {
      const res = await adminApi.updateUserRoles(selectedUser.id, draftRoles);
      showToast(res.message || 'User roles updated.');
      await loadUsers();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to save roles.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleStatus = async (u: AdminUserItem) => {
    setBusyId(u.id);
    try {
      const next = u.status === 'suspended' ? 'active' : 'suspended';
      const res = await adminApi.toggleUserStatus(u.id, next);
      showToast(res.message || `User status set to ${next}.`);
      await loadUsers();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to update status.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = () => {
    exportRowsToCsv(
      `kova-users-${new Date().toISOString().slice(0, 10)}.csv`,
      ['ID', 'Name', 'Email', 'Phone', 'Roles', 'Store', 'Status', 'Joined'],
      filtered.map((u) => [
        u.id,
        u.name,
        u.email,
        u.phone || '',
        u.roles.map((r) => r.slug).join(' | '),
        u.store?.name || '',
        u.status,
        formatShortDate(u.created_at),
      ]),
    );
    showToast('Users CSV exported.');
  };

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Customer & user management"
        subtitle="Monitor marketplace buyers, store owners, role permissions, and account suspensions."
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
              onClick={() => {
                setTab('suspended');
                setPage(1);
              }}
              className="bg-[#ffefe6] hover:bg-[#ffe1cf] text-[#ff6e20] text-[12.5px] font-semibold px-4 py-2 rounded-full transition-colors"
            >
              Suspended ({counts.suspended})
            </button>
          </>
        }
      />

      <section className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-2.5 sm:gap-3 rounded-[24px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterPillTabs<UserFilterTab>
            value={tab}
            onChange={(next) => {
              setTab(next);
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All users', count: counts.all },
              { id: 'customer', label: 'Customers', count: counts.customer },
              {
                id: 'store_owner',
                label: 'Store owners',
                count: counts.store_owner,
              },
              { id: 'admin', label: 'Admins', count: counts.admin },
              {
                id: 'suspended',
                label: 'Suspended',
                count: counts.suspended,
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
              placeholder="Search name, email, phone..."
              className="flex-1 bg-transparent text-[12.5px] text-black placeholder:text-[#979797] outline-none min-w-0"
            />
          </div>
        </div>

        {loading ? (
          <DashboardTableSkeleton rows={6} />
        ) : paged.length === 0 ? (
          <div className="py-14 text-center bg-[#f7f7f7] text-[13.5px] text-[#767676] rounded-[14px]">
            No matching user accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                  <th className="py-2.5 px-3.5 rounded-l-[10px]">User</th>
                  <th className="py-2.5 px-3.5">Contact</th>
                  <th className="py-2.5 px-3.5">Roles</th>
                  <th className="py-2.5 px-3.5">Store</th>
                  <th className="py-2.5 px-3.5">Registered</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5 rounded-r-[10px] text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                {paged.map((u) => {
                  const initials = u.name
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-[#fafafa] transition-colors"
                    >
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-3">
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt={u.name}
                              className="w-9 h-9 rounded-[10px] object-cover border border-[#ececec] shrink-0"
                            />
                          ) : (
                            <span className="w-9 h-9 bg-[#f4f4f4] text-black text-[12px] font-bold flex items-center justify-center shrink-0 rounded-[14px]">
                              {initials}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-black truncate max-w-[180px]">
                              {u.name}
                            </p>
                            <p className="text-[11.5px] text-[#8a8a8a] truncate max-w-[200px]">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 text-[#555555]">
                        {u.phone || '—'}
                      </td>
                      <td className="py-3.5 px-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {u.roles.map((r) => (
                            <StatusPill
                              key={r.slug}
                              label={r.slug}
                              tone={
                                r.slug === 'admin'
                                  ? 'blue'
                                  : r.slug === 'store_owner'
                                    ? 'orange'
                                    : 'neutral'
                              }
                            />
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 text-[#555555]">
                        {u.store ? u.store.name : '—'}
                      </td>
                      <td className="py-3.5 px-3.5 text-[#767676] whitespace-nowrap">
                        {formatShortDate(u.created_at)}
                      </td>
                      <td className="py-3.5 px-3.5">
                        <StatusPill label={u.status} />
                      </td>
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openDrawer(u)}
                          className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline"
                        >
                          Manage
                        </button>
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
          itemLabel="users"
          onPageChange={setPage}
        />
      </section>

      {/* Safe Role & Status Management Drawer */}
      <SlideOverDrawer
        open={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        title={selectedUser ? selectedUser.name : ''}
        subtitle={selectedUser?.email}
        footer={
          selectedUser && (
            <>
              {!selectedUser.roles.some((r) => r.slug === 'admin') && (
                <button
                  type="button"
                  disabled={busyId === selectedUser.id}
                  onClick={() => void handleToggleStatus(selectedUser)}
                  className={`text-[12.5px] font-semibold px-4 py-2 rounded-full disabled:opacity-60 ${
                    selectedUser.status === 'suspended'
                      ? 'bg-[#e7f6e7] text-[#029500]'
                      : 'bg-[#fdecec] text-[#e5322d]'
                  }`}
                >
                  {selectedUser.status === 'suspended'
                    ? 'Activate account'
                    : 'Suspend account'}
                </button>
              )}
              <button
                type="button"
                disabled={busyId === selectedUser.id}
                onClick={() => void handleSaveRoles()}
                className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
              >
                {busyId === selectedUser.id ? 'Saving...' : 'Save roles'}
              </button>
            </>
          )
        }
      >
        {selectedUser && (
          <div className="flex flex-col gap-5">
            <div className="bg-[#f7f7f7] p-2.5 flex items-center justify-between rounded-[14px]">
              <div>
                <p className="text-[12px] text-[#767676]">Account status</p>
                <p className="text-[14px] font-bold text-black mt-0.5">
                  Joined {formatShortDate(selectedUser.created_at)}
                </p>
              </div>
              <StatusPill label={selectedUser.status} />
            </div>

            <div className="border border-[#ececec] rounded-[16px] p-4 flex flex-col gap-3">
              <h3 className="text-[14px] font-bold text-black">
                Assigned role
              </h3>
              <p className="text-[12px] text-[#767676]">
                Each user has one active workspace role. Switching a customer to
                Store Owner permanently moves them to Seller Center.
              </p>
              <div className="flex flex-col gap-2.5 pt-1">
                {[
                  {
                    slug: 'customer',
                    title: 'Customer',
                    desc: 'Browse marketplace, place orders, and manage personal profile.',
                  },
                  {
                    slug: 'store_owner',
                    title: 'Store Owner',
                    desc: 'Access Seller Center to manage products, inventory, orders, and payouts.',
                  },
                  {
                    slug: 'admin',
                    title: 'Root Administrator',
                    desc: 'Full platform governance across stores, users, Bakong, and settings.',
                  },
                ].map((r) => {
                  const checked = draftRoles.includes(r.slug);
                  return (
                    <div
                      key={r.slug}
                      className={`flex items-center justify-between gap-3 border rounded-[14px] p-3.5 transition-colors ${
                        checked
                          ? 'border-[#ff6e20] bg-[#fff9f5]'
                          : 'border-[#ececec] hover:border-[#cccccc]'
                      }`}
                    >
                      <div>
                        <p className="text-[13px] font-semibold text-black">
                          {r.title}
                        </p>
                        <p className="text-[11.5px] text-[#767676] mt-0.5">
                          {r.desc}
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={checked}
                        onChange={() => setDraftRoles([r.slug])}
                        ariaLabel={`Assign ${r.title} role`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedUser.store && (
              <div className="border border-[#ececec] rounded-[16px] p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11.5px] text-[#8a8a8a]">Linked store</p>
                  <p className="text-[14px] font-bold text-black mt-0.5">
                    {selectedUser.store.name}
                  </p>
                </div>
                <StatusPill label={selectedUser.store.status} />
              </div>
            )}
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
}

// ==========================================
// 4. Categories & Brands (/admin/catalog) — Figma Admin · 18
// Full-width clean table + Slide-Over Drawer for Create & Edit!
// ==========================================
export function AdminCatalogPage() {
  const { showToast, refreshCatalog } = useStore();
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hidden'>(
    'all',
  );
  const { confirmDelete } = useConfirmDelete();
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<AdminCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick inline category input bar
  const [quickName, setQuickName] = useState('');
  const [quickCommission, setQuickCommission] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);

  // Category drawer state (supports create + edit)
  const [catDrawerOpen, setCatDrawerOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<AdminCategoryItem | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catCommission, setCatCommission] = useState('');
  const [catOrder, setCatOrder] = useState('0');
  const [catActive, setCatActive] = useState(true);
  const [savingCat, setSavingCat] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      const cats = await adminApi.getCategories();
      setCategories(cats);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to load categories.',
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void loadCatalog();
    });
    return () => {
      active = false;
    };
  }, [loadCatalog]);

  const handleQuickAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) return;
    setQuickSaving(true);
    try {
      await adminApi.createCategory({
        name: quickName.trim(),
        commission_rate: quickCommission.trim()
          ? Number(quickCommission)
          : null,
        order: categories.length + 1,
        is_active: true,
      });
      setQuickName('');
      setQuickCommission('');
      showToast('Category added.');
      await Promise.all([loadCatalog(), refreshCatalog()]);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to add category.',
      );
    } finally {
      setQuickSaving(false);
    }
  };

  const openNewCategory = () => {
    setEditingCat(null);
    setCatName('');
    setCatDesc('');
    setCatCommission('');
    setCatOrder(String(categories.length + 1));
    setCatActive(true);
    setCatDrawerOpen(true);
  };

  const openEditCategory = (c: AdminCategoryItem) => {
    setEditingCat(c);
    setCatName(c.name);
    setCatDesc(c.description || '');
    setCatCommission(
      c.commission_rate !== null && c.commission_rate !== undefined
        ? String(c.commission_rate)
        : '',
    );
    setCatOrder(String(c.order ?? 0));
    setCatActive(Boolean(c.is_active));
    setCatDrawerOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setSavingCat(true);
    try {
      const payload = {
        name: catName.trim(),
        description: catDesc.trim() || null,
        commission_rate: catCommission.trim() ? Number(catCommission) : null,
        order: Number(catOrder) || 0,
        is_active: catActive,
      };
      if (editingCat) {
        await adminApi.updateCategory(editingCat.id, payload);
        showToast('Category updated.');
      } else {
        await adminApi.createCategory(payload);
        showToast('Category created.');
      }
      setCatDrawerOpen(false);
      await Promise.all([loadCatalog(), refreshCatalog()]);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to save category.',
      );
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCategory = (c: AdminCategoryItem) => {
    confirmDelete({
      title: 'Delete category?',
      description: `Category "${c.name}" will be permanently removed from the marketplace.`,
      itemLabel: c.name,
      onOptimisticRemove: () => {
        setCategories((prev) => prev.filter((item) => item.id !== c.id));
      },
      onUndo: () => {
        void loadCatalog();
      },
      onCommit: async () => {
        await adminApi.deleteCategory(c.id);
        showToast(`Deleted "${c.name}".`);
        await Promise.all([loadCatalog(), refreshCatalog()]);
      },
    });
  };

  const q = search.trim().toLowerCase();
  const filteredCats = categories.filter((c) => {
    if (statusFilter === 'active' && !c.is_active) return false;
    if (statusFilter === 'hidden' && c.is_active) return false;
    return (
      !q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Categories"
        subtitle="Manage marketplace categories, display order, and commission overrides."
        actions={
          <button
            type="button"
            onClick={openNewCategory}
            className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors"
          >
            Add category
          </button>
        }
      />

      {/* Quick Category Input Bar */}
      <form
        onSubmit={handleQuickAddCategory}
        className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-end gap-3 rounded-[24px]"
      >
        <label className="flex-1 flex flex-col gap-1.5 min-w-0">
          <span className="text-[12px] font-semibold text-black">
            Quick add category
          </span>
          <input
            type="text"
            required
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
            placeholder="Type a new category name (e.g. Fashion & Apparel, Phones & Audio)..."
            className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] outline-none"
          />
        </label>
        <label className="w-full sm:w-[170px] flex flex-col gap-1.5 shrink-0">
          <span className="text-[12px] font-semibold text-black">
            Commission % (optional)
          </span>
          <input
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={quickCommission}
            onChange={(e) => setQuickCommission(e.target.value)}
            placeholder="Default"
            className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={quickSaving || !quickName.trim()}
          className="h-[42px] bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-50 text-white text-[13px] font-semibold px-6 rounded-full transition-colors shrink-0"
        >
          {quickSaving ? 'Adding...' : 'Add category'}
        </button>
      </form>

      <section className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-2.5 sm:gap-3 rounded-[24px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterPillTabs<'all' | 'active' | 'hidden'>
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { id: 'all', label: 'All categories', count: categories.length },
              {
                id: 'active',
                label: 'Active',
                count: categories.filter((c) => c.is_active).length,
              },
              {
                id: 'hidden',
                label: 'Hidden',
                count: categories.filter((c) => !c.is_active).length,
              },
            ]}
          />

          <div className="flex items-center gap-2 bg-[#f7f7f7] border border-[#ececec] focus-within:border-[#ff6e20] focus-within:bg-white rounded-full px-3.5 h-[36px] w-full sm:w-[240px] transition-colors">
            <FigmaIcon name="search" className="w-3.5 h-3.5 text-[#979797]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories..."
              className="flex-1 bg-transparent text-[12.5px] text-black placeholder:text-[#979797] outline-none min-w-0"
            />
          </div>
        </div>

        {loading ? (
          <DashboardTableSkeleton rows={6} />
        ) : filteredCats.length === 0 ? (
          <div className="py-14 text-center bg-[#f7f7f7] flex flex-col items-center gap-3 rounded-[14px]">
            <p className="text-[14px] font-semibold text-black">
              No categories found
            </p>
            <button
              type="button"
              onClick={openNewCategory}
              className="bg-[#ff6e20] text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
            >
              Create first category
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                  <th className="py-2.5 px-3.5 rounded-l-[10px]">Category</th>
                  <th className="py-2.5 px-3.5">Sort order</th>
                  <th className="py-2.5 px-3.5">SEO slug</th>
                  <th className="py-2.5 px-3.5">Commission</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5 rounded-r-[10px] text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                {filteredCats.map((c, idx) => (
                  <tr
                    key={c.id}
                    className="hover:bg-[#fafafa] transition-colors"
                  >
                    <td className="py-3.5 px-3.5">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 bg-[#f7f7f7] border border-[#ececec] text-[#ff6e20] flex items-center justify-center shrink-0 rounded-[14px]">
                          <FigmaIcon name="tag" className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-black">{c.name}</p>
                          {c.description && (
                            <p className="text-[11.5px] text-[#8a8a8a] truncate max-w-[260px]">
                              {c.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5 font-medium text-[#555555]">
                      #{c.order ?? idx + 1}
                    </td>
                    <td className="py-3.5 px-3.5 font-mono text-[12px] text-[#767676]">
                      /c/{c.slug}
                    </td>
                    <td className="py-3.5 px-3.5 text-[#555555]">
                      {c.commission_rate !== null &&
                      c.commission_rate !== undefined
                        ? `${c.commission_rate}%`
                        : 'Platform default'}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <StatusPill
                        label={c.is_active ? 'Active' : 'Hidden'}
                        tone={c.is_active ? 'green' : 'neutral'}
                      />
                    </td>
                    <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openEditCategory(c)}
                          className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteCategory(c)}
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

      {/* Category Create/Edit Drawer */}
      <SlideOverDrawer
        open={catDrawerOpen}
        onClose={() => setCatDrawerOpen(false)}
        title={
          editingCat
            ? `Edit category · ${editingCat.name}`
            : 'Add global category'
        }
        subtitle="Marketplace categories are available to all approved store owners."
        footer={
          <button
            type="submit"
            form="admin-category-form"
            disabled={savingCat}
            className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
          >
            {savingCat
              ? 'Saving...'
              : editingCat
                ? 'Save changes'
                : 'Create category'}
          </button>
        }
      >
        <form
          id="admin-category-form"
          onSubmit={handleSaveCategory}
          className="flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Category name
            </span>
            <input
              type="text"
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="e.g. Electronics & Audio"
              className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13.5px] outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-black">
                Commission % (optional)
              </span>
              <input
                type="number"
                step="0.1"
                min={0}
                max={100}
                value={catCommission}
                onChange={(e) => setCatCommission(e.target.value)}
                placeholder="Platform default"
                className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13.5px] outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-black">
                Sort order
              </span>
              <input
                type="number"
                min={0}
                value={catOrder}
                onChange={(e) => setCatOrder(e.target.value)}
                className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13.5px] outline-none"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Description
            </span>
            <textarea
              rows={3}
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              placeholder="Short summary of products in this category..."
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[16px] p-3.5 text-[13.5px] outline-none"
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Visibility
            </span>
            <div className="h-[42px] bg-white border border-[#ececec] rounded-full px-4 flex items-center justify-between gap-3">
              <span
                className={`text-[13px] font-medium ${
                  catActive ? 'text-[#ff6e20]' : 'text-[#767676]'
                }`}
              >
                {catActive ? 'Visible on marketplace' : 'Hidden'}
              </span>
              <ToggleSwitch
                checked={catActive}
                onChange={setCatActive}
                ariaLabel="Visible on Kova Marketplace"
              />
            </div>
          </div>
        </form>
      </SlideOverDrawer>
    </div>
  );
}

// ==========================================
// 5. Payments & Bakong Transactions (/admin/bakong) — Figma Admin · 11
// ==========================================
type BakongTab = 'all' | 'successful' | 'pending' | 'expired' | 'merchants';

export function AdminBakongPage() {
  const { showToast } = useStore();
  const [overview, setOverview] = useState<AdminBakongOverview | null>(null);
  const [accounts, setAccounts] = useState<AdminBakongAccount[]>([]);
  const [txs, setTxs] = useState<BakongTxItem[]>([]);
  const [tab, setTab] = useState<BakongTab>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadBakong = useCallback(async () => {
    try {
      const [ov, accs, txRes] = await Promise.all([
        adminApi.getBakongOverview(),
        adminApi.getBakongAccounts(1),
        adminApi.getBakongTransactions({ page: 1 }),
      ]);
      setOverview(ov);
      setAccounts(accs.data);
      setTxs(txRes.data);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to load Bakong data.',
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

  const q = search.trim().toLowerCase();

  const filteredTxs = useMemo(() => {
    return txs.filter((t) => {
      if (tab === 'successful' && t.payment_status !== 'successful') {
        return false;
      }
      if (tab === 'pending' && t.payment_status !== 'pending') return false;
      if (
        tab === 'expired' &&
        t.payment_status !== 'expired' &&
        t.payment_status !== 'failed'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        t.bill_number.toLowerCase().includes(q) ||
        (t.store?.name || '').toLowerCase().includes(q) ||
        (t.child_order?.order_number || '').toLowerCase().includes(q)
      );
    });
  }, [txs, tab, q]);

  const handleExportLedger = () => {
    exportRowsToCsv(
      `kova-bakong-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Bill #', 'Order #', 'Store', 'Currency', 'Amount', 'Status', 'Created'],
      filteredTxs.map((t) => [
        t.bill_number,
        t.child_order?.order_number || '',
        t.store?.name || `Store #${t.store_id}`,
        t.currency,
        Number(t.amount).toFixed(2),
        t.payment_status,
        formatShortDate(t.created_at),
      ]),
    );
    showToast('Bakong transactions ledger exported.');
  };

  const kpis: KpiCardItem[] = overview
    ? [
        {
          label: 'Total KHQR paid',
          value: `$${overview.transactions.total_volume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          sub: `${overview.transactions.successful_count} settled transactions`,
          badge: 'Paid',
          tone: 'green',
        },
        {
          label: 'Connected merchants',
          value: String(overview.stores.connected),
          sub: `${overview.stores.not_configured} stores not configured`,
          badge: overview.environment.toUpperCase(),
          tone: 'orange',
        },
        {
          label: 'Pending KHQR',
          value: String(overview.transactions.pending_count),
          sub: 'Awaiting customer scan',
          tone: overview.transactions.pending_count > 0 ? 'orange' : 'neutral',
        },
        {
          label: 'Expired / Failed',
          value: String(overview.transactions.failed_count),
          sub: `${overview.stores.disconnected_or_expired} expired merchant tokens`,
          badge:
            overview.transactions.failed_count > 0 ? 'Investigate' : 'Clean',
          tone: overview.transactions.failed_count > 0 ? 'red' : 'green',
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Payments & transactions"
        subtitle="Platform-wide NBC Bakong KHQR financial ledger and connected merchant accounts."
      />

      {loading || !overview ? (
        <>
          <DashboardKpiSkeleton count={4} />
          <DashboardTableSkeleton rows={6} />
        </>
      ) : (
        <>
          <KpiGrid items={kpis} />

          <section className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-2.5 sm:gap-3 rounded-[24px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FilterPillTabs<BakongTab>
                value={tab}
                onChange={setTab}
                options={[
                  { id: 'all', label: 'All transactions', count: txs.length },
                  {
                    id: 'successful',
                    label: 'Successful',
                    count: overview.transactions.successful_count,
                  },
                  {
                    id: 'pending',
                    label: 'Pending',
                    count: overview.transactions.pending_count,
                  },
                  {
                    id: 'expired',
                    label: 'Failed / Expired',
                    count: overview.transactions.failed_count,
                  },
                  {
                    id: 'merchants',
                    label: 'Connected merchants',
                    count: accounts.length,
                  },
                ]}
              />

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto sm:ml-auto">
                {tab !== 'merchants' && (
                  <div className="flex items-center gap-2 bg-[#f7f7f7] border border-[#ececec] focus-within:border-[#ff6e20] focus-within:bg-white rounded-full px-3.5 h-[36px] flex-1 sm:flex-none sm:w-[240px] min-w-0">
                    <FigmaIcon
                      name="search"
                      className="w-3.5 h-3.5 text-[#979797]"
                    />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search bill # or store..."
                      className="flex-1 bg-transparent text-[12.5px] text-black placeholder:text-[#979797] outline-none min-w-0"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleExportLedger}
                  className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors shrink-0 cursor-pointer"
                >
                  Export ledger
                </button>
              </div>
            </div>

            {tab === 'merchants' ? (
              accounts.length === 0 ? (
                <p className="py-12 text-center bg-[#f7f7f7] text-[13.5px] text-[#767676] rounded-[14px]">
                  No stores have connected a Bakong account yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                        <th className="py-2.5 px-3.5 rounded-l-[10px]">
                          Store
                        </th>
                        <th className="py-2.5 px-3.5">Bakong Account ID</th>
                        <th className="py-2.5 px-3.5">Merchant Name</th>
                        <th className="py-2.5 px-3.5">Status</th>
                        <th className="py-2.5 px-3.5 rounded-r-[10px]">
                          Last Checked
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                      {accounts.map((a) => (
                        <tr
                          key={a.id}
                          className="hover:bg-[#fafafa] transition-colors"
                        >
                          <td className="py-3.5 px-3.5 font-semibold text-black">
                            {a.store?.name || `Store #${a.store_id}`}
                          </td>
                          <td className="py-3.5 px-3.5 font-mono text-[12px] text-black">
                            {a.bakong_account_id}
                          </td>
                          <td className="py-3.5 px-3.5 text-[#555555]">
                            {a.merchant_name}
                          </td>
                          <td className="py-3.5 px-3.5">
                            <StatusPill label={a.connection_status} />
                          </td>
                          <td className="py-3.5 px-3.5 text-[#767676]">
                            {a.last_checked_at
                              ? formatShortDate(a.last_checked_at)
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : filteredTxs.length === 0 ? (
              <p className="py-12 text-center bg-[#f7f7f7] text-[13.5px] text-[#767676] rounded-[14px]">
                No Bakong transactions match this filter.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                      <th className="py-2.5 px-3.5 rounded-l-[10px]">Bill #</th>
                      <th className="py-2.5 px-3.5">Order #</th>
                      <th className="py-2.5 px-3.5">Store / Buyer</th>
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
                        <td className="py-3.5 px-3.5 font-medium text-[#555555]">
                          {t.child_order?.order_number
                            ? `#${t.child_order.order_number}`
                            : '—'}
                        </td>
                        <td className="py-3.5 px-3.5">
                          <p className="font-semibold text-black">
                            {t.store?.name || `Store #${t.store_id}`}
                          </p>
                          {t.child_order?.customer_name && (
                            <p className="text-[11.5px] text-[#8a8a8a]">
                              {t.child_order.customer_name}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-3.5 font-bold text-[#029500]">
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
// 6. Support & Disputes (/admin/disputes) — Figma Admin · 22
// ==========================================
export function AdminDisputesPage() {
  const { showToast } = useStore();
  const [disputes, setDisputes] = useState<AdminDisputeItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [loading, setLoading] = useState(true);
  const [activeDispute, setActiveDispute] = useState<AdminDisputeItem | null>(
    null,
  );
  const [resolutionStatus, setResolutionStatus] = useState<
    'resolved_customer' | 'resolved_store' | 'closed'
  >('resolved_customer');
  const [resolutionText, setResolutionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadDisputes = useCallback(async () => {
    try {
      const res = await adminApi.getDisputes();
      setDisputes(res.data);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to load disputes.',
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void loadDisputes();
    });
    return () => {
      active = false;
    };
  }, [loadDisputes]);

  const openCount = disputes.filter(
    (d) => d.status === 'open' || d.status === 'under_review',
  ).length;
  const resolvedCustomer = disputes.filter(
    (d) => d.status === 'resolved_customer',
  ).length;
  const resolvedStore = disputes.filter(
    (d) => d.status === 'resolved_store' || d.status === 'closed',
  ).length;

  const filtered = disputes.filter((d) => {
    if (filter === 'open') {
      return d.status === 'open' || d.status === 'under_review';
    }
    if (filter === 'resolved') {
      return d.status !== 'open' && d.status !== 'under_review';
    }
    return true;
  });

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDispute || !resolutionText.trim()) return;
    setSubmitting(true);
    try {
      await adminApi.resolveDispute(activeDispute.id, {
        status: resolutionStatus,
        admin_resolution: resolutionText.trim(),
      });
      showToast('Dispute resolution recorded.');
      setActiveDispute(null);
      setResolutionText('');
      await loadDisputes();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to resolve dispute.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Customer support & disputes"
        subtitle="Centralized multi-party mediation desk for refund escalations and buyer vs seller issues."
      />

      <KpiGrid
        items={[
          {
            label: 'Total cases',
            value: String(disputes.length),
            sub: 'All recorded disputes',
            badge: 'Desk',
            tone: 'neutral',
          },
          {
            label: 'Active disputes',
            value: String(openCount),
            sub: 'Requires Root Admin mediation',
            badge: openCount > 0 ? 'Urgent' : 'Clear',
            tone: openCount > 0 ? 'red' : 'green',
          },
          {
            label: 'Customer favored',
            value: String(resolvedCustomer),
            sub: 'Refunds approved',
            badge: 'Refunded',
            tone: 'orange',
          },
          {
            label: 'Store favored / closed',
            value: String(resolvedStore),
            sub: 'Settled cases',
            badge: 'Resolved',
            tone: 'green',
          },
        ]}
      />

      <section className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-2.5 sm:gap-3 rounded-[24px]">
        <FilterPillTabs<'all' | 'open' | 'resolved'>
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All', count: disputes.length },
            { id: 'open', label: 'Open', count: openCount },
            {
              id: 'resolved',
              label: 'Resolved',
              count: resolvedCustomer + resolvedStore,
            },
          ]}
        />

        {loading ? (
          <DashboardTableSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-[13.5px] text-[#767676] bg-[#f7f7f7] rounded-[14px]">
            No customer disputes found for this filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                  <th className="py-2.5 px-3.5 rounded-l-[10px]">Case ID</th>
                  <th className="py-2.5 px-3.5">Customer / Store</th>
                  <th className="py-2.5 px-3.5">Order #</th>
                  <th className="py-2.5 px-3.5">Reason</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5 rounded-r-[10px] text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                {filtered.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-[#fafafa] transition-colors"
                  >
                    <td className="py-3.5 px-3.5 font-mono font-semibold text-black">
                      DIS-{d.id}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <p className="font-semibold text-black">
                        {d.user?.name || 'Customer'} vs{' '}
                        {d.store?.name || 'Store'}
                      </p>
                      <p className="text-[11.5px] text-[#8a8a8a]">
                        {formatShortDate(d.created_at)}
                      </p>
                    </td>
                    <td className="py-3.5 px-3.5 font-medium text-[#555555]">
                      {d.refund?.child_order?.order_number
                        ? `#${d.refund.child_order.order_number}`
                        : '—'}
                    </td>
                    <td className="py-3.5 px-3.5 text-[#555555] max-w-[220px] truncate">
                      {d.reason || 'Refund dispute'}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <StatusPill label={d.status} />
                    </td>
                    <td className="py-3.5 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDispute(d);
                          setResolutionText(d.admin_resolution || '');
                        }}
                        className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline"
                      >
                        Mediate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SlideOverDrawer
        open={Boolean(activeDispute)}
        onClose={() => setActiveDispute(null)}
        title={activeDispute ? `Mediate Dispute #DIS-${activeDispute.id}` : ''}
        subtitle={
          activeDispute
            ? `${activeDispute.user?.name || 'Customer'} vs ${activeDispute.store?.name || 'Store'}`
            : undefined
        }
        footer={
          <button
            type="submit"
            form="admin-dispute-form"
            disabled={submitting}
            className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
          >
            {submitting ? 'Submitting...' : 'Submit resolution'}
          </button>
        }
      >
        {activeDispute && (
          <form
            id="admin-dispute-form"
            onSubmit={handleResolve}
            className="flex flex-col gap-4"
          >
            <div className="bg-[#f7f7f7] p-2.5 flex flex-col gap-1.5 text-[12.5px] rounded-[14px]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-black">
                  {activeDispute.reason || 'Refund Dispute'}
                </span>
                <StatusPill label={activeDispute.status} />
              </div>
              <p className="text-[#555555] leading-relaxed">
                {activeDispute.description || 'No additional description.'}
              </p>
              {activeDispute.refund?.amount && (
                <p className="font-semibold text-[#ff6e20] pt-1">
                  Disputed amount: $
                  {Number(activeDispute.refund.amount).toFixed(2)}
                </p>
              )}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-black">
                Mediation decision
              </span>
              <select
                value={resolutionStatus}
                onChange={(e) =>
                  setResolutionStatus(
                    e.target.value as
                      | 'resolved_customer'
                      | 'resolved_store'
                      | 'closed',
                  )
                }
                className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] bg-white outline-none"
              >
                <option value="resolved_customer">
                  Approve refund (favor customer)
                </option>
                <option value="resolved_store">
                  Reject refund (favor store)
                </option>
                <option value="closed">Close dispute</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-black">
                Admin resolution notes
              </span>
              <textarea
                rows={4}
                required
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                placeholder="Document the evidence reviewed and final settlement decision..."
                className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] p-3 text-[13px] outline-none"
              />
            </label>
          </form>
        )}
      </SlideOverDrawer>
    </div>
  );
}

// ==========================================
// 7. Platform & System Settings (/admin/settings) — Figma Admin · 26
// ==========================================
const CURRENCY_OPTIONS = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'KHR', symbol: '៛', label: 'Cambodian Riel' },
] as const;

const SOCIAL_LINK_FIELDS = [
  {
    key: 'facebook',
    label: 'Facebook',
    placeholder: 'https://facebook.com/kovaglobal',
  },
  {
    key: 'telegram',
    label: 'Telegram',
    placeholder: 'https://t.me/kovaglobal',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    placeholder: 'https://instagram.com/kovaglobal',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    placeholder: 'https://tiktok.com/@kovaglobal',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    placeholder: 'https://youtube.com/@kovaglobal',
  },
] as const;

const BOOLEAN_SETTING_KEYS = new Set([
  'commission_enabled',
  'allow_store_registration',
  'auto_approve_stores',
  'maintenance_mode',
  'telegram_notifications_enabled',
]);

const BRANDING_FILE_KEYS = new Set(['site_logo', 'site_favicon']);

function parseBoolSetting(val: string | undefined): boolean {
  const normalized = (val ?? '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function parseSupportedCurrencies(raw: string | undefined): string[] {
  if (!raw) return ['USD', 'KHR'];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const codes = parsed
        .map((c) => String(c).trim().toUpperCase())
        .filter(Boolean);
      return codes.length > 0 ? Array.from(new Set(codes)) : ['USD'];
    }
  } catch {
    const split = raw
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    if (split.length > 0) return Array.from(new Set(split));
  }
  return ['USD', 'KHR'];
}

function parseSocialLinks(raw: string | undefined): Record<string, string> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      Object.entries(parsed as Record<string, unknown>).forEach(([k, v]) => {
        if (typeof v === 'string') out[k.toLowerCase()] = v;
      });
      return out;
    }
  } catch {
    if (/^https?:\/\//i.test(raw.trim())) {
      return { facebook: raw.trim() };
    }
  }
  return {};
}

export function AdminSettingsPage() {
  const {
    showToast,
    refreshCatalog,
    khrRate,
    settings: publicSettings,
  } = useStore();
  const [grouped, setGrouped] = useState<Record<string, PlatformSettingItem[]>>(
    {},
  );
  const [initialValues, setInitialValues] = useState<Record<string, string>>(
    {},
  );
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const data = await adminApi.getSettings();
      setGrouped(data);
      const map: Record<string, string> = {};
      Object.values(data)
        .flat()
        .forEach((item) => {
          map[item.key] = item.value ?? '';
        });
      setInitialValues(map);
      setDraftValues(map);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to load settings.',
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void loadSettings();
    });
    return () => {
      active = false;
    };
  }, [loadSettings]);

  const groupKeys = Object.keys(grouped);
  const visibleEntries = Object.entries(grouped).filter(
    ([g]) => activeGroup === 'all' || g === activeGroup,
  );

  const isInstantSettingItem = (item: PlatformSettingItem) =>
    item.type === 'boolean' ||
    BOOLEAN_SETTING_KEYS.has(item.key) ||
    BRANDING_FILE_KEYS.has(item.key) ||
    item.key === 'supported_currencies';

  const saveKeysImmediate = async (
    entries: Record<string, string>,
    primaryKey: string,
    successMsg?: string,
  ) => {
    const prevSnapshot: Record<string, string> = {};
    Object.keys(entries).forEach((k) => {
      prevSnapshot[k] = draftValues[k] ?? '';
    });

    setDraftValues((prev) => ({ ...prev, ...entries }));
    setSavingKey(primaryKey);
    try {
      const payload = Object.entries(entries).map(([key, value]) => ({
        key,
        value,
      }));
      await adminApi.updateSettings(payload);
      setInitialValues((prev) => ({ ...prev, ...entries }));
      await refreshCatalog();
      if (successMsg) showToast(successMsg);
    } catch (err) {
      setDraftValues((prev) => ({ ...prev, ...prevSnapshot }));
      showToast(
        err instanceof ApiError ? err.message : 'Unable to update setting.',
      );
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveGroup = async (
    groupName: string,
    items: PlatformSettingItem[],
  ) => {
    const editableItems = items.filter((item) => !isInstantSettingItem(item));
    const payload = editableItems.map((item) => ({
      key: item.key,
      value: draftValues[item.key] ?? '',
    }));

    if (payload.length === 0) return;

    setSavingGroup(groupName);
    try {
      await adminApi.updateSettings(payload);
      await Promise.all([loadSettings(), refreshCatalog()]);
      showToast(
        groupName === 'bakong'
          ? 'Bakong settings saved.'
          : `${groupName.replace(/_/g, ' ')} settings saved.`,
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to save settings.',
      );
    } finally {
      setSavingGroup(null);
    }
  };

  const handleBrandingFileUpload = async (key: string, file: File | null) => {
    if (!file) return;
    setUploadingKey(key);
    try {
      const uploaded = await adminApi.uploadBrandingAsset(file);
      await saveKeysImmediate(
        { [key]: uploaded.secure_url },
        key,
        key === 'site_logo'
          ? 'Site logo updated and saved.'
          : 'Site favicon updated and saved.',
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to upload file.',
      );
    } finally {
      setUploadingKey(null);
    }
  };

  const supportedCurrencies = parseSupportedCurrencies(
    draftValues.supported_currencies,
  );
  const bakongTokenItem = (grouped.bakong || []).find(
    (item) => item.key === 'bakong_api_token',
  );
  const bakongEnv = (
    publicSettings.services?.bakong_environment || 'production'
  ).toUpperCase();
  const allowStoreReg = parseBoolSetting(draftValues.allow_store_registration);
  const autoApproveStores = parseBoolSetting(draftValues.auto_approve_stores);
  const maintenanceMode = parseBoolSetting(draftValues.maintenance_mode);

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Platform & system settings"
        subtitle="Configure marketplace identity, USD/KHR exchange rate, commission defaults, and global controls."
      />

      {!loading && groupKeys.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveGroup('all')}
            className={`px-3.5 py-[7px] rounded-full text-[12px] transition-colors ${
              activeGroup === 'all'
                ? 'bg-[#ff6e20] text-white font-semibold border border-[#ff6e20]'
                : 'bg-white text-[#555555] font-medium border border-[#ececec] hover:border-[#cccccc]'
            }`}
          >
            All settings
          </button>
          {groupKeys.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setActiveGroup(g)}
              className={`px-3.5 py-[7px] rounded-full text-[12px] capitalize transition-colors ${
                activeGroup === g
                  ? 'bg-[#ff6e20] text-white font-semibold border border-[#ff6e20]'
                  : 'bg-white text-[#555555] font-medium border border-[#ececec] hover:border-[#cccccc]'
              }`}
            >
              {g.replace(/_/g, ' ')}
            </button>
          ))}
          <Link
            to="/admin/audit-logs"
            className="px-3.5 py-[7px] rounded-full text-[12px] bg-white text-[#555555] font-medium border border-[#ececec] hover:border-[#cccccc] hover:text-black"
          >
            Audit Logs
          </Link>
        </div>
      )}

      {loading ? (
        <DashboardTableSkeleton rows={6} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(290px,1fr)] gap-5 items-start">
          <div className="flex flex-col gap-4">
            {visibleEntries.map(([groupName, items]) => {
              const editableItems = items.filter(
                (item) => !isInstantSettingItem(item),
              );
              const isGroupDirty = editableItems.some((item) => {
                if (item.is_secret || item.key === 'bakong_api_token') {
                  return (draftValues[item.key] ?? '').trim().length > 0;
                }
                return (
                  (draftValues[item.key] ?? '') !==
                  (initialValues[item.key] ?? '')
                );
              });
              const isThisGroupSaving = savingGroup === groupName;

              return (
                <section
                  key={groupName}
                  className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-2.5 sm:gap-3 rounded-[24px]"
                >
                  <h2 className="text-[15.5px] font-bold text-black capitalize">
                    {groupName === 'bakong'
                      ? 'Bakong Open API & KHQR settings'
                      : `${groupName.replace(/_/g, ' ')} settings`}
                  </h2>
                  {groupName === 'bakong' && (
                    <p className="text-[12px] text-[#767676] -mt-2">
                      Manage the single platform-wide NBC Bakong Open API JWT
                      token used to generate and verify KHQR payments for every
                      store on Kova. Bakong environment &amp; API URL are
                      configured in <code className="font-mono">.env</code>{' '}
                      (default:{' '}
                      <span className="font-semibold">production</span>).
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {items.map((item) => {
                      // 1. Secret platform Bakong Open API JWT Token
                      if (item.is_secret || item.key === 'bakong_api_token') {
                        return (
                          <label
                            key={item.key}
                            className="flex flex-col gap-1.5 sm:col-span-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[12px] font-semibold text-black">
                                Bakong Open API JWT token
                              </span>
                              {item.has_value ? (
                                <span className="text-[11px] font-semibold text-[#029500] font-mono">
                                  Saved in DB: {item.masked_value || 'Stored'}
                                  {item.expires_at
                                    ? ` · Exp ${formatShortDate(item.expires_at)}`
                                    : ''}
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold text-[#ff6e20]">
                                  Not configured yet
                                </span>
                              )}
                            </div>
                            <PasswordInput
                              mono
                              value={draftValues[item.key] ?? ''}
                              onChange={(e) =>
                                setDraftValues((prev) => ({
                                  ...prev,
                                  [item.key]: e.target.value,
                                }))
                              }
                              placeholder={
                                item.has_value
                                  ? 'Stored encrypted in database — leave blank to keep saved token'
                                  : 'Paste platform NBC Bakong Open API JWT token'
                              }
                            />
                            {item.description && (
                              <span className="text-[11px] text-[#8a8a8a]">
                                {item.description}
                              </span>
                            )}
                          </label>
                        );
                      }

                      // 2. Branding file upload (site_logo, site_favicon) — saves immediately
                      if (BRANDING_FILE_KEYS.has(item.key)) {
                        const currentUrl = (draftValues[item.key] ?? '').trim();
                        const isLogo = item.key === 'site_logo';
                        const isUploading =
                          uploadingKey === item.key || savingKey === item.key;
                        return (
                          <div
                            key={item.key}
                            className="flex flex-col gap-2 bg-[#fafafa] border border-[#ececec] p-3.5 rounded-[14px]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12.5px] font-semibold text-black capitalize">
                                {item.key.replace(/_/g, ' ')}
                              </span>
                              {currentUrl && (
                                <button
                                  type="button"
                                  disabled={isUploading}
                                  onClick={() =>
                                    void saveKeysImmediate(
                                      { [item.key]: '' },
                                      item.key,
                                      `${item.key.replace(/_/g, ' ')} removed.`,
                                    )
                                  }
                                  className="text-[11px] font-semibold text-[#e5322d] hover:underline disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <div
                                className={`${
                                  isLogo ? 'w-24 h-14' : 'w-14 h-14'
                                } rounded-[12px] border border-[#ececec] bg-white overflow-hidden shrink-0 flex items-center justify-center p-1.5`}
                              >
                                {currentUrl ? (
                                  <img
                                    src={currentUrl}
                                    alt={item.key}
                                    className="max-w-full max-h-full object-contain"
                                  />
                                ) : (
                                  <Image className="w-5 h-5 text-[#ababab]" />
                                )}
                              </div>

                              <div className="flex flex-col gap-1.5 min-w-0">
                                <label className="inline-flex items-center gap-1.5 self-start bg-white hover:bg-[#ffefe6] hover:text-[#ff6e20] border border-[#ececec] hover:border-[#ff6e20]/40 text-black text-[12px] font-semibold px-3.5 py-1.5 rounded-full cursor-pointer transition-colors">
                                  <input
                                    type="file"
                                    accept={isLogo ? 'image/*' : 'image/*,.ico'}
                                    disabled={isUploading}
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      void handleBrandingFileUpload(
                                        item.key,
                                        file,
                                      );
                                      e.target.value = '';
                                    }}
                                  />
                                  <span>
                                    {isUploading
                                      ? 'Saving...'
                                      : currentUrl
                                        ? 'Replace file'
                                        : 'Choose file'}
                                  </span>
                                </label>
                                <span className="text-[11px] text-[#8a8a8a]">
                                  {isLogo
                                    ? 'PNG, JPG, WebP, or SVG'
                                    : 'PNG, ICO, SVG, or WebP (square)'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 3. Toggle Switches for boolean flags — save immediately on toggle
                      if (
                        item.type === 'boolean' ||
                        BOOLEAN_SETTING_KEYS.has(item.key)
                      ) {
                        const isOn = parseBoolSetting(draftValues[item.key]);
                        const isToggleSaving = savingKey === item.key;
                        const labelText = item.key.replace(/_/g, ' ');
                        return (
                          <div key={item.key} className="flex flex-col gap-1.5">
                            <span className="text-[12px] font-semibold text-black capitalize">
                              {labelText}
                            </span>
                            <div className="h-[42px] bg-white border border-[#ececec] rounded-full pl-4 pr-2 flex items-center justify-between gap-3">
                              <span
                                className={`text-[13px] font-medium ${
                                  isOn ? 'text-[#ff6e20]' : 'text-[#767676]'
                                }`}
                              >
                                {isToggleSaving
                                  ? 'Updating...'
                                  : isOn
                                    ? 'Enabled'
                                    : 'Disabled'}
                              </span>
                              <ToggleSwitch
                                checked={isOn}
                                disabled={isToggleSaving}
                                onChange={(next) =>
                                  void saveKeysImmediate(
                                    { [item.key]: next ? 'true' : 'false' },
                                    item.key,
                                    `${labelText} ${next ? 'enabled' : 'disabled'}.`,
                                  )
                                }
                                ariaLabel={`Toggle ${labelText}`}
                              />
                            </div>
                            {item.description && (
                              <span className="text-[11px] text-[#8a8a8a]">
                                {item.description}
                              </span>
                            )}
                          </div>
                        );
                      }

                      // 4. Default Currency dropdown
                      if (item.key === 'default_currency') {
                        const currentVal = (
                          draftValues[item.key] || 'USD'
                        ).toUpperCase();
                        const selectableCodes = Array.from(
                          new Set([...supportedCurrencies, currentVal]),
                        );
                        return (
                          <label
                            key={item.key}
                            className="flex flex-col gap-1.5"
                          >
                            <span className="text-[12px] font-semibold text-black capitalize">
                              Default currency
                            </span>
                            <select
                              value={currentVal}
                              onChange={(e) =>
                                setDraftValues((prev) => ({
                                  ...prev,
                                  [item.key]: e.target.value,
                                }))
                              }
                              className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] bg-white outline-none"
                            >
                              {selectableCodes.map((code) => {
                                const meta = CURRENCY_OPTIONS.find(
                                  (c) => c.code === code,
                                );
                                return (
                                  <option key={code} value={code}>
                                    {meta
                                      ? `${meta.code} (${meta.symbol}) — ${meta.label}`
                                      : code}
                                  </option>
                                );
                              })}
                            </select>
                            {item.description && (
                              <span className="text-[11px] text-[#8a8a8a]">
                                {item.description}
                              </span>
                            )}
                          </label>
                        );
                      }

                      // 5. Supported Currencies multi-select pill cards — save immediately
                      if (item.key === 'supported_currencies') {
                        const toggleCurrency = (code: string) => {
                          const active = supportedCurrencies.includes(code);
                          if (active && supportedCurrencies.length <= 1) {
                            showToast(
                              'At least one currency must stay enabled.',
                            );
                            return;
                          }
                          const nextList = active
                            ? supportedCurrencies.filter((c) => c !== code)
                            : [...supportedCurrencies, code];
                          const updates: Record<string, string> = {
                            supported_currencies: JSON.stringify(nextList),
                          };
                          if (
                            draftValues.default_currency &&
                            !nextList.includes(
                              draftValues.default_currency.toUpperCase(),
                            )
                          ) {
                            updates.default_currency = nextList[0];
                          }
                          void saveKeysImmediate(
                            updates,
                            item.key,
                            `${code} ${active ? 'disabled' : 'enabled'}.`,
                          );
                        };

                        return (
                          <div
                            key={item.key}
                            className="flex flex-col gap-2 sm:col-span-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12px] font-semibold text-black">
                                Supported currencies
                              </span>
                              <span className="text-[11px] text-[#8a8a8a]">
                                Changes apply immediately at checkout
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {CURRENCY_OPTIONS.map((curr) => {
                                const isSelected = supportedCurrencies.includes(
                                  curr.code,
                                );
                                return (
                                  <button
                                    key={curr.code}
                                    type="button"
                                    disabled={savingKey === item.key}
                                    onClick={() => toggleCurrency(curr.code)}
                                    className={`flex items-center justify-between gap-3 px-2.5 py-2.5 rounded-full border text-left transition-colors disabled:opacity-60 ${
                                      isSelected
                                        ? 'bg-[#ffefe6] border-[#ff6e20] text-black'
                                        : 'bg-[#fafafa] border-[#ececec] text-[#555555] hover:border-[#cccccc]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <span
                                        className={`w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-bold shrink-0 ${
                                          isSelected
                                            ? 'bg-[#ff6e20] text-white'
                                            : 'bg-white border border-[#ececec] text-black'
                                        }`}
                                      >
                                        {curr.symbol}
                                      </span>
                                      <div className="min-w-0">
                                        <p className="text-[13px] font-bold text-black">
                                          {curr.code}
                                        </p>
                                        <p className="text-[11.5px] text-[#767676] truncate">
                                          {curr.label}
                                        </p>
                                      </div>
                                    </div>
                                    <span
                                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                                        isSelected
                                          ? 'bg-[#ff6e20] text-white'
                                          : 'bg-[#eeeeee] text-[#767676]'
                                      }`}
                                    >
                                      {isSelected ? 'Enabled' : 'Disabled'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      // 6. Social Links as normal URL inputs
                      if (item.key === 'social_links') {
                        const linksMap = parseSocialLinks(
                          draftValues[item.key],
                        );
                        const updateSocialLink = (
                          platform: string,
                          urlValue: string,
                        ) => {
                          const nextMap: Record<string, string> = {
                            ...linksMap,
                            [platform]: urlValue,
                          };
                          const cleaned: Record<string, string> = {};
                          Object.entries(nextMap).forEach(([k, v]) => {
                            if (v.trim()) cleaned[k] = v.trim();
                          });
                          setDraftValues((prev) => ({
                            ...prev,
                            social_links: JSON.stringify(cleaned),
                          }));
                        };

                        return (
                          <div
                            key={item.key}
                            className="flex flex-col gap-2.5 sm:col-span-2 bg-[#fafafa] border border-[#ececec] p-2.5 rounded-[14px]"
                          >
                            <div>
                              <span className="text-[12.5px] font-semibold text-black">
                                Social links
                              </span>
                              <p className="text-[11px] text-[#8a8a8a] mt-0.5">
                                Paste normal profile URLs — filled links appear
                                automatically in the marketplace footer.
                              </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {SOCIAL_LINK_FIELDS.map((social) => (
                                <label
                                  key={social.key}
                                  className="flex flex-col gap-1"
                                >
                                  <span className="text-[11.5px] font-semibold text-[#555555]">
                                    {social.label}
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="url"
                                    value={linksMap[social.key] ?? ''}
                                    onChange={(e) =>
                                      updateSocialLink(
                                        social.key,
                                        e.target.value,
                                      )
                                    }
                                    placeholder={social.placeholder}
                                    className="h-[40px] bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[12.5px] text-black outline-none"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      // 7. Standard text / numeric inputs
                      return (
                        <label key={item.key} className="flex flex-col gap-1.5">
                          <span className="text-[12px] font-semibold text-black capitalize">
                            {item.key.replace(/_/g, ' ')}
                          </span>
                          <input
                            type={item.type === 'number' ? 'number' : 'text'}
                            step={item.type === 'number' ? 'any' : undefined}
                            value={draftValues[item.key] ?? ''}
                            onChange={(e) =>
                              setDraftValues((prev) => ({
                                ...prev,
                                [item.key]: e.target.value,
                              }))
                            }
                            className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] outline-none"
                          />
                          {item.description && (
                            <span className="text-[11px] text-[#8a8a8a]">
                              {item.description}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>

                  {editableItems.length > 0 && (
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f1f1f1]">
                      <button
                        type="button"
                        disabled={!isGroupDirty || isThisGroupSaving}
                        onClick={() => void handleSaveGroup(groupName, items)}
                        className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors ${
                          isGroupDirty
                            ? 'bg-[#ff6e20] hover:bg-[#e85d12] text-white cursor-pointer disabled:opacity-60'
                            : 'bg-[#e7f6e7] text-[#029500] cursor-default'
                        }`}
                      >
                        {isThisGroupSaving ? (
                          <span>Saving...</span>
                        ) : isGroupDirty ? (
                          <span>Save</span>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Saved</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* Right Summary Card (Exact Figma Admin · 26) */}
          <aside className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-3.5 rounded-[24px]">
            <h2 className="text-[15.5px] font-bold text-black">
              Live platform controls
            </h2>
            <dl className="flex flex-col divide-y divide-[#f1f1f1] text-[12.5px]">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#767676]">Display KHR Rate</dt>
                <dd className="font-bold text-black">
                  {khrRate.toLocaleString('en-US')} KHR / USD
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#767676]">Store registrations</dt>
                <dd
                  className={`font-semibold ${
                    allowStoreReg ? 'text-[#029500]' : 'text-[#767676]'
                  }`}
                >
                  {allowStoreReg
                    ? autoApproveStores
                      ? 'Open (Auto-approve)'
                      : 'Open (Review required)'
                    : 'Closed'}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#767676]">Maintenance mode</dt>
                <dd
                  className={`font-semibold ${
                    maintenanceMode ? 'text-[#e5322d]' : 'text-[#029500]'
                  }`}
                >
                  {maintenanceMode ? 'Active' : 'Off'}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#767676]">KHQR environment</dt>
                <dd className="font-semibold text-[#029500]">
                  {bakongEnv} (.env)
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#767676]">Bakong API token</dt>
                <dd
                  className={`font-semibold ${
                    bakongTokenItem?.has_value
                      ? 'text-[#029500]'
                      : 'text-[#ff6e20]'
                  }`}
                >
                  {bakongTokenItem?.has_value ? 'Configured' : 'Not set'}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#767676]">Setting groups</dt>
                <dd className="font-semibold text-black">
                  {groupKeys.length} groups
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 8. Enterprise Audit Logs (/admin/audit-logs) — Figma Admin · 29
// ==========================================
export function AdminAuditLogsPage() {
  const { showToast } = useStore();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    try {
      const res = await adminApi.getAuditLogs({
        action: actionFilter.trim() || undefined,
        page,
        per_page: 20,
      });
      setLogs(res.data);
      setLastPage(res.last_page);
      setTotal(res.total);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to load audit logs.',
      );
    } finally {
      setLoading(false);
    }
  }, [actionFilter, page, showToast]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void loadLogs();
    });
    return () => {
      active = false;
    };
  }, [loadLogs]);

  const handleExport = () => {
    exportRowsToCsv(
      `kova-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Timestamp', 'Actor', 'Email', 'Action', 'Store', 'IP Address'],
      logs.map((l) => [
        formatShortDate(l.created_at),
        l.user?.name || 'System',
        l.user?.email || '',
        l.action,
        l.store?.name || '',
        l.ip_address || '',
      ]),
    );
    showToast('Audit log CSV exported.');
  };

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Enterprise audit logs"
        subtitle="Immutable chronological trail of every administrative approval, suspension, and configuration change."
        actions={
          <>
            <div className="flex items-center gap-2 bg-white border border-[#ececec] focus-within:border-[#ff6e20] rounded-full px-3.5 h-[38px] w-full sm:w-[240px]">
              <FigmaIcon name="search" className="w-3.5 h-3.5 text-[#979797]" />
              <input
                type="text"
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter by action..."
                className="flex-1 bg-transparent text-[12.5px] text-black placeholder:text-[#979797] outline-none min-w-0"
              />
            </div>
            <button
              type="button"
              onClick={handleExport}
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors"
            >
              Export audit CSV
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/admin/settings"
          className="px-3.5 py-[7px] rounded-full text-[12px] bg-white text-[#555555] font-medium border border-[#ececec] hover:border-[#cccccc] hover:text-black"
        >
          Platform Settings
        </Link>
        <span className="px-3.5 py-[7px] rounded-full text-[12px] bg-[#ff6e20] text-white font-semibold">
          Audit Logs
        </span>
      </div>

      <section className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-2.5 sm:gap-3 rounded-[24px]">
        <h2 className="text-[15.5px] font-bold text-black">
          Recent administrative events
        </h2>

        {loading ? (
          <DashboardTableSkeleton rows={6} />
        ) : logs.length === 0 ? (
          <p className="py-12 text-center bg-[#f7f7f7] text-[13.5px] text-[#767676] rounded-[14px]">
            No audit log entries recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                  <th className="py-2.5 px-3.5 rounded-l-[10px]">Timestamp</th>
                  <th className="py-2.5 px-3.5">Actor</th>
                  <th className="py-2.5 px-3.5">Action</th>
                  <th className="py-2.5 px-3.5">Target</th>
                  <th className="py-2.5 px-3.5">IP Address</th>
                  <th className="py-2.5 px-3.5 rounded-r-[10px] text-right">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                {logs.map((log) => {
                  const isNegative =
                    log.action.includes('suspend') ||
                    log.action.includes('reject') ||
                    log.action.includes('delete');
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-[#fafafa] transition-colors"
                    >
                      <td className="py-3.5 px-3.5 font-semibold text-black whitespace-nowrap">
                        {formatShortDate(log.created_at)}
                      </td>
                      <td className="py-3.5 px-3.5">
                        <p className="font-semibold text-black">
                          {log.user?.name || 'System'}
                        </p>
                        <p className="text-[11px] text-[#8a8a8a]">
                          {log.user?.email || 'Automated'}
                        </p>
                      </td>
                      <td className="py-3.5 px-3.5 font-mono text-[12px] text-[#333333]">
                        {log.action}
                      </td>
                      <td className="py-3.5 px-3.5 text-[#555555]">
                        {log.store?.name ||
                          (log.entity_type
                            ? `${log.entity_type} #${log.entity_id ?? ''}`
                            : 'Platform')}
                      </td>
                      <td className="py-3.5 px-3.5 font-mono text-[12px] text-[#767676]">
                        {log.ip_address || '—'}
                      </td>
                      <td className="py-3.5 px-3.5 text-right">
                        <StatusPill
                          label={isNegative ? 'Enforced' : 'Success'}
                          tone={isNegative ? 'red' : 'green'}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <TablePagination
          page={page}
          lastPage={lastPage}
          total={total}
          perPage={20}
          itemLabel="events"
          onPageChange={setPage}
        />
      </section>
    </div>
  );
}
