import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { FigmaIcon } from '../../components/FigmaIcon';
import { groupNotifications } from '../../components/NotificationModal';
import { useStore } from '../../context/StoreContext';
import { formatShortDate } from '../../utils/currency';
import { NotificationsSkeleton } from '../../components/Skeleton';

export function NotificationsPage() {
  const {
    bootstrapping,
    isSignedIn,
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    orders,
  } = useStore();
  const navigate = useNavigate();

  const groupedNotifications = useMemo(
    () => groupNotifications(notifications),
    [notifications],
  );

  const hasAny = groupedNotifications.length > 0 || orders.length > 0;

  return (
    <div className="kova-container px-4 lg:px-6 pt-5 pb-12 flex flex-col gap-5">
      <p className="text-[12px] text-[#767676]">
        Home &nbsp;/&nbsp; Notifications
      </p>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold text-black leading-[1.2]">
            Notifications
          </h1>
          <p className="text-[15px] text-[#767676] mt-1">
            Live message alerts, order updates, and payment confirmations.
          </p>
        </div>
        {isSignedIn && (
          <div className="flex items-center gap-2.5">
            {unreadNotificationsCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllNotificationsRead()}
                className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-[13.5px] font-semibold text-black px-5 py-2.5 rounded-full transition-colors"
              >
                Mark all read
              </button>
            )}
            <Link
              to="/account/notification-preferences"
              className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-[13.5px] font-semibold text-black px-5 py-2.5 rounded-full transition-colors"
            >
              Preferences
            </Link>
          </div>
        )}
      </div>

      <div className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-3">
        {bootstrapping && isSignedIn ? (
          <NotificationsSkeleton count={4} />
        ) : !isSignedIn ? (
          <div className="py-12 text-center flex flex-col items-center gap-3">
            <FigmaIcon name="bell" className="w-8 h-8 text-[#979797]" />
            <p className="text-[16px] font-semibold text-black">
              Sign in to view notifications
            </p>
            <Link
              to="/login"
              className="bg-[#ff6e20] text-white text-[13.5px] font-semibold px-5 py-2.5 rounded-full"
            >
              Sign in
            </Link>
          </div>
        ) : !hasAny ? (
          <div className="py-12 text-center flex flex-col items-center gap-2">
            <FigmaIcon name="bell" className="w-8 h-8 text-[#979797]" />
            <p className="text-[15px] font-semibold text-black">
              No notifications yet
            </p>
            <p className="text-[13px] text-[#767676]">
              New messages, order updates, and Bakong KHQR confirmations will
              appear here.
            </p>
          </div>
        ) : (
          <>
            {groupedNotifications.map((group) => {
              const notif = group.latest;
              const isUnread = group.unreadIds.length > 0;
              const countBadge =
                group.unreadIds.length > 1
                  ? group.unreadIds.length
                  : group.items.length > 1
                    ? group.items.length
                    : null;
              return (
                <div
                  key={group.key}
                  className={`rounded-[16px] p-4 flex items-start gap-3.5 border transition-colors ${
                    isUnread
                      ? 'bg-[#fff7f2] border-[#ffdfcd]'
                      : 'bg-[#f7f7f7] border-transparent'
                  }`}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <span className="w-10 h-10 rounded-full bg-white text-[#ff6e20] overflow-hidden flex items-center justify-center border border-[#ececec]">
                      {notif.avatar_url ? (
                        <img
                          src={notif.avatar_url}
                          alt={group.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <MessageCircle className="w-4 h-4" />
                      )}
                    </span>
                    {countBadge && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff6e20] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                        {countBadge}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[15px] font-semibold text-black flex items-center gap-1.5 truncate">
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-[#ff6e20] shrink-0" />
                        )}
                        <span className="truncate">{group.title}</span>
                      </p>
                      <span className="text-[12px] text-[#767676] shrink-0">
                        {formatShortDate(notif.created_at)}
                      </span>
                    </div>
                    {notif.body && (
                      <p className="text-[13.5px] text-[#555555] mt-0.5">
                        {notif.body}
                      </p>
                    )}
                    <div className="mt-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          group.unreadIds.forEach((id) => {
                            void markNotificationRead(id);
                          });
                          navigate(
                            notif.data?.ticket_id
                              ? `/help/tickets?chat=${notif.data.ticket_id}`
                              : '/help/tickets',
                          );
                        }}
                        className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12px] font-semibold px-4 py-1.5 rounded-full transition-colors"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {orders.map((order) => (
              <Link
                key={`order-${order.id}`}
                to={`/account/orders/${order.order_number}`}
                className="rounded-[16px] p-4 flex items-start gap-3.5 bg-[#f7f7f7] hover:bg-[#ffefe6] transition-colors"
              >
                <span className="w-10 h-10 rounded-full bg-white text-[#ff6e20] flex items-center justify-center shrink-0 mt-0.5 border border-[#ececec]">
                  <FigmaIcon name="bell" className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[15px] font-semibold text-black">
                      Order #{order.order_number} · {order.status}
                    </p>
                    <span className="text-[12px] text-[#767676] shrink-0">
                      {formatShortDate(order.created_at)}
                    </span>
                  </div>
                  <p className="text-[13.5px] text-[#767676] mt-0.5">
                    Total ${order.total_amount.toFixed(2)} · Payment:{' '}
                    {order.payment_status}
                  </p>
                </div>
              </Link>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
