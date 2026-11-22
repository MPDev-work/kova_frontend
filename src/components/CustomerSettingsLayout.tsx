import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatShortDate } from '../utils/currency';
import { FigmaIcon, type FigmaIconName } from './FigmaIcon';
import { KovaLogo } from './KovaLogo';
import { NotificationModal } from './NotificationModal';
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

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [quickQuery, setQuickQuery] = useState('');
  const [notifModalOpen, setNotifModalOpen] = useState(false);

  if (bootstrapping) {
    return <CustomerSettingsSkeleton />;
  }

  if (!isSignedIn || !user) {
    return (
      <div className="min-h-screen w-full bg-[#f7f7f7] flex items-center justify-center p-4">
        <div className="bg-white border border-[#ececec] rounded-[24px] p-8 max-w-[440px] w-full text-center flex flex-col items-center gap-4">
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
    } else if (q.includes('review')) {
      navigate('/account/reviews');
    } else {
      navigate(`/products?q=${encodeURIComponent(quickQuery.trim())}`);
    }
  };

  const currentSection = getBreadcrumbTitle(location.pathname);

  return (
    <div className="min-h-screen w-full bg-[#f7f7f7] text-black flex">
      {/* Persistent Left Enterprise Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-[260px] px-[14px]' : 'w-0 px-0 overflow-hidden'
        } hidden lg:flex flex-col justify-between bg-white border-r border-[#ececec] py-[16px] sticky top-0 h-screen shrink-0 transition-all duration-200`}
      >
        <div className="flex flex-col gap-3.5 overflow-y-auto no-scrollbar">
          <div className="flex items-center gap-2 px-1">
            <KovaLogo size="sm" />
            <span className="bg-[#ffefe6] text-[#ff6e20] text-[10px] font-bold px-2 py-[3px] rounded-full tracking-wide">
              CUSTOMER
            </span>
          </div>

          <Link
            to="/account/profile"
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
              <p className="text-[11px] text-[#767676] truncate">
                {user.email}
              </p>
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

        <div className="pt-3 flex flex-col gap-2">
          <div className="bg-[#f7f7f7] border border-[#ececec] rounded-[12px] px-3 py-2.5 flex flex-col gap-1">
            <p className="text-[11.5px] font-semibold text-black">
              Kova Customer Account
            </p>
            <p className="text-[10.5px] text-[#767676]">
              Joined {formatShortDate(user.created_at)}
            </p>
            {(user.roles?.includes('admin') ||
              user.roles?.includes('root_admin')) && (
              <Link
                to="/admin"
                className="mt-1 text-center bg-black text-white text-[11px] font-semibold py-1.5 rounded-full"
              >
                Root Admin Dashboard
              </Link>
            )}
            {(user.roles?.includes('store_owner') || user.store) && (
              <Link
                to="/seller"
                className="mt-1 text-center bg-[#ffefe6] text-[#ff6e20] text-[11px] font-semibold py-1.5 rounded-full"
              >
                Seller Center
              </Link>
            )}
            <div className="flex items-center justify-between pt-1">
              <Link
                to="/"
                state={{ allowStorefront: true }}
                className="text-[11px] font-semibold text-[#ff6e20] hover:underline"
              >
                Back to marketplace
              </Link>
              <button
                type="button"
                onClick={() => void signOut().then(() => navigate('/login'))}
                className="text-[11px] font-medium text-[#767676] hover:text-[#e5322d]"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Persistent Right Workspace */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <header className="h-[68px] bg-white border-b border-[#ececec] px-4 lg:px-7 flex items-center justify-between gap-3 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle sidebar"
              className="hidden lg:inline-flex items-center justify-center bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#767676] p-2 rounded-[10px] transition-colors shrink-0"
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

            <Link
              to="/wishlist"
              title="Wishlist"
              aria-label="Wishlist"
              className="relative bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#767676] p-2 rounded-full transition-colors"
            >
              <FigmaIcon name="heart" className="w-4 h-4" />
              {wishlistIds.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6e20] text-white text-[10px] font-semibold flex items-center justify-center">
                  {wishlistIds.length}
                </span>
              )}
            </Link>

            <Link
              to="/help/tickets"
              title="Messages"
              aria-label="Messages"
              className="relative bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#767676] p-2 rounded-full transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6e20] text-white text-[10px] font-semibold flex items-center justify-center">
                  {unreadMessagesCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setNotifModalOpen(true)}
              title="Notifications"
              aria-label="Notifications"
              className="relative bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#767676] p-2 rounded-full transition-colors"
            >
              <FigmaIcon name="bell" className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6e20] text-white text-[10px] font-semibold flex items-center justify-center">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            <Link
              to="/cart"
              title="Shopping Cart"
              aria-label="Shopping Cart"
              className="relative bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#767676] p-2 rounded-full transition-colors"
            >
              <FigmaIcon name="shopping-cart" className="w-4 h-4" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6e20] text-white text-[10px] font-semibold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>

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

        <div className="lg:hidden bg-white border-b border-[#ececec] px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {navGroups
            .flatMap((g) => g.items)
            .map((item) => {
              const active = (item.matchPrefixes || [item.to]).some((p) =>
                location.pathname.startsWith(p),
              );
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-1.5 rounded-full text-[12px] whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[#ff6e20] text-white font-semibold'
                      : 'bg-[#f7f7f7] text-[#767676] font-medium'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
        </div>

        {/* ONLY THIS INNER OUTLET SWAPS ON NAVIGATION */}
        <main className="flex-1 w-full max-w-[1220px] px-4 lg:px-[26px] pt-[22px] pb-[36px]">
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
