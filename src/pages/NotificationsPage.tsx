import { Link } from 'react-router-dom';
import { FigmaIcon } from '../components/FigmaIcon';
import { useStore } from '../context/StoreContext';
import { formatShortDate } from '../utils/currency';
import { NotificationsSkeleton } from '../components/Skeleton';

export function NotificationsPage() {
  const { bootstrapping, isSignedIn, orders } = useStore();

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
            Live order updates and payment confirmations.
          </p>
        </div>
        {isSignedIn && (
          <Link
            to="/account/notification-preferences"
            className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-[13.5px] font-semibold text-black px-5 py-2.5 rounded-full transition-colors"
          >
            Preferences
          </Link>
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
        ) : orders.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center gap-2">
            <FigmaIcon name="bell" className="w-8 h-8 text-[#979797]" />
            <p className="text-[15px] font-semibold text-black">
              No notifications yet
            </p>
            <p className="text-[13px] text-[#767676]">
              Order updates and Bakong KHQR confirmations will appear here.
            </p>
          </div>
        ) : (
          orders.map((order) => (
            <Link
              key={order.id}
              to={`/account/orders/${order.order_number}`}
              className="rounded-[16px] p-4 flex items-start gap-3.5 bg-[#f7f7f7] hover:bg-[#ffefe6] transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-white text-[#ff6e20] flex items-center justify-center shrink-0 mt-0.5 border border-[#ececec]">
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
          ))
        )}
      </div>
    </div>
  );
}
