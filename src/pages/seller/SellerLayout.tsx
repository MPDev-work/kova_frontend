import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useDashboardTheme } from '../../utils/useDashboardTheme';
import {
  storeOwnerApi,
  type SellerDashboardData,
  type SellerStoreProfile,
} from '../../services/dashboardApi';
import { FigmaIcon, type FigmaIconName } from '../../components/FigmaIcon';
import { KovaLogo } from '../../components/KovaLogo';
import { NotificationModal } from '../../components/NotificationModal';
import { CustomerSettingsSkeleton } from '../../components/Skeleton';
import { VerifiedBadge } from '../../components/VerifiedBadge';

interface SellerNavItem {
  label: string;
  to: string;
  icon: FigmaIconName;
  badge?: string | number;
  badgeTone?: 'orange' | 'red' | 'neutral';
  exact?: boolean;
}

function getSellerBreadcrumbs(storeName: string, pathname: string): string[] {
  if (pathname === '/seller' || pathname === '/seller/') {
    return [storeName, 'Overview'];
  }
  if (pathname.startsWith('/seller/products/new')) {
    return [storeName, 'Products', 'Add product'];
  }
  if (pathname.includes('/seller/products/') && pathname.endsWith('/edit')) {
    return [storeName, 'Products', 'Edit product'];
  }
  if (pathname.startsWith('/seller/products')) {
    return [storeName, 'Products', 'All products'];
  }
  if (pathname.startsWith('/seller/inventory')) {
    return [storeName, 'Inventory'];
  }
  if (pathname.startsWith('/seller/orders')) {
    return [storeName, 'Orders'];
  }
  if (pathname.startsWith('/seller/reviews')) {
    return [storeName, 'Customer Reviews'];
  }
  if (pathname.startsWith('/seller/followers')) {
    return [storeName, 'Followers'];
  }
  if (pathname.startsWith('/seller/messages')) {
    return [storeName, 'Customer Messages'];
  }
  if (pathname.startsWith('/seller/promotions')) {
    return [storeName, 'Discounts & Promotions'];
  }
  if (pathname.startsWith('/seller/bakong')) {
    return [storeName, 'Payments', 'Bakong KHQR'];
  }
  if (pathname.startsWith('/seller/payouts')) {
    return [storeName, 'Finance', 'Payouts & Banks'];
  }
  if (pathname.startsWith('/seller/storefront')) {
    return [storeName, 'Storefront', 'Profile & Policies'];
  }
  if (pathname.startsWith('/seller/preview')) {
    return [storeName, 'Storefront Preview'];
  }
  if (pathname.startsWith('/seller/settings')) {
    return [storeName, 'Account Settings'];
  }
  return [storeName, 'Seller Center'];
}

export function SellerLayout() {
  const {
    bootstrapping,
    isSignedIn,
    user,
    unreadNotificationsCount,
    refreshUser,
    signOut,
  } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const { isDark, toggleTheme } = useDashboardTheme('seller');
  const [storeProfile, setStoreProfile] = useState<SellerStoreProfile | null>(
    null,
  );
  const [summary, setSummary] = useState<SellerDashboardData | null>(null);
  const [openMessagesCount, setOpenMessagesCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);

  const isStoreOwner = Boolean(
    user?.roles?.includes('store_owner') || user?.store,
  );
  const isApproved = user?.store?.status === 'approved';

  // When an applicant clicks "Visit Your Store" from their approval email, refresh user profile
  // immediately so their newly approved seller role & store unlock without re-login.
  useEffect(() => {
    if (isSignedIn && !isApproved) {
      void refreshUser();
    }
  }, [isSignedIn, isApproved, refreshUser]);

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
    if (!isStoreOwner || !isApproved) return;
    let active = true;
    Promise.allSettled([
      storeOwnerApi.getProfile(),
      storeOwnerApi.getDashboard(),
      storeOwnerApi.getTickets({ status: 'open', per_page: 1 }),
      storeOwnerApi.getFollowers({ per_page: 1 }),
    ]).then(([profRes, dashRes, ticketRes, followRes]) => {
      if (!active) return;
      if (profRes.status === 'fulfilled') setStoreProfile(profRes.value);
      if (dashRes.status === 'fulfilled') setSummary(dashRes.value);
      if (ticketRes.status === 'fulfilled') {
        setOpenMessagesCount(ticketRes.value.stats?.open ?? 0);
      }
      if (followRes.status === 'fulfilled') {
        setFollowersCount(followRes.value.stats?.total_followers ?? 0);
      }
    });
    return () => {
      active = false;
    };
  }, [isStoreOwner, isApproved, location.pathname]);

  if (bootstrapping) {
    return <CustomerSettingsSkeleton />;
  }

  if (!isSignedIn || !user) {
    return (
      <div className="min-h-screen w-full bg-[#f7f7f7] flex items-center justify-center p-4">
        <div className="bg-white border border-[#ececec] p-8 max-w-[440px] w-full text-center flex flex-col items-center gap-2.5 sm:gap-3 rounded-[24px]">
          <KovaLogo size="sm" />
          <h1 className="text-[22px] font-bold text-black">
            Sign in to your Seller Center
          </h1>
          <p className="text-[13.5px] text-[#767676]">
            Manage products, inventory, customer orders, Bakong KHQR payments,
            and payouts.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Link
              to="/login"
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13.5px] font-semibold px-6 py-2.5 rounded-full"
            >
              Sign in
            </Link>
            <Link
              to="/become-a-seller"
              className="bg-white border border-[#ececec] hover:border-black text-black text-[13.5px] font-semibold px-6 py-2.5 rounded-full"
            >
              Become a seller
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isStoreOwner) {
    return (
      <div className="min-h-screen w-full bg-[#f7f7f7] flex items-center justify-center p-4">
        <div className="bg-white border border-[#ececec] p-8 max-w-[460px] w-full text-center flex flex-col items-center gap-2.5 sm:gap-3 rounded-[24px]">
          <KovaLogo size="sm" />
          <h1 className="text-[22px] font-bold text-black">
            Open your store on Kova
          </h1>
          <p className="text-[13.5px] text-[#767676]">
            Your account does not have a seller store yet. Apply in minutes and
            start selling across Cambodia.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Link
              to="/become-a-seller"
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13.5px] font-semibold px-6 py-2.5 rounded-full"
            >
              Apply for a store
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

  if (!isApproved) {
    const storeStatus = user.store?.status || 'pending';
    return (
      <div className="min-h-screen w-full bg-[#f7f7f7] flex items-center justify-center p-4">
        <div className="bg-white border border-[#ececec] p-8 max-w-[500px] w-full text-center flex flex-col items-center gap-2.5 sm:gap-3 rounded-[24px]">
          <KovaLogo size="sm" />
          <span
            className={`text-[11px] font-bold px-3.5 py-1 rounded-full capitalize ${
              storeStatus === 'suspended' || storeStatus === 'rejected'
                ? 'bg-[#fdecec] text-[#e5322d]'
                : 'bg-[#ffefe6] text-[#ff6e20]'
            }`}
          >
            Store status: {storeStatus}
          </span>
          <h1 className="text-[22px] font-bold text-black">
            {user.store?.name || 'Your Kova Store'}
          </h1>
          <p className="text-[13.5px] text-[#767676] leading-[1.6]">
            {storeStatus === 'pending'
              ? 'Your store application is awaiting Root Administrator approval. Once approved, your full Store Owner Dashboard will unlock automatically.'
              : storeStatus === 'suspended'
                ? 'Your store is currently suspended. Contact Kova Support for assistance.'
                : 'Your store application was not approved. You can submit an updated application anytime.'}
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            {storeStatus !== 'suspended' && (
              <Link
                to="/"
                className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13.5px] font-semibold px-6 py-2.5 rounded-full"
              >
                Continue shopping
              </Link>
            )}
            <button
              type="button"
              onClick={() => void refreshUser()}
              className="bg-white border border-[#ececec] hover:border-black text-black text-[13.5px] font-semibold px-6 py-2.5 rounded-full transition-colors"
            >
              Refresh status
            </button>
            <button
              type="button"
              onClick={() => void signOut().then(() => navigate('/login'))}
              className="bg-white border border-[#ececec] hover:border-[#e5322d] hover:text-[#e5322d] text-black text-[13.5px] font-semibold px-6 py-2.5 rounded-full transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const storeName = storeProfile?.name || user.store?.name || 'My Store';
  const storeLogo = storeProfile?.logo || user.store?.logo || null;
  const storeVerified = Boolean(
    storeProfile?.is_verified ?? user.store?.is_verified,
  );
  const storeCity =
    storeProfile?.address?.split(',').pop()?.trim() || 'Cambodia';

  const initials = storeName
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const ownerInitials = user.name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const navItems: SellerNavItem[] = [
    { label: 'Overview', to: '/seller', icon: 'home', exact: true },
    {
      label: 'Products',
      to: '/seller/products',
      icon: 'package',
      badge: summary?.inventory.total_products,
      badgeTone: 'neutral',
    },
    {
      label: 'Inventory',
      to: '/seller/inventory',
      icon: 'sliders',
      badge:
        summary && summary.inventory.low_stock_count > 0
          ? `${summary.inventory.low_stock_count} low`
          : undefined,
      badgeTone: 'red',
    },
    {
      label: 'Orders',
      to: '/seller/orders',
      icon: 'shopping-bag',
      badge:
        summary && summary.orders.pending > 0
          ? summary.orders.pending
          : undefined,
      badgeTone: 'orange',
    },
    {
      label: 'Reviews',
      to: '/seller/reviews',
      icon: 'star',
    },
    {
      label: 'Followers',
      to: '/seller/followers',
      icon: 'heart',
      badge: followersCount > 0 ? followersCount : undefined,
      badgeTone: 'orange',
    },
    {
      label: 'Messages',
      to: '/seller/messages',
      icon: 'mail',
      badge: openMessagesCount > 0 ? openMessagesCount : undefined,
      badgeTone: 'orange',
    },
    {
      label: 'Storefront',
      to: '/seller/storefront',
      icon: 'user',
    },
    {
      label: 'Discounts',
      to: '/seller/promotions',
      icon: 'tag',
    },
    {
      label: 'Finance & Payouts',
      to: '/seller/payouts',
      icon: 'shield',
    },
    {
      label: 'Bakong KHQR',
      to: '/seller/bakong',
      icon: 'zap',
    },
    {
      label: 'Account Settings',
      to: '/seller/settings',
      icon: 'lock',
    },
  ];

  const isNavActive = (item: SellerNavItem) =>
    item.exact
      ? location.pathname === item.to || location.pathname === `${item.to}/`
      : location.pathname.startsWith(item.to);

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = quickQuery.trim();
    if (!q) return;
    if (q.toLowerCase().startsWith('ord') || q.startsWith('#')) {
      navigate(`/seller/orders?search=${encodeURIComponent(q)}`);
    } else {
      navigate(`/seller/products?search=${encodeURIComponent(q)}`);
    }
  };

  const crumbs = getSellerBreadcrumbs(storeName, location.pathname);
  const bellCount =
    unreadNotificationsCount > 0 ? unreadNotificationsCount : openMessagesCount;
  const isFullBleedPage = location.pathname.startsWith('/seller/messages');

  const renderSidebarBody = (isMobile: boolean) => (
    <>
      <div className="flex flex-col gap-3.5 overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between gap-2 px-1.5 pt-0.5">
          <KovaLogo size="sm" to="/seller" />
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

        {/* Store Identity Switcher Card */}
        <Link
          to="/seller/storefront"
          onClick={() => {
            if (isMobile) setMobileSidebarOpen(false);
          }}
          className="bg-[#f7f7f7] border border-[#ececec] hover:border-[#ff6e20]/50 transition-colors rounded-[14px] p-2.5 flex items-center gap-2.5"
        >
          {storeLogo ? (
            <img
              src={storeLogo}
              alt={storeName}
              className="w-9 h-9 rounded-[10px] object-cover shrink-0 border border-[#ececec] bg-white"
            />
          ) : (
            <span className="w-9 h-9 rounded-[10px] bg-[#ff6e20] text-white text-[12px] font-bold flex items-center justify-center shrink-0">
              {initials}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="text-[13px] font-bold text-black truncate">
                {storeName}
              </p>
              {storeVerified && <VerifiedBadge size="xs" />}
            </div>
            <p className="text-[11px] text-[#767676] truncate">
              {storeVerified ? `Verified · ${storeCity}` : storeCity}
            </p>
          </div>
        </Link>

        <nav className="flex flex-col gap-0.5 pt-0.5">
          {navItems.map((item) => {
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

      {/* Persistent Left Seller Sidebar (Desktop) */}
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
              <KovaLogo size="sm" to="/seller" />
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
              placeholder="Search orders, products, SKU..."
              className="flex-1 bg-transparent text-[12.5px] text-black placeholder:text-[#979797] outline-none min-w-0"
            />
            <kbd className="hidden xl:inline-flex items-center bg-white border border-[#e5e5e5] rounded-[6px] px-1.5 py-0.5 text-[10px] font-semibold text-[#8a8a8a]">
              Ctrl K
            </kbd>
          </form>

          <div className="flex items-center gap-2 shrink-0">
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
              className="inline-flex items-center justify-center bg-[#f7f7f7] hover:bg-[#ffefe6] border border-[#ececec] text-black h-9 px-2.5 rounded-full gap-1.5 transition-colors"
            >
              <FigmaIcon name="bell" className="w-4 h-4 text-black" />
              {bellCount > 0 && (
                <span className="bg-[#ff6e20] text-white text-[10px] font-bold px-1.5 py-[1px] rounded-full leading-tight">
                  {bellCount}
                </span>
              )}
            </button>

            <Link
              to="/seller/settings"
              className="hidden sm:flex items-center gap-2 bg-[#fff6f1] hover:bg-[#ffefe6] border border-[#fde1d2] rounded-full pl-1.5 pr-3.5 py-1 transition-colors"
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <span className="w-7 h-7 rounded-full bg-[#ff6e20] text-white text-[10.5px] font-bold flex items-center justify-center">
                  {ownerInitials}
                </span>
              )}
              <div className="leading-tight">
                <p className="text-[12px] font-semibold text-black max-w-[110px] truncate">
                  {user.name}
                </p>
                <p className="text-[10px] font-semibold text-[#ff6e20]">
                  Owner
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
              : 'flex-1 w-full max-w-[1320px] mx-auto px-2.5 lg:px-7 py-4 lg:py-6'
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
