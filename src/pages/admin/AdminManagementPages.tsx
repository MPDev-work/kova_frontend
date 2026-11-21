import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { ApiError } from '../../services/api';
import {
  adminApi,
  type AdminBakongAccount,
  type AdminBakongOverview,
  type AdminBrandItem,
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
        prev ? res.data.find((u) => u.id === prev.id) ?? null : null,
      );
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to load users.');
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
      customer: users.filter((u) =>
        u.roles.some((r) => r.slug === 'customer'),
      ).length,
      store_owner: users.filter((u) =>
        u.roles.some((r) => r.slug === 'store_owner'),
      ).length,
      admin: users.filter((u) => u.roles.some((r) => r.slug === 'admin')).length,
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
      showToast(err instanceof ApiError ? err.message : 'Unable to save roles.');
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

      <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
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
          <div className="py-14 text-center bg-[#f7f7f7] rounded-[14px] text-[13.5px] text-[#767676]">
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
                            <span className="w-9 h-9 rounded-[10px] bg-[#f4f4f4] text-black text-[12px] font-bold flex items-center justify-center shrink-0">
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
            <div className="bg-[#f7f7f7] rounded-[14px] p-4 flex items-center justify-between">
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
                Assigned roles
              </h3>
              <p className="text-[12px] text-[#767676]">
                Select the roles granted to this user. At least one role is
                required.
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
                    <label
                      key={r.slug}
                      className={`flex items-start gap-3 border rounded-[14px] p-3.5 cursor-pointer transition-colors ${
                        checked
                          ? 'border-[#ff6e20] bg-[#fff9f5]'
                          : 'border-[#ececec] hover:border-[#cccccc]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setDraftRoles((prev) =>
                            prev.includes(r.slug)
                              ? prev.filter((x) => x !== r.slug)
                              : [...prev, r.slug],
                          )
                        }
                        className="mt-1 accent-[#ff6e20]"
                      />
                      <div>
                        <p className="text-[13px] font-semibold text-black">
                          {r.title}
                        </p>
                        <p className="text-[11.5px] text-[#767676] mt-0.5">
                          {r.desc}
                        </p>
                      </div>
                    </label>
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
  const [tab, setTab] = useState<'categories' | 'brands'>('categories');
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<AdminCategoryItem[]>([]);
  const [brands, setBrands] = useState<AdminBrandItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Category drawer state (supports create + edit)
  const [catDrawerOpen, setCatDrawerOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<AdminCategoryItem | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catCommission, setCatCommission] = useState('');
  const [catOrder, setCatOrder] = useState('0');
  const [catActive, setCatActive] = useState(true);
  const [savingCat, setSavingCat] = useState(false);

  // Brand drawer state (supports create + edit)
  const [brandDrawerOpen, setBrandDrawerOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<AdminBrandItem | null>(null);
  const [brandName, setBrandName] = useState('');
  const [brandWebsite, setBrandWebsite] = useState('');
  const [brandDesc, setBrandDesc] = useState('');
  const [brandLogo, setBrandLogo] = useState('');
  const [brandActive, setBrandActive] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      const [cats, brs] = await Promise.all([
        adminApi.getCategories(),
        adminApi.getBrands(100),
      ]);
      setCategories(cats);
      setBrands(brs.data);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to load catalog.',
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

  const handleDeleteCategory = async (c: AdminCategoryItem) => {
    try {
      await adminApi.deleteCategory(c.id);
      showToast(`Deleted "${c.name}".`);
      await Promise.all([loadCatalog(), refreshCatalog()]);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to delete category.',
      );
    }
  };

  const openNewBrand = () => {
    setEditingBrand(null);
    setBrandName('');
    setBrandWebsite('');
    setBrandDesc('');
    setBrandLogo('');
    setBrandActive(true);
    setBrandDrawerOpen(true);
  };

  const openEditBrand = (b: AdminBrandItem) => {
    setEditingBrand(b);
    setBrandName(b.name);
    setBrandWebsite(b.website || '');
    setBrandDesc(b.description || '');
    setBrandLogo(b.logo || '');
    setBrandActive(Boolean(b.is_active));
    setBrandDrawerOpen(true);
  };

  const handleUploadBrandLogo = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const media = await adminApi.uploadMedia(file, 'brands');
      setBrandLogo(media.secure_url);
      showToast('Image uploaded successfully.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Logo upload failed.');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) return;
    setSavingBrand(true);
    try {
      const payload = {
        name: brandName.trim(),
        website: brandWebsite.trim() || null,
        description: brandDesc.trim() || null,
        logo: brandLogo.trim() || null,
        is_active: brandActive,
      };
      if (editingBrand) {
        await adminApi.updateBrand(editingBrand.id, payload);
        showToast('Brand updated.');
      } else {
        await adminApi.createBrand(payload);
        showToast('Brand created.');
      }
      setBrandDrawerOpen(false);
      await Promise.all([loadCatalog(), refreshCatalog()]);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to save brand.',
      );
    } finally {
      setSavingBrand(false);
    }
  };

  const handleDeleteBrand = async (b: AdminBrandItem) => {
    try {
      await adminApi.deleteBrand(b.id);
      showToast(`Deleted "${b.name}".`);
      await Promise.all([loadCatalog(), refreshCatalog()]);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to delete brand.',
      );
    }
  };

  const q = search.trim().toLowerCase();
  const filteredCats = categories.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q),
  );
  const filteredBrands = brands.filter(
    (b) =>
      !q ||
      b.name.toLowerCase().includes(q) ||
      b.slug.toLowerCase().includes(q),
  );

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Categories & brands"
        subtitle="Control marketplace taxonomy hierarchy, commission rates, and verified brands."
        actions={
          <button
            type="button"
            onClick={tab === 'categories' ? openNewCategory : openNewBrand}
            className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors"
          >
            {tab === 'categories' ? 'Add category' : 'Add brand'}
          </button>
        }
      />

      <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterPillTabs<'categories' | 'brands'>
            value={tab}
            onChange={setTab}
            options={[
              {
                id: 'categories',
                label: 'Categories',
                count: categories.length,
              },
              { id: 'brands', label: 'Brands', count: brands.length },
            ]}
          />

          <div className="flex items-center gap-2 bg-[#f7f7f7] border border-[#ececec] focus-within:border-[#ff6e20] focus-within:bg-white rounded-full px-3.5 h-[36px] w-full sm:w-[240px] transition-colors">
            <FigmaIcon name="search" className="w-3.5 h-3.5 text-[#979797]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === 'categories' ? 'Search categories...' : 'Search brands...'
              }
              className="flex-1 bg-transparent text-[12.5px] text-black placeholder:text-[#979797] outline-none min-w-0"
            />
          </div>
        </div>

        {loading ? (
          <DashboardTableSkeleton rows={6} />
        ) : tab === 'categories' ? (
          filteredCats.length === 0 ? (
            <div className="py-14 text-center bg-[#f7f7f7] rounded-[14px] flex flex-col items-center gap-3">
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
                          <span className="w-9 h-9 rounded-[10px] bg-[#f7f7f7] border border-[#ececec] text-[#ff6e20] flex items-center justify-center shrink-0">
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
          )
        ) : filteredBrands.length === 0 ? (
          <div className="py-14 text-center bg-[#f7f7f7] rounded-[14px] flex flex-col items-center gap-3">
            <p className="text-[14px] font-semibold text-black">
              No brands found
            </p>
            <button
              type="button"
              onClick={openNewBrand}
              className="bg-[#ff6e20] text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
            >
              Create first brand
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                  <th className="py-2.5 px-3.5 rounded-l-[10px]">Brand</th>
                  <th className="py-2.5 px-3.5">SEO slug</th>
                  <th className="py-2.5 px-3.5">Website</th>
                  <th className="py-2.5 px-3.5">Products</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5 rounded-r-[10px] text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f1f1] text-[13px]">
                {filteredBrands.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-[#fafafa] transition-colors"
                  >
                    <td className="py-3.5 px-3.5">
                      <div className="flex items-center gap-3">
                        {b.logo ? (
                          <img
                            src={b.logo}
                            alt={b.name}
                            className="w-9 h-9 rounded-[10px] object-contain border border-[#ececec] bg-white p-1 shrink-0"
                          />
                        ) : (
                          <span className="w-9 h-9 rounded-[10px] bg-[#ffefe6] text-[#ff6e20] text-[12px] font-bold flex items-center justify-center shrink-0">
                            {b.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="font-semibold text-black">
                          {b.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5 font-mono text-[12px] text-[#767676]">
                      /{b.slug}
                    </td>
                    <td className="py-3.5 px-3.5 text-[#767676] truncate max-w-[200px]">
                      {b.website || '—'}
                    </td>
                    <td className="py-3.5 px-3.5 font-semibold text-black">
                      {b.products_count ?? 0}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <StatusPill
                        label={b.is_active ? 'Active' : 'Hidden'}
                        tone={b.is_active ? 'green' : 'neutral'}
                      />
                    </td>
                    <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openEditBrand(b)}
                          className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteBrand(b)}
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
        title={editingCat ? `Edit category · ${editingCat.name}` : 'Add global category'}
        subtitle="Marketplace categories are available to all approved store owners."
        footer={
          <>
            <button
              type="button"
              onClick={() => setCatDrawerOpen(false)}
              className="bg-white border border-[#ececec] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full"
            >
              Cancel
            </button>
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
          </>
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
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
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
                className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
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
                className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
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
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] p-3 text-[13.5px] outline-none"
            />
          </label>
          <label className="flex items-center gap-2.5 text-[13px] font-medium text-black">
            <input
              type="checkbox"
              checked={catActive}
              onChange={(e) => setCatActive(e.target.checked)}
              className="accent-[#ff6e20]"
            />
            Visible on Kova Marketplace
          </label>
        </form>
      </SlideOverDrawer>

      {/* Brand Create/Edit Drawer */}
      <SlideOverDrawer
        open={brandDrawerOpen}
        onClose={() => setBrandDrawerOpen(false)}
        title={editingBrand ? `Edit brand · ${editingBrand.name}` : 'Add global brand'}
        subtitle="Upload crisp brand logos for verified brand discovery."
        footer={
          <>
            <button
              type="button"
              onClick={() => setBrandDrawerOpen(false)}
              className="bg-white border border-[#ececec] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="admin-brand-form"
              disabled={savingBrand || uploadingLogo}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
            >
              {savingBrand
                ? 'Saving...'
                : editingBrand
                  ? 'Save changes'
                  : 'Create brand'}
            </button>
          </>
        }
      >
        <form
          id="admin-brand-form"
          onSubmit={handleSaveBrand}
          className="flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Brand name
            </span>
            <input
              type="text"
              required
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="e.g. Sony, Anker, Apple"
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Website URL (optional)
            </span>
            <input
              type="url"
              value={brandWebsite}
              onChange={(e) => setBrandWebsite(e.target.value)}
              placeholder="https://..."
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Description
            </span>
            <textarea
              rows={2}
              value={brandDesc}
              onChange={(e) => setBrandDesc(e.target.value)}
              className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] p-3 text-[13.5px] outline-none"
            />
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-semibold text-black">
              Brand logo
            </span>
            <label className="border border-dashed border-[#ff6e20]/60 bg-[#fff9f5] hover:bg-[#ffefe6]/60 transition-colors rounded-[14px] p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center">
              <FigmaIcon name="upload" className="w-5 h-5 text-[#ff6e20]" />
              <span className="text-[12.5px] font-semibold text-[#ff6e20]">
                {uploadingLogo ? 'Uploading image...' : 'Upload brand logo'}
              </span>
              <span className="text-[11px] text-[#8a8a8a]">
                PNG, JPG, WebP
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleUploadBrandLogo}
                className="hidden"
              />
            </label>
            {brandLogo && (
              <div className="flex items-center gap-3 pt-1">
                <img
                  src={brandLogo}
                  alt="Brand preview"
                  className="w-12 h-12 rounded-[10px] object-contain border border-[#ececec] bg-white p-1"
                />
                <button
                  type="button"
                  onClick={() => setBrandLogo('')}
                  className="text-[12px] font-semibold text-[#e5322d] hover:underline"
                >
                  Remove logo
                </button>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2.5 text-[13px] font-medium text-black">
            <input
              type="checkbox"
              checked={brandActive}
              onChange={(e) => setBrandActive(e.target.checked)}
              className="accent-[#ff6e20]"
            />
            Active brand
          </label>
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
          badge: 'Live',
          tone: overview.transactions.pending_count > 0 ? 'orange' : 'neutral',
        },
        {
          label: 'Expired / Failed',
          value: String(overview.transactions.failed_count),
          sub: `${overview.stores.disconnected_or_expired} expired merchant tokens`,
          badge: overview.transactions.failed_count > 0 ? 'Investigate' : 'Clean',
          tone: overview.transactions.failed_count > 0 ? 'red' : 'green',
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Payments & transactions"
        subtitle="Platform-wide NBC Bakong KHQR financial ledger and connected merchant accounts."
        actions={
          <>
            {overview && (
              <span className="bg-white border border-[#ececec] text-[#555555] text-[12px] font-semibold px-3.5 py-2 rounded-full uppercase">
                ENV: {overview.environment}
              </span>
            )}
            <button
              type="button"
              onClick={handleExportLedger}
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors"
            >
              Export ledger
            </button>
          </>
        }
      />

      {loading || !overview ? (
        <>
          <DashboardKpiSkeleton count={4} />
          <DashboardTableSkeleton rows={6} />
        </>
      ) : (
        <>
          <KpiGrid items={kpis} />

          <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
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

              {tab !== 'merchants' && (
                <div className="flex items-center gap-2 bg-[#f7f7f7] border border-[#ececec] focus-within:border-[#ff6e20] focus-within:bg-white rounded-full px-3.5 h-[36px] w-full sm:w-[240px]">
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
            </div>

            {tab === 'merchants' ? (
              accounts.length === 0 ? (
                <p className="py-12 text-center bg-[#f7f7f7] rounded-[14px] text-[13.5px] text-[#767676]">
                  No stores have connected a Bakong account yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f7f7f7] text-[11.5px] font-semibold text-[#767676]">
                        <th className="py-2.5 px-3.5 rounded-l-[10px]">Store</th>
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
              <p className="py-12 text-center bg-[#f7f7f7] rounded-[14px] text-[13.5px] text-[#767676]">
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

      <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
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
          <>
            <button
              type="button"
              onClick={() => setActiveDispute(null)}
              className="bg-white border border-[#ececec] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="admin-dispute-form"
              disabled={submitting}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
            >
              {submitting ? 'Submitting...' : 'Submit resolution'}
            </button>
          </>
        }
      >
        {activeDispute && (
          <form
            id="admin-dispute-form"
            onSubmit={handleResolve}
            className="flex flex-col gap-4"
          >
            <div className="bg-[#f7f7f7] rounded-[14px] p-4 flex flex-col gap-1.5 text-[12.5px]">
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
                  Disputed amount: ${Number(activeDispute.refund.amount).toFixed(2)}
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
                className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] bg-white outline-none"
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
export function AdminSettingsPage() {
  const { showToast, refreshCatalog, khrRate } = useStore();
  const [grouped, setGrouped] = useState<Record<string, PlatformSettingItem[]>>(
    {},
  );
  const [initialValues, setInitialValues] = useState<Record<string, string>>(
    {},
  );
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = Object.entries(draftValues).map(([key, value]) => ({
        key,
        value,
      }));
      await adminApi.updateSettings(payload);
      setInitialValues({ ...draftValues });
      await refreshCatalog();
      showToast('System configuration saved.');
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to save settings.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Platform & system settings"
        subtitle="Configure marketplace identity, USD/KHR exchange rate, commission defaults, and global controls."
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                setDraftValues({ ...initialValues });
                showToast('Unsaved changes discarded.');
              }}
              className="bg-white border border-[#ececec] hover:border-[#cccccc] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full transition-colors"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full transition-colors"
            >
              {saving ? 'Saving...' : 'Save system config'}
            </button>
          </>
        }
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
            {visibleEntries.map(([groupName, items]) => (
              <section
                key={groupName}
                className="bg-white border border-[#ececec] rounded-[18px] p-5 flex flex-col gap-4"
              >
                <h2 className="text-[15.5px] font-bold text-black capitalize">
                  {groupName.replace(/_/g, ' ')} settings
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {items.map((item) => (
                    <label key={item.key} className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold text-black capitalize">
                        {item.key.replace(/_/g, ' ')}
                      </span>
                      <input
                        type="text"
                        value={draftValues[item.key] ?? ''}
                        onChange={(e) =>
                          setDraftValues((prev) => ({
                            ...prev,
                            [item.key]: e.target.value,
                          }))
                        }
                        className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none"
                      />
                      {item.description && (
                        <span className="text-[11px] text-[#8a8a8a]">
                          {item.description}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Right Summary Card (Exact Figma Admin · 26) */}
          <aside className="bg-white border border-[#ececec] rounded-[18px] p-5 flex flex-col gap-3.5">
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
                <dd className="font-semibold text-[#029500]">
                  Open (KYC required)
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#767676]">KHQR gateway</dt>
                <dd className="font-semibold text-[#029500]">NBC Bakong</dd>
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
    </form>
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

      <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4">
        <h2 className="text-[15.5px] font-bold text-black">
          Recent administrative events
        </h2>

        {loading ? (
          <DashboardTableSkeleton rows={6} />
        ) : logs.length === 0 ? (
          <p className="py-12 text-center bg-[#f7f7f7] rounded-[14px] text-[13.5px] text-[#767676]">
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
