import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowUpToLine,
  Bell,
  Headset,
  Heart,
  MessagesSquare,
  ShoppingCart,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { FigmaIcon } from './FigmaIcon';
import { NotificationModal } from './NotificationModal';

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
    cartCount,
    wishlistIds,
    notifications,
    unreadNotificationsCount,
  } = useStore();
  const { pathname } = useLocation();
  const [notifModalOpen, setNotifModalOpen] = useState(false);

  const unreadMessagesCount = notifications.filter(
    (n) => !n.read_at && n.type === 'message',
  ).length;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const itemBase =
    'group relative w-10 h-10 rounded-[12px] flex items-center justify-center transition-colors';

  return (
    <>
      <aside
        aria-label="Quick navigation"
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2.5 select-none"
      >
        {/* Main Vertical Pill Card */}
        <div className="w-[50px] sm:w-[56px] bg-white border border-r-0 border-[#ececec] rounded-l-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.08)] py-3 flex flex-col items-center gap-1.5">
          {/* Kova Brand Mark -> Home */}
          <Link
            to="/"
            state={{ allowStorefront: true }}
            aria-label="Kova Home"
            className="group relative w-9 h-9 rounded-[11px] bg-[#ff6e20] hover:bg-[#e85d12] text-white flex items-center justify-center transition-colors mb-1 shadow-[0_4px_12px_rgba(255,110,32,0.28)]"
          >
            <FigmaIcon name="fire-filled" className="w-5 h-5 text-white" />
            <DockTooltip label="Kova Home" />
          </Link>

          {/* Wishlist */}
          <Link
            to="/wishlist"
            aria-label="Wishlist"
            className={`${itemBase} ${
              pathname === '/wishlist'
                ? 'bg-[#ffefe6] text-[#ff6e20]'
                : 'text-[#222222] hover:bg-[#ffefe6] hover:text-[#ff6e20]'
            }`}
          >
            <Heart className="w-[21px] h-[21px]" strokeWidth={1.85} />
            {!bootstrapping && isSignedIn && (
              <DockBadge count={wishlistIds.length} />
            )}
            <DockTooltip label="Wishlist" />
          </Link>

          {/* Shopping Cart */}
          <Link
            to="/cart"
            aria-label="Cart"
            className={`${itemBase} ${
              pathname === '/cart'
                ? 'bg-[#ffefe6] text-[#ff6e20]'
                : 'text-[#222222] hover:bg-[#ffefe6] hover:text-[#ff6e20]'
            }`}
          >
            <ShoppingCart className="w-[21px] h-[21px]" strokeWidth={1.85} />
            {!bootstrapping && <DockBadge count={cartCount} />}
            <DockTooltip label="Cart" />
          </Link>

          {/* Messenger */}
          <Link
            to="/help/tickets"
            aria-label="Messenger"
            className={`${itemBase} text-[#222222] hover:bg-[#ffefe6] hover:text-[#ff6e20]`}
          >
            <MessagesSquare className="w-[21px] h-[21px]" strokeWidth={1.85} />
            {!bootstrapping && isSignedIn && (
              <DockBadge count={unreadMessagesCount} />
            )}
            <DockTooltip label="Messenger" />
          </Link>

          {/* Notifications */}
          <button
            type="button"
            onClick={() => setNotifModalOpen(true)}
            aria-label="Notifications"
            className={`${itemBase} ${
              notifModalOpen
                ? 'bg-[#ffefe6] text-[#ff6e20]'
                : 'text-[#222222] hover:bg-[#ffefe6] hover:text-[#ff6e20]'
            }`}
          >
            <Bell className="w-[21px] h-[21px]" strokeWidth={1.85} />
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
            <Headset className="w-[21px] h-[21px]" strokeWidth={1.85} />
            <DockTooltip label="Support" />
          </Link>
        </div>

        {/* Separate Back-to-Top Pill Card */}
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top"
          className="group relative w-[50px] sm:w-[56px] h-[52px] bg-white border border-r-0 border-[#ececec] rounded-l-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.08)] flex items-center justify-center text-[#222222] hover:bg-[#ffefe6] hover:text-[#ff6e20] transition-colors"
        >
          <ArrowUpToLine className="w-[20px] h-[20px]" strokeWidth={1.9} />
          <DockTooltip label="Back to top" />
        </button>
      </aside>

      <NotificationModal
        open={notifModalOpen}
        onClose={() => setNotifModalOpen(false)}
      />
    </>
  );
}
