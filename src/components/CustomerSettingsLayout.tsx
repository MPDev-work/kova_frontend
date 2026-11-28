import { useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useClientDrawer } from '../context/ClientDrawerContext';
import { useStore } from '../context/StoreContext';
import { getUserDashboardPath } from '../utils/authRedirect';
import { FigmaIcon, type FigmaIconName } from './FigmaIcon';
import { KovaLogo } from './KovaLogo';
import { CustomerSettingsSkeleton } from './Skeleton';
import { VerifiedBadge } from './VerifiedBadge';

interface NavGroup {
  title: string;
  items: {
    label: string;
    to: string;
    icon: FigmaIconName;
    badge?: string | number;
    badgeTone?: 'orange' | 'neutral';
    matchPrefixes?: string[];
  }[];
}

function getBreadcrumbTitle(pathname: string): string {
  if (pathname.startsWith('/account/profile/edit')) return 'Edit Profile';
  if (pathname.startsWith('/account/profile')) return 'My Profile';
  if (pathname.includes('/cancel')) return 'Cancel Order';
  if (pathname.startsWith('/account/orders/')) return 'Order Details';
  if (pathname.startsWith('/account/orders')) return 'Order History';
  if (pathname.startsWith('/account/addresses/new')) return 'Add Address';
  if (pathname.startsWith('/account/addresses/') && pathname.endsWith('/edit'))
    return 'Edit Address';
  if (pathname.startsWith('/account/addresses')) return 'Address Book';
  if (pathname.startsWith('/account/following')) return 'Following';
  if (pathname.startsWith('/account/recently-viewed')) return 'Recently Viewed';
  if (pathname.startsWith('/account/reviews/write')) return 'Write a Review';
  if (pathname.startsWith('/account/reviews')) return 'My Reviews';
  if (pathname.startsWith('/account/notification-preferences'))
    return 'Notification Preferences';
  if (pathname.startsWith('/account/privacy')) return 'Privacy Settings';
  if (pathname.startsWith('/account/password')) return 'Change Password';
  if (pathname.startsWith('/account/delete')) return 'Delete Account';
  if (pathname.startsWith('/account/security')) return 'Account Security';
  return 'Account Settings';
}

export function CustomerSettingsLayout() {
  const {
    bootstrapping,
    isSignedIn,
    user,
    orders,
    addresses,
    reviews,
    wishlistIds,
    followedStores,
    cartCount,
    notifications,
    unreadNotificationsCount,
    signOut,
  } = useStore();
  const unreadMessagesCount = notifications.filter(
    (n) => !n.read_at && n.type === 'message',
  ).length;
  const location = useLocation();
  const navigate = useNavigate();
  const {
    activeDrawer,
    openWishlist,
    openCart,
    openMessages,
    openNotifications,
  } = useClientDrawer();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (bootstrapping) {
    return <CustomerSettingsSkeleton />;
  }

  if (!isSignedIn || !user) {
    return (
      <div className="min-h-screen w-full bg-[#f7f7f7] flex items-center justify-center p-4">
        <div className="bg-white border border-[#ececec] p-8 max-w-[440px] w-full text-center flex flex-col items-center gap-2.5 sm:gap-3 rounded-[24px]">
          <KovaLogo size="sm" />
          <h1 className="text-[22px] font-bold text-black">
            Sign in to access account settings
          </h1>
          <p className="text-[13.5px] text-[#767676]">
            Manage your profile, saved addresses, order history, and security
            preferences.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Link
              to="/login"
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13.5px] font-semibold px-6 py-2.5 rounded-full"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="bg-white border border-[#ececec] hover:border-black text-black text-[13.5px] font-semibold px-6 py-2.5 rounded-full"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const dashboardPath = getUserDashboardPath(user);
  if (dashboardPath === '/admin') {
    return <Navigate to="/admin/account" replace />;
  }
  if (dashboardPath === '/seller') {
    return <Navigate to="/seller/settings" replace />;
  }

  const initials = user.name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const navGroups: NavGroup[] = [
    {
      title: 'ACCOUNT',
      items: [
        {
          label: 'My Profile',
          to: '/account/profile',
          icon: 'user',
          matchPrefixes: ['/account/profile'],
        },
        {
          label: 'Address Book',
          to: '/account/addresses',
          icon: 'map-pin',
          badge: addresses.length,
          badgeTone: 'neutral',
          matchPrefixes: ['/account/addresses'],
        },
      ],
    },
    {
      title: 'ACTIVITY',
      items: [
        {
          label: 'Order History',
          to: '/account/orders',
          icon: 'package',
          badge: orders.length,
          badgeTone: 'orange',
          matchPrefixes: ['/account/orders'],
        },
        {
          label: 'Following',
          to: '/account/following',
          icon: 'heart',
          badge: followedStores.length,
          badgeTone: 'orange',
          matchPrefixes: ['/account/following'],
        },
        {
          label: 'My Reviews',
          to: '/account/reviews',
          icon: 'star',
          badge: reviews.length,
          badgeTone: 'neutral',
          matchPrefixes: ['/account/reviews'],
        },
        {
          label: 'Recently Viewed',
          to: '/account/recently-viewed',
          icon: 'clock',
          matchPrefixes: ['/account/recently-viewed'],
        },
      ],
    },
    {
      title: 'SETTINGS & SECURITY',
      items: [
        {
          label: 'Notification Prefs',
          to: '/account/notification-preferences',
          icon: 'sliders',
          matchPrefixes: ['/account/notification-preferences'],
        },
        {
          label: 'Privacy Settings',
          to: '/account/privacy',
          icon: 'lock',
          matchPrefixes: ['/account/privacy'],
        },
        {
          label: 'Account Security',
          to: '/account/security',
          icon: 'shield',
          matchPrefixes: [
            '/account/security',
            '/account/password',
            '/account/delete',
          ],
        },
      ],
    },
  ];

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = quickQuery.trim().toLowerCase();
    if (!q) return;
    if (q.includes('order') || q.includes('ord-')) {
      navigate('/account/orders');
    } else if (q.includes('address')) {
      navigate('/account/addresses');
    } else if (q.includes('pass') || q.includes('sec')) {
      navigate('/account/security');
    } else if (q.includes('priv')) {
      navigate('/account/privacy');
    } else if (q.includes('follow')) {
      navigate('/account/following');
    } else if (q.includes('review')) {
      navigate('/account/reviews');
    } else {
      navigate(`/products?q=${encodeURIComponent(quickQuery.trim())}`);
    }
  };

  const currentSection = getBreadcrumbTitle(location.pathname);

  const renderSidebarBody = (isMobile: boolean) => (
    <>
      <div className="flex flex-col gap-3.5 overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between gap-2 px-1">
          <KovaLogo size="sm" />
          {isMobile && (
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close sidebar"
              className="w-8 h-8 rounded-[10px] bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#767676] flex items-center justify-center transition-colors shrink-0"
            >
              <FigmaIcon name="x" className="w-4 h-4" />
            </button>
          )}
        </div>

        <Link
          to="/account/profile"
          onClick={() => {
            if (isMobile) setMobileSidebarOpen(false);
          }}
          className="bg-[#f7f7f7] border border-[#ececec] hover:border-[#ff6e20]/50 transition-colors rounded-[14px] p-2.5 flex items-center gap-2.5"
        >
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-9 h-9 rounded-full object-cover shrink-0 border border-[#ececec]"
            />
          ) : (
            <span className="w-9 h-9 rounded-full bg-[#ff6e20] text-white text-[12px] font-bold flex items-center justify-center shrink-0">
              {initials}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="text-[13px] font-semibold text-black truncate">
                {user.name}
              </p>
              {user.email_verified_at && <VerifiedBadge size="xs" />}
            </div>
            <p className="text-[11px] text-[#767676] truncate">{user.email}</p>
          </div>
        </Link>

        <nav className="flex flex-col gap-4">
          {navGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-0.5">
              <p className="px-2.5 pb-1 text-[10px] font-bold text-[#979797] tracking-[0.04em]">
                {group.title}
              </p>
              {group.items.map((item) => {
                const active = (item.matchPrefixes || [item.to]).some((p) =>
                  location.pathname.startsWith(p),
                );
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => {
                      if (isMobile) setMobileSidebarOpen(false);
                    }}
                    className={`flex items-center justify-between px-2.5 py-[8px] rounded-[10px] text-[12.5px] transition-colors ${
                      active
                        ? 'bg-[#ffefe6] text-[#ff6e20] font-semibold'
                        : 'text-black font-medium hover:bg-[#f7f7f7]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <FigmaIcon
                        name={item.icon}
                        className={`w-[15px] h-[15px] ${
                          active ? 'text-[#ff6e20]' : 'text-[#767676]'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-semibold px-[7px] py-px rounded-full ${
                          item.badgeTone === 'orange'
                            ? 'bg-[#ffefe6] text-[#ff6e20]'
                            : 'bg-[#f7f7f7] text-[#767676]'
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
          <FigmaIcon name="log-out" className="w-4 h-4 shrink-0" />
          <span>Log out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="relative min-h-screen w-full overflow-x-clip bg-[#f7f7f7] text-black flex">
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
            ? 'w-[260px] px-[14px]'
            : 'w-0 px-0 overflow-hidden border-r-0'
        } hidden lg:flex flex-col justify-between bg-white border-r border-[#ececec] py-[16px] sticky top-0 h-screen shrink-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]`}
      >
        {renderSidebarBody(false)}
      </aside>

      {/* Persistent Right Workspace (shifts +240px smoothly when mobile sidebar opens) */}
      <div
        className={`relative flex-1 min-w-0 flex flex-col min-h-screen transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
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
              className="lg:hidden inline-flex items-center justify-center bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#767676] p-2 rounded-[10px] transition-colors shrink-0 cursor-pointer"
            >
              <FigmaIcon name="sidebar" className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle sidebar"
              className="hidden lg:inline-flex items-center justify-center bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#767676] p-2 rounded-[10px] transition-colors shrink-0 cursor-pointer"
            >
              <FigmaIcon name="sidebar" className="w-4 h-4" />
            </button>
            <div className="lg:hidden">
              <KovaLogo size="sm" />
            </div>
            <p className="hidden sm:block text-[13.5px] font-medium text-[#767676] truncate">
              Kova Customer &nbsp;/&nbsp; Settings &nbsp;/&nbsp;{' '}
              <span className="text-black font-semibold">{currentSection}</span>
            </p>
          </div>

          <form
            onSubmit={handleQuickSearch}
            className="hidden md:flex items-center gap-2.5 h-[38px] w-[280px] xl:w-[320px] bg-[#f7f7f7] border border-[#ececec] focus-within:border-[#ff6e20] rounded-full px-3.5"
          >
            <FigmaIcon name="search" className="w-4 h-4 text-[#979797]" />
            <input
              type="text"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="Search orders, settings, products..."
              className="flex-1 bg-transparent text-[13px] text-black placeholder:text-[#979797] outline-none min-w-0"
            />
          </form>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/"
              state={{ allowStorefront: true }}
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12px] font-semibold px-3.5 py-2 rounded-full transition-colors whitespace-nowrap"
            >
              Back to shop
            </Link>

            <button
              type="button"
              onClick={() => openWishlist({ toggle: true })}
              title="Wishlist"
              aria-label="Wishlist"
              className={`hidden sm:inline-flex relative p-2 rounded-full transition-colors ${
                activeDrawer === 'wishlist'
                  ? 'bg-[#ffefe6] text-[#ff6e20]'
                  : 'bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#767676]'
              }`}
            >
              <FigmaIcon name="heart" className="w-4 h-4" />
              {wishlistIds.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6e20] text-white text-[10px] font-semibold flex items-center justify-center">
                  {wishlistIds.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => openMessages({ toggle: true })}
              title="Messages"
              aria-label="Messages"
              className={`hidden sm:inline-flex relative p-2 rounded-full transition-colors ${
                activeDrawer === 'messages'
                  ? 'bg-[#ffefe6] text-[#ff6e20]'
                  : 'bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#767676]'
              }`}
            >
              <FigmaIcon name="message-circle" className="w-4 h-4" />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6e20] text-white text-[10px] font-semibold flex items-center justify-center">
                  {unreadMessagesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => openNotifications({ toggle: true })}
              title="Notifications"
              aria-label="Notifications"
              className={`hidden sm:inline-flex relative p-2 rounded-full transition-colors ${
                activeDrawer === 'notifications'
                  ? 'bg-[#ffefe6] text-[#ff6e20]'
                  : 'bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#767676]'
              }`}
            >
              <FigmaIcon name="bell" className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6e20] text-white text-[10px] font-semibold flex items-center justify-center">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => openCart({ toggle: true })}
              title="Shopping Cart"
              aria-label="Shopping Cart"
              className={`hidden sm:inline-flex relative p-2 rounded-full transition-colors ${
                activeDrawer === 'cart'
                  ? 'bg-[#ffefe6] text-[#ff6e20]'
                  : 'bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#767676]'
              }`}
            >
              <FigmaIcon name="shopping-cart" className="w-4 h-4" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6e20] text-white text-[10px] font-semibold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            <Link
              to="/help"
              title="Help Center"
              aria-label="Help Center"
              className="hidden sm:inline-flex bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#767676] p-2 rounded-full transition-colors"
            >
              <FigmaIcon name="help-circle" className="w-4 h-4" />
            </Link>

            <Link
              to="/account/profile"
              className="hidden sm:flex items-center gap-2 bg-[#f7f7f7] border border-[#ececec] rounded-full pl-1.5 pr-3 py-1"
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <span className="w-7 h-7 rounded-full bg-[#ff6e20] text-white text-[10.5px] font-bold flex items-center justify-center">
                  {initials}
                </span>
              )}
              <div className="leading-tight">
                <p className="text-[12px] font-semibold text-black flex items-center gap-1">
                  <span>{user.name}</span>
                  {user.email_verified_at && <VerifiedBadge size="xs" />}
                </p>
                <p className="text-[10px] font-semibold text-[#ff6e20]">
                  Customer
                </p>
              </div>
            </Link>
          </div>
        </header>

        {/* ONLY THIS INNER OUTLET SWAPS ON NAVIGATION */}
        <main className="flex-1 w-full max-w-[1220px] px-2.5 lg:px-[26px] pt-4 lg:pt-[22px] pb-[36px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
