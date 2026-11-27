import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardModal } from './DashboardPrimitives';
import { FigmaIcon } from './FigmaIcon';
import { useStore } from '../context/StoreContext';
import { formatShortDate } from '../utils/currency';
import type { UserNotificationItem } from '../types/marketplace';

export interface GroupedNotification {
  key: string;
  latest: UserNotificationItem;
  items: UserNotificationItem[];
  unreadIds: number[];
  title: string;
  senderName: string | null;
}

function extractSenderName(notif: UserNotificationItem): string | null {
  if (notif.data?.sender_name) return notif.data.sender_name;
  const match = notif.title.match(/from\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// eslint-disable-next-line react-refresh/only-export-components
export function groupNotifications(
  notifications: UserNotificationItem[],
): GroupedNotification[] {
  const groups: GroupedNotification[] = [];
  const indexByKey = new Map<string, number>();

  for (const notif of notifications) {
    const senderName = extractSenderName(notif);
    const isMessage = notif.type === 'message';
    const groupKey =
      isMessage && senderName
        ? `msg:${notif.data?.ticket_id ?? notif.action_url ?? ''}:${senderName.toLowerCase()}`
        : `single:${notif.id}`;

    const existingIdx = indexByKey.get(groupKey);
    if (existingIdx !== undefined) {
      const group = groups[existingIdx];
      group.items.push(notif);
      if (!notif.read_at) {
        group.unreadIds.push(notif.id);
      }
    } else {
      indexByKey.set(groupKey, groups.length);
      groups.push({
        key: groupKey,
        latest: notif,
        items: [notif],
        unreadIds: notif.read_at ? [] : [notif.id],
        title: notif.title,
        senderName,
      });
    }
  }

  return groups.map((group) => {
    const unreadCount = group.unreadIds.length;
    const totalCount = group.items.length;
    let title = group.latest.title;

    if (group.latest.type === 'message' && group.senderName) {
      if (unreadCount > 1) {
        title = `${unreadCount} new messages from ${group.senderName}`;
      } else if (unreadCount === 0 && totalCount > 1) {
        title = `${totalCount} messages from ${group.senderName}`;
      }
    }

    return {
      ...group,
      title,
    };
  });
}

interface NotificationModalProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationModal({ open, onClose }: NotificationModalProps) {
  const {
    isSignedIn,
    user,
    notifications,
    unreadNotificationsCount,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearAllNotifications,
  } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const grouped = useMemo(
    () => groupNotifications(notifications),
    [notifications],
  );

  useEffect(() => {
    if (open && isSignedIn) {
      void refreshNotifications(false);
    }
  }, [open, isSignedIn, refreshNotifications]);

  const getNotificationTargetUrl = (notif: UserNotificationItem) => {
    const isAdminUser = Boolean(
      user?.roles?.some((r) => r === 'admin' || r === 'root_admin'),
    );

    if (notif.type === 'order') {
      if (isAdminUser || location.pathname.startsWith('/admin')) {
        return '/admin/bakong';
      }
      const orderNum = notif.data?.order_number;
      const isStoreOwner = Boolean(
        user?.roles?.includes('store_owner') || user?.store,
      );
      if (
        isStoreOwner &&
        ((user?.store?.id &&
          notif.data?.store_id &&
          Number(notif.data.store_id) === Number(user.store.id)) ||
          location.pathname.startsWith('/seller'))
      ) {
        return orderNum
          ? `/seller/orders?search=${encodeURIComponent(orderNum)}`
          : '/seller/orders';
      }
      if (notif.action_url) return notif.action_url;
      return orderNum
        ? `/account/orders?order=${encodeURIComponent(orderNum)}`
        : '/account/orders';
    }

    const ticketId = notif.data?.ticket_id;
    const isStoreOwner = Boolean(
      user?.roles?.includes('store_owner') || user?.store,
    );
    const matchesSellerStore = Boolean(
      isStoreOwner &&
        user?.store?.id &&
        notif.data?.store_id &&
        Number(notif.data.store_id) === Number(user.store.id),
    );

    if (ticketId) {
      if (matchesSellerStore || location.pathname.startsWith('/seller')) {
        return `/seller/messages?chat=${ticketId}`;
      }
      if (
        (isAdminUser && !notif.data?.store_id) ||
        location.pathname.startsWith('/admin')
      ) {
        return `/admin/tickets?chat=${ticketId}`;
      }
      return `/help/tickets?chat=${ticketId}`;
    }

    if (location.pathname.startsWith('/seller')) return '/seller/messages';
    if (location.pathname.startsWith('/admin')) return '/admin/tickets';
    return '/help/tickets';
  };

  const handlePrimaryClick = (group: GroupedNotification) => {
    group.unreadIds.forEach((id) => {
      void markNotificationRead(id);
    });
    onClose();
    navigate(getNotificationTargetUrl(group.latest));
  };

  const handleMarkGroupRead = (group: GroupedNotification) => {
    group.unreadIds.forEach((id) => {
      void markNotificationRead(id);
    });
  };

  const handleClearAll = () => {
    void clearAllNotifications();
  };

  return (
    <DashboardModal
      open={open}
      onClose={onClose}
      title="Notifications"
      subtitle={
        unreadNotificationsCount > 0
          ? `${unreadNotificationsCount} unread notification${
              unreadNotificationsCount === 1 ? '' : 's'
            }`
          : 'You are all caught up'
      }
      widthClass="max-w-[580px]"
      footer={
        <div className="w-full flex flex-nowrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              if (location.pathname.startsWith('/seller')) {
                navigate('/seller/messages');
              } else if (location.pathname.startsWith('/admin')) {
                navigate('/admin/tickets');
              } else {
                navigate('/help/tickets');
              }
            }}
            className="text-[12px] sm:text-[12.5px] font-semibold text-[#ff6e20] hover:underline whitespace-nowrap shrink-0"
          >
            Open all messages
          </button>
          <div className="flex flex-nowrap items-center gap-2 shrink-0">
            {unreadNotificationsCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllNotificationsRead()}
                className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-[12px] font-semibold text-black px-3 sm:px-3.5 py-2 rounded-full transition-colors whitespace-nowrap shrink-0"
              >
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="bg-[#fff0f0] hover:bg-[#e5322d] text-[#e5322d] hover:text-white text-[12px] font-semibold px-3 sm:px-3.5 py-2 rounded-full transition-colors whitespace-nowrap shrink-0"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      }
    >
      {!isSignedIn ? (
        <div className="py-10 text-center flex flex-col items-center gap-3">
          <FigmaIcon name="bell" className="w-8 h-8 text-[#979797]" />
          <p className="text-[14.5px] font-semibold text-black">
            Sign in to view notifications
          </p>
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate('/login');
            }}
            className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13px] font-semibold px-5 py-2 rounded-full"
          >
            Sign in
          </button>
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-12 text-center flex flex-col items-center gap-2">
          <span className="w-12 h-12 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
            <FigmaIcon name="message-circle" className="w-5 h-5" />
          </span>
          <p className="text-[15px] font-semibold text-black">
            No notifications yet
          </p>
          <p className="text-[13px] text-[#767676] max-w-[340px]">
            New orders, customer messages, seller replies, and support alerts
            will appear here in real time.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {grouped.map((group) => {
            const notif = group.latest;
            const isUnread = group.unreadIds.length > 0;
            const isOrder = notif.type === 'order';
            const countBadge =
              group.unreadIds.length > 1
                ? group.unreadIds.length
                : group.items.length > 1
                  ? group.items.length
                  : null;
            return (
              <div
                key={group.key}
                className={`rounded-[16px] p-3.5 border transition-colors flex items-start gap-3 ${
                  isUnread
                    ? 'bg-[#fff7f2] border-[#ffdfcd]'
                    : 'bg-white border-[#ececec] hover:bg-[#fafafa]'
                }`}
              >
                <div className="relative shrink-0">
                  <span className="w-10 h-10 rounded-full border border-[#ececec] bg-[#ffefe6] text-[#ff6e20] overflow-hidden flex items-center justify-center">
                    {notif.avatar_url ? (
                      <img
                        src={notif.avatar_url}
                        alt={group.title}
                        className="w-full h-full object-cover"
                      />
                    ) : isOrder ? (
                      <FigmaIcon name="shopping-bag" className="w-4 h-4" />
                    ) : (
                      <FigmaIcon name="message-circle" className="w-4 h-4" />
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
                    <p className="text-[13.5px] font-semibold text-black truncate flex items-center gap-1.5">
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-[#ff6e20] shrink-0" />
                      )}
                      <span className="truncate">{group.title}</span>
                    </p>
                    <span className="text-[11px] text-[#8a8a8a] shrink-0">
                      {formatShortDate(notif.created_at)}
                    </span>
                  </div>
                  {notif.body && (
                    <p className="text-[12.5px] text-[#555555] line-clamp-2 mt-0.5 leading-snug">
                      {notif.body}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 mt-2.5">
                    <div className="flex items-center gap-1.5">
                      {notif.data?.order_number && !isOrder && (
                        <span className="text-[11px] font-semibold bg-white border border-[#ececec] text-[#555555] px-2.5 py-0.5 rounded-full">
                          Order #{notif.data.order_number}
                        </span>
                      )}
                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => handleMarkGroupRead(group)}
                          title="Mark as read"
                          aria-label="Mark as read"
                          className="inline-flex items-center gap-1 bg-white hover:bg-[#ffefe6] border border-[#ececec] hover:border-[#ffdfcd] text-[#555555] hover:text-[#ff6e20] text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors"
                        >
                          <FigmaIcon name="check" className="w-3 h-3" />
                          <span>Mark read</span>
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePrimaryClick(group)}
                      className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[11.5px] font-semibold px-3.5 py-1.5 rounded-full transition-colors shrink-0"
                    >
                      {isOrder ? 'View order' : 'Reply'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardModal>
  );
}
