import { Link, useLocation } from 'react-router-dom';
import { ArrowUpToLine, Store } from 'lucide-react';
import { useClientDrawer } from '../context/ClientDrawerContext';
import { useStore } from '../context/StoreContext';
import { FigmaIcon, ICON_STROKE_WIDTH } from './FigmaIcon';

function DockTooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute right-[calc(100%+12px)] top-1/2 -translate-y-1/2 opacity-0 translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-50">
      <span className="inline-flex items-center bg-[#1c1c1c] text-white text-[12px] font-medium px-3 py-1.5 rounded-[10px] whitespace-nowrap shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
        {label}
      </span>
    </span>
  );
}

function DockBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6e20] text-white text-[10px] leading-none font-semibold flex items-center justify-center border border-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function FloatingSideDock() {
  const {
    bootstrapping,
    isSignedIn,
    user,
    cartCount,
    wishlistIds,
    followedStores,
    notifications,
    unreadNotificationsCount,
  } = useStore();
  const { pathname } = useLocation();
  const {
    activeDrawer,
    openWishlist,
    openCart,
    openMessages,
    openNotifications,
  } = useClientDrawer();

  const unreadMessagesCount = notifications.filter(
    (n) => !n.read_at && n.type === 'message',
  ).length;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const itemBase =
    'group relative w-10 h-10 rounded-[12px] flex items-center justify-center transition-colors';

  const profileTarget = isSignedIn && user ? '/account/profile' : '/login';
  const followingTarget =
    isSignedIn && user ? '/account/following' : '/login';
  const isHomeActive = pathname === '/';
  const isMessengerActive = pathname.startsWith('/help/tickets');
  const isCartActive = pathname === '/cart' || pathname === '/checkout';
  const isWishlistActive = pathname === '/wishlist';
  const isFollowingActive = pathname.startsWith('/account/following');
  const isProfileActive =
    (pathname.startsWith('/account') && !isFollowingActive) ||
    pathname === '/login' ||
    pathname === '/register';

  return (
    <>
      {/* Desktop Floating Right Side Dock */}
      <aside
        aria-label="Quick navigation"
        className="hidden md:flex fixed right-0 top-[calc(50%+50px)] -translate-y-1/2 z-40 flex-col gap-2.5 select-none"
      >
        {/* Main Vertical Pill Card */}
        <div className="w-[48px] sm:w-[50px] bg-white border border-r-0 border-[#ececec] rounded-l-[17px] shadow-[0_8px_28px_rgba(0,0,0,0.08)] py-1.5 flex flex-col items-center gap-1.5">
          {/* Kova Brand Mark -> Home */}
          <Link
            to="/"
            state={{ allowStorefront: true }}
            aria-label="Kova Home"
            className="group relative w-9 h-9 rounded-[11px] bg-[#ff6e20] hover:bg-[#e85d12] text-white flex items-center justify-center transition-colors mb-1"
          >
            <FigmaIcon name="fire-filled" className="w-5 h-5 text-white" />
            <DockTooltip label="Kova Home" />
          </Link>

          {/* Wishlist */}
          <button
            type="button"
            onClick={() => openWishlist({ toggle: true })}
            aria-label="Wishlist"
            className={`${itemBase} ${
              activeDrawer === 'wishlist' || pathname === '/wishlist'
                ? 'bg-[#ffefe6] text-[#ff6e20]'
                : 'text-[#222222] hover:bg-[#ffefe6] hover:text-[#ff6e20]'
            }`}
          >
            <FigmaIcon name="heart" className="w-[20px] h-[20px]" />
            {!bootstrapping && isSignedIn && (
              <DockBadge count={wishlistIds.length} />
            )}
            <DockTooltip label="Wishlist" />
          </button>

          {/* Shopping Cart */}
          <button
            type="button"
            onClick={() => openCart({ toggle: true })}
            aria-label="Cart"
            className={`${itemBase} ${
              activeDrawer === 'cart' ||
              activeDrawer === 'checkout' ||
              pathname === '/cart' ||
              pathname === '/checkout'
                ? 'bg-[#ffefe6] text-[#ff6e20]'
                : 'text-[#222222] hover:bg-[#ffefe6] hover:text-[#ff6e20]'
            }`}
          >
            <FigmaIcon name="shopping-cart" className="w-[20px] h-[20px]" />
            {!bootstrapping && <DockBadge count={cartCount} />}
            <DockTooltip label="Cart" />
          </button>

          {/* Messenger */}
          <button
            type="button"
            onClick={() => openMessages({ toggle: true })}
            aria-label="Messenger"
            className={`${itemBase} ${
              activeDrawer === 'messages' ||
              pathname.startsWith('/help/tickets')
                ? 'bg-[#ffefe6] text-[#ff6e20]'
                : 'text-[#222222] hover:bg-[#ffefe6] hover:text-[#ff6e20]'
            }`}
          >
            <FigmaIcon name="message-square" className="w-[20px] h-[20px]" />
            {!bootstrapping && isSignedIn && (
              <DockBadge count={unreadMessagesCount} />
            )}
            <DockTooltip label="Messenger" />
          </button>

          {/* Notifications */}
          <button
            type="button"
            onClick={() => openNotifications({ toggle: true })}
            aria-label="Notifications"
            className={`${itemBase} ${
              activeDrawer === 'notifications' || pathname === '/notifications'
                ? 'bg-[#ffefe6] text-[#ff6e20]'
                : 'text-[#222222] hover:bg-[#ffefe6] hover:text-[#ff6e20]'
            }`}
          >
            <FigmaIcon name="bell" className="w-[20px] h-[20px]" />
            {!bootstrapping && isSignedIn && (
              <DockBadge count={unreadNotificationsCount} />
            )}
            <DockTooltip label="Notifications" />
          </button>

          {/* Help / Support */}
          <Link
            to="/help"
            aria-label="Support"
            className={`${itemBase} ${
              pathname === '/help'
                ? 'bg-[#ffefe6] text-[#ff6e20]'
                : 'text-[#222222] hover:bg-[#ffefe6] hover:text-[#ff6e20]'
            }`}
          >
            <FigmaIcon name="headphones" className="w-[20px] h-[20px]" />
            <DockTooltip label="Support" />
          </Link>
        </div>

        {/* Separate Back-to-Top Pill Card */}
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top"
          className="group relative w-[48px] sm:w-[50px] h-[50px] bg-white border border-r-0 border-[#ececec] rounded-l-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.08)] flex items-center justify-center text-[#222222] hover:bg-[#ffefe6] hover:text-[#ff6e20] transition-colors"
        >
          <ArrowUpToLine
            className="w-[20px] h-[20px]"
            strokeWidth={ICON_STROKE_WIDTH}
          />
          <DockTooltip label="Back to top" />
        </button>
      </aside>

      {/* Mobile App Bottom Tab Bar (Home, Messenger, Cart, Wishlist, Following, Profile) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-[12px] border-t border-[#ececec] pb-[env(safe-area-inset-bottom)] select-none"
      >
        <div className="grid grid-cols-6 h-[60px]">
          <Link
            to="/"
            state={{ allowStorefront: true }}
            className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isHomeActive ? 'text-[#ff6e20]' : 'text-[#6e6e6e]'
            }`}
          >
            <FigmaIcon
              name={isHomeActive ? 'home-filled' : 'home'}
              className="w-[20px] h-[20px]"
            />
            <span
              className={`text-[10px] leading-tight ${
                isHomeActive ? 'font-bold' : 'font-medium'
              }`}
            >
              Home
            </span>
          </Link>

          <Link
            to="/help/tickets"
            className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isMessengerActive ? 'text-[#ff6e20]' : 'text-[#6e6e6e]'
            }`}
          >
            <span className="relative inline-flex">
              <FigmaIcon
                name={
                  isMessengerActive ? 'message-square-filled' : 'message-square'
                }
                className="w-[20px] h-[20px]"
              />
              {!bootstrapping && isSignedIn && unreadMessagesCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6e20] text-white text-[9.5px] leading-none font-bold flex items-center justify-center border border-white">
                  {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                </span>
              )}
            </span>
            <span
              className={`text-[10px] leading-tight ${
                isMessengerActive ? 'font-bold' : 'font-medium'
              }`}
            >
              Messenger
            </span>
          </Link>

          <Link
            to="/cart"
            className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isCartActive ? 'text-[#ff6e20]' : 'text-[#6e6e6e]'
            }`}
          >
            <span className="relative inline-flex">
              <FigmaIcon
                name={isCartActive ? 'shopping-cart-filled' : 'shopping-cart'}
                className="w-[20px] h-[20px]"
              />
              {!bootstrapping && cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6e20] text-white text-[9.5px] leading-none font-bold flex items-center justify-center border border-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </span>
            <span
              className={`text-[10px] leading-tight ${
                isCartActive ? 'font-bold' : 'font-medium'
              }`}
            >
              Cart
            </span>
          </Link>

          <Link
            to="/wishlist"
            className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isWishlistActive ? 'text-[#ff6e20]' : 'text-[#6e6e6e]'
            }`}
          >
            <span className="relative inline-flex">
              <FigmaIcon
                name={isWishlistActive ? 'heart-filled' : 'heart'}
                className="w-[20px] h-[20px]"
              />
              {!bootstrapping && isSignedIn && wishlistIds.length > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6e20] text-white text-[9.5px] leading-none font-bold flex items-center justify-center border border-white">
                  {wishlistIds.length > 99 ? '99+' : wishlistIds.length}
                </span>
              )}
            </span>
            <span
              className={`text-[10px] leading-tight ${
                isWishlistActive ? 'font-bold' : 'font-medium'
              }`}
            >
              Wishlist
            </span>
          </Link>

          <Link
            to={followingTarget}
            className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isFollowingActive ? 'text-[#ff6e20]' : 'text-[#6e6e6e]'
            }`}
          >
            <span className="relative inline-flex">
              <Store
                className="w-[20px] h-[20px]"
                strokeWidth={ICON_STROKE_WIDTH}
              />
              {!bootstrapping && isSignedIn && followedStores.length > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6e20] text-white text-[9.5px] leading-none font-bold flex items-center justify-center border border-white">
                  {followedStores.length > 99 ? '99+' : followedStores.length}
                </span>
              )}
            </span>
            <span
              className={`text-[10px] leading-tight ${
                isFollowingActive ? 'font-bold' : 'font-medium'
              }`}
            >
              Following
            </span>
          </Link>

          <Link
            to={profileTarget}
            className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isProfileActive ? 'text-[#ff6e20]' : 'text-[#6e6e6e]'
            }`}
          >
            {isSignedIn && user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className={`w-[21px] h-[21px] rounded-full object-cover ${
                  isProfileActive
                    ? 'ring-2 ring-[#ff6e20]'
                    : 'border border-[#dcdcdc]'
                }`}
              />
            ) : (
              <FigmaIcon
                name={isProfileActive ? 'user-filled' : 'user'}
                className="w-[20px] h-[20px]"
              />
            )}
            <span
              className={`text-[10px] leading-tight ${
                isProfileActive ? 'font-bold' : 'font-medium'
              }`}
            >
              Profile
            </span>
          </Link>
        </div>
      </nav>
    </>
  );
}
