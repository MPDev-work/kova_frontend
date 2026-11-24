import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useDashboardTheme } from '../../utils/useDashboardTheme';
import { adminApi } from '../../services/dashboardApi';
import { FigmaIcon, type FigmaIconName } from '../../components/FigmaIcon';
import { KovaLogo } from '../../components/KovaLogo';
import { NotificationModal } from '../../components/NotificationModal';
import { CustomerSettingsSkeleton } from '../../components/Skeleton';
import { VerifiedBadge } from '../../components/VerifiedBadge';

interface AdminNavGroup {
  title: string;
  items: {
    label: string;
    to: string;
    icon: FigmaIconName;
    badge?: number;
    badgeTone?: 'orange' | 'red' | 'neutral';
    exact?: boolean;
  }[];
}

function getAdminBreadcrumbs(pathname: string): string[] {
  if (pathname === '/admin' || pathname === '/admin/') {
    return ['Kova Global', 'Platform Overview'];
  }
  if (pathname.startsWith('/admin/stores')) {
    return ['Kova Global', 'Stores', 'All Stores'];
  }
  if (pathname.startsWith('/admin/users')) {
    return ['Kova Global', 'Users & Roles'];
  }
  if (pathname.startsWith('/admin/catalog')) {
    return ['Kova Global', 'Categories'];
  }
  if (pathname.startsWith('/admin/bakong')) {
    return ['Kova Global', 'Payments & Transactions'];
  }
  if (pathname.startsWith('/admin/shipping')) {
    return ['Kova Global', 'Shipping & Logistics'];
  }
  if (pathname.startsWith('/admin/disputes')) {
    return ['Kova Global', 'Support & Disputes'];
  }
  if (pathname.startsWith('/admin/tickets')) {
    return ['Kova Global', 'Support Tickets'];
  }
  if (pathname.startsWith('/admin/settings')) {
    return ['Kova Global', 'Settings', 'Platform Config'];
  }
  if (pathname.startsWith('/admin/account')) {
    return ['Kova Global', 'Account Settings'];
  }
  if (pathname.startsWith('/admin/audit-logs')) {
    return ['Kova Global', 'Settings', 'Audit Logs'];
  }
  return ['Kova Global', 'Root Admin'];
}

export function AdminLayout() {
  const { bootstrapping, isSignedIn, user, unreadNotificationsCount, signOut } =
    useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const { isDark, toggleTheme } = useDashboardTheme('admin');
  const [pendingAppsCount, setPendingAppsCount] = useState(0);
  const [openDisputesCount, setOpenDisputesCount] = useState(0);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);

  const isAdmin = Boolean(
    user?.roles?.some((r) => r === 'admin' || r === 'root_admin'),
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    Promise.allSettled([
      adminApi.getDashboard(),
      adminApi.getDisputes({ status: 'open' }),
      adminApi.getTickets({ status: 'open', per_page: 1 }),
    ]).then(([dashRes, dispRes, ticketRes]) => {
      if (!active) return;
      if (dashRes.status === 'fulfilled') {
        setPendingAppsCount(dashRes.value.metrics.pending_store_applications);
        setPendingPaymentsCount(dashRes.value.metrics.pending_payments_count);
      }
      if (dispRes.status === 'fulfilled') {
        setOpenDisputesCount(dispRes.value.total);
      }
      if (ticketRes.status === 'fulfilled') {
        setOpenTicketsCount(ticketRes.value.stats?.open ?? 0);
      }
    });
    return () => {
      active = false;
    };
  }, [isAdmin, location.pathname]);

  if (bootstrapping) {
    return <CustomerSettingsSkeleton />;
  }

  if (!isSignedIn || !user) {
    return (
      <div className="min-h-screen w-full bg-[#f7f7f7] flex items-center justify-center p-4">
        <div className="bg-white border border-[#ececec] rounded-[24px] p-8 max-w-[440px] w-full text-center flex flex-col items-center gap-4">
          <KovaLogo size="sm" />
          <h1 className="text-[22px] font-bold text-black">
            Sign in as Root Administrator
          </h1>
          <p className="text-[13.5px] text-[#767676]">
            Authenticate with a Kova Root Admin account to manage stores, users,
            Bakong payments, and platform settings.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Link
              to="/login"
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13.5px] font-semibold px-6 py-2.5 rounded-full"
            >
              Sign in
            </Link>
            <Link
              to="/"
              className="bg-white border border-[#ececec] hover:border-black text-black text-[13.5px] font-semibold px-6 py-2.5 rounded-full"
            >
              Back to marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen w-full bg-[#f7f7f7] flex items-center justify-center p-4">
        <div className="bg-white border border-[#ececec] rounded-[24px] p-8 max-w-[460px] w-full text-center flex flex-col items-center gap-4">
          <KovaLogo size="sm" />
          <h1 className="text-[22px] font-bold text-black">
            Root Admin access required
          </h1>
          <p className="text-[13.5px] text-[#767676]">
            Your account ({user.email}) does not have Root Administrator
            permissions.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Link
              to="/"
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13.5px] font-semibold px-6 py-2.5 rounded-full"
            >
              Back to marketplace
            </Link>
            <Link
              to="/account/profile"
              className="bg-white border border-[#ececec] hover:border-black text-black text-[13.5px] font-semibold px-6 py-2.5 rounded-full"
            >
              Account settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const initials = user.name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const totalAlerts =
    unreadNotificationsCount > 0
      ? unreadNotificationsCount
      : openTicketsCount + openDisputesCount;

  const navGroups: AdminNavGroup[] = [
    {
      title: 'PLATFORM',
      items: [
        { label: 'Overview', to: '/admin', icon: 'home', exact: true },
        {
          label: 'Stores',
          to: '/admin/stores',
          icon: 'shopping-bag',
          badge: pendingAppsCount > 0 ? pendingAppsCount : undefined,
          badgeTone: 'orange',
        },
        { label: 'Users & Roles', to: '/admin/users', icon: 'user' },
      ],
    },
    {
      title: 'COMMERCE',
      items: [
        {
          label: 'Categories',
          to: '/admin/catalog',
          icon: 'tag',
        },
        {
          label: 'Payments & Bakong',
          to: '/admin/bakong',
          icon: 'zap',
          badge: pendingPaymentsCount > 0 ? pendingPaymentsCount : undefined,
          badgeTone: 'neutral',
        },
        {
          label: 'Shipping & Logistics',
          to: '/admin/shipping',
          icon: 'truck',
        },
      ],
    },
    {
      title: 'TRUST & SYSTEM',
      items: [
        {
          label: 'Support Tickets',
          to: '/admin/tickets',
          icon: 'mail',
          badge: openTicketsCount > 0 ? openTicketsCount : undefined,
          badgeTone: 'orange',
        },
        {
          label: 'Support & Disputes',
          to: '/admin/disputes',
          icon: 'help-circle',
          badge: openDisputesCount > 0 ? openDisputesCount : undefined,
          badgeTone: 'red',
        },
        {
          label: 'Security & Settings',
          to: '/admin/settings',
          icon: 'sliders',
        },
        {
          label: 'Account Settings',
          to: '/admin/account',
          icon: 'lock',
        },
        {
          label: 'Audit Logs',
          to: '/admin/audit-logs',
          icon: 'shield',
        },
      ],
    },
  ];

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = quickQuery.trim();
    if (!q) return;
    if (q.includes('@')) {
      navigate(`/admin/users?search=${encodeURIComponent(q)}`);
    } else {
      navigate(`/admin/stores?search=${encodeURIComponent(q)}`);
    }
  };

  const isNavActive = (item: AdminNavGroup['items'][number]) =>
    item.exact
      ? location.pathname === item.to || location.pathname === `${item.to}/`
      : location.pathname.startsWith(item.to);

  const crumbs = getAdminBreadcrumbs(location.pathname);
  const isFullBleedPage = location.pathname.startsWith('/admin/tickets');

  const renderSidebarBody = (isMobile: boolean) => (
    <>
      <div className="flex flex-col gap-5 overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between gap-2 px-1.5 pt-0.5">
          <KovaLogo size="sm" to="/admin" />
          {isMobile && (
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close sidebar"
              className="w-8 h-8 rounded-[10px] bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#767676] flex items-center justify-center transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <nav className="flex flex-col gap-4">
          {navGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-0.5">
              <p className="px-2.5 pb-1 text-[10px] font-bold text-[#979797] tracking-[0.06em]">
                {group.title}
              </p>
              {group.items.map((item) => {
                const active = isNavActive(item);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => {
                      if (isMobile) setMobileSidebarOpen(false);
                    }}
                    className={`flex items-center justify-between px-2.5 py-[8.5px] rounded-[11px] text-[13px] transition-colors ${
                      active
                        ? 'bg-[#ffefe6] text-[#ff6e20] font-semibold'
                        : 'text-[#1c1c1c] font-medium hover:bg-[#f7f7f7]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <FigmaIcon
                        name={item.icon}
                        className={`w-[15px] h-[15px] ${
                          active ? 'text-[#ff6e20]' : 'text-[#6e6e6e]'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-bold px-[7px] py-[1px] rounded-full ${
                          item.badgeTone === 'red'
                            ? 'bg-[#fdecec] text-[#e5322d]'
                            : item.badgeTone === 'orange'
                              ? 'bg-[#ffefe6] text-[#ff6e20]'
                              : 'bg-[#f4f4f4] text-[#767676]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      <div className="pt-3">
        <button
          type="button"
          onClick={() => {
            setMobileSidebarOpen(false);
            void signOut().then(() => navigate('/login'));
          }}
          className="w-full h-[42px] bg-[#f7f7f7] hover:bg-[#fdecec] border border-[#ececec] hover:border-[#e5322d]/30 text-[#555555] hover:text-[#e5322d] rounded-full px-4 flex items-center justify-center gap-2 text-[13px] font-semibold transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Log out</span>
        </button>
      </div>
    </>
  );

  return (
    <div
      className={`relative w-full overflow-x-clip bg-[#f7f7f7] text-black flex ${
        isFullBleedPage ? 'h-[100dvh] overflow-hidden' : 'min-h-screen'
      }`}
    >
      {/* Mobile Push Sidebar (240px) */}
      <aside
        aria-hidden={!mobileSidebarOpen}
        className={`lg:hidden fixed inset-y-0 left-0 z-40 w-[240px] px-[14px] py-[16px] flex flex-col justify-between bg-white border-r border-[#ececec] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          mobileSidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full pointer-events-none'
        }`}
      >
        {renderSidebarBody(true)}
      </aside>

      {/* Persistent Left Enterprise Sidebar (Desktop) */}
      <aside
        className={`${
          sidebarOpen
            ? 'w-[252px] px-[14px]'
            : 'w-0 px-0 overflow-hidden border-r-0'
        } hidden lg:flex flex-col justify-between bg-white border-r border-[#ececec] py-[16px] sticky top-0 h-screen shrink-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]`}
      >
        {renderSidebarBody(false)}
      </aside>

      {/* Persistent Right Workspace (shifts +240px smoothly when mobile sidebar opens) */}
      <div
        className={`relative flex-1 min-w-0 flex flex-col ${
          isFullBleedPage ? 'h-full overflow-hidden' : 'min-h-screen'
        } transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          mobileSidebarOpen
            ? 'translate-x-[240px] lg:translate-x-0'
            : 'translate-x-0'
        }`}
      >
        {mobileSidebarOpen && (
          <div
            role="presentation"
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden absolute inset-0 z-40 bg-black/20 cursor-pointer"
          />
        )}

        <header className="h-[68px] bg-white border-b border-[#ececec] px-4 lg:px-7 flex items-center justify-between gap-3 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen((v) => !v)}
              aria-label="Toggle navigation sidebar"
              aria-expanded={mobileSidebarOpen}
              className="lg:hidden inline-flex items-center justify-center bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#767676] w-9 h-9 rounded-[10px] transition-colors shrink-0 cursor-pointer"
            >
              <FigmaIcon name="sidebar" className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle sidebar"
              className="hidden lg:inline-flex items-center justify-center bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#767676] w-9 h-9 rounded-[10px] transition-colors shrink-0 cursor-pointer"
            >
              <FigmaIcon name="sidebar" className="w-4 h-4" />
            </button>
            <div className="lg:hidden">
              <KovaLogo size="sm" to="/admin" />
            </div>
            <nav
              aria-label="Breadcrumb"
              className="hidden sm:flex items-center gap-1.5 text-[13px] font-medium text-[#767676] truncate"
            >
              {crumbs.map((c, idx) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 truncate"
                >
                  {idx > 0 && <span className="text-[#c5c5c5]">/</span>}
                  <span
                    className={
                      idx === crumbs.length - 1
                        ? 'text-black font-semibold truncate'
                        : 'truncate'
                    }
                  >
                    {c}
                  </span>
                </span>
              ))}
            </nav>
          </div>

          <form
            onSubmit={handleQuickSearch}
            className="hidden md:flex items-center gap-2.5 h-[38px] w-[260px] xl:w-[330px] bg-[#f7f7f7] border border-[#ececec] focus-within:border-[#ff6e20] focus-within:bg-white rounded-full px-3.5 transition-colors"
          >
            <FigmaIcon name="search" className="w-3.5 h-3.5 text-[#979797]" />
            <input
              ref={searchInputRef}
              type="text"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="Search stores, users, orders..."
              className="flex-1 bg-transparent text-[12.5px] text-black placeholder:text-[#979797] outline-none min-w-0"
            />
            <kbd className="hidden xl:inline-flex items-center bg-white border border-[#e5e5e5] rounded-[6px] px-1.5 py-0.5 text-[10px] font-semibold text-[#8a8a8a]">
              Ctrl K
            </kbd>
          </form>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                isDark ? 'Switch to light mode' : 'Switch to dark mode'
              }
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex items-center justify-center bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] border border-[#ececec] text-black w-9 h-9 rounded-full transition-colors cursor-pointer"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-[#ff6e20]" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setNotifModalOpen(true)}
              aria-label="Notifications"
              className="relative inline-flex items-center justify-center bg-[#f7f7f7] hover:bg-[#ffefe6] border border-[#ececec] text-black h-9 px-2.5 rounded-full gap-1.5 transition-colors"
            >
              <FigmaIcon name="bell" className="w-4 h-4 text-black" />
              {totalAlerts > 0 && (
                <span className="bg-[#ff6e20] text-white text-[10px] font-bold px-1.5 py-[1px] rounded-full leading-tight">
                  {totalAlerts}
                </span>
              )}
            </button>

            <Link
              to="/admin/account"
              className="hidden sm:flex items-center gap-2 bg-[#f7f7f7] hover:bg-[#f0f0f0] border border-[#ececec] rounded-full pl-1.5 pr-3.5 py-1 transition-colors"
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <span className="w-7 h-7 rounded-full bg-black text-white text-[10.5px] font-bold flex items-center justify-center">
                  {initials}
                </span>
              )}
              <div className="leading-tight">
                <p className="text-[12px] font-semibold text-black flex items-center gap-1">
                  <span className="max-w-[110px] truncate">{user.name}</span>
                  <VerifiedBadge size="xs" />
                </p>
                <p className="text-[10px] font-semibold text-[#ff6e20]">
                  Root Admin
                </p>
              </div>
            </Link>
          </div>
        </header>

        {/* ONLY INNER OUTLET SWAPS ON NAVIGATION */}
        <main
          className={
            isFullBleedPage
              ? 'flex-1 min-h-0 w-full h-full p-0 overflow-hidden flex flex-col'
              : 'flex-1 w-full max-w-[1320px] mx-auto px-4 lg:px-7 py-6'
          }
        >
          <Outlet />
        </main>
      </div>
      <NotificationModal
        open={notifModalOpen}
        onClose={() => setNotifModalOpen(false)}
      />
    </div>
  );
}
