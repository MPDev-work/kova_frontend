import { useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { KovaLogo } from '../../components/KovaLogo';
import { MessengerWorkspace } from '../../components/MessengerWorkspace';
import { NotificationModal } from '../../components/NotificationModal';
import { FigmaIcon } from '../../components/FigmaIcon';
import { useStore } from '../../context/StoreContext';

const FAQS = [
  {
    q: 'How does multi-store delivery work?',
    a: 'Each store prepares and ships its own package. You select shipping per store at checkout and can view each package under Order history.',
  },
  {
    q: 'How do Bakong KHQR payments work?',
    a: 'At checkout, Kova generates a dynamic KHQR code using the official Bakong SDK. Scan with Bakong, ABA Mobile, ACLEDA, Wing, or any supported Cambodian banking app.',
  },
  {
    q: 'Can I cancel a pending order?',
    a: 'Yes. Open Order history in Account settings, select a pending order, and choose Cancel order. Inventory is restored automatically.',
  },
];

export function HelpCenterPage() {
  const [search, setSearch] = useState('');
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const filteredFaqs = FAQS.filter(
    (f) =>
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="kova-container px-4 lg:px-6 pt-5 pb-10 flex flex-col gap-5">
      <p className="text-[12px] text-[#767676]">
        Home &nbsp;/&nbsp; Help &amp; support
      </p>
      <h1 className="text-[36px] font-semibold text-black leading-[1.2]">
        How can we help?
      </h1>

      <div className="bg-[#ffefe6] border border-[#ececec] rounded-[20px] p-6 flex flex-col gap-4">
        <p className="text-[24px] font-semibold text-black">
          Search answers or start a conversation.
        </p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search orders, Bakong KHQR, returns..."
          className="h-[42px] bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[14px] outline-none max-w-[540px]"
        />
      </div>

      <div className="bg-white border border-[#ececec] rounded-[20px] p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            title: 'Orders & delivery',
            desc: 'Track or cancel your orders.',
            to: '/account/orders',
          },
          {
            title: 'Your account',
            desc: 'Profile, addresses, and security.',
            to: '/account/profile',
          },
          {
            title: 'Messages',
            desc: 'Chat with stores or Kova support.',
            to: '/help/tickets',
          },
        ].map((card) => (
          <div
            key={card.title}
            className="bg-[#f7f7f7] border border-[#ececec] rounded-[20px] p-6 flex flex-col justify-between gap-5"
          >
            <div>
              <h2 className="text-[20px] font-semibold text-black">
                {card.title}
              </h2>
              <p className="text-[14px] text-[#767676] mt-2">{card.desc}</p>
            </div>
            <Link
              to={card.to}
              className="self-start bg-white border border-[#ececec] hover:border-[#ff6e20] text-[14px] font-semibold text-black px-5 py-2.5 rounded-[25px] transition-colors"
            >
              Get help
            </Link>
          </div>
        ))}
      </div>

      <h2 id="faq" className="text-[26px] font-semibold text-black pt-2">
        Frequently asked questions
      </h2>
      <div className="flex flex-col gap-3">
        {filteredFaqs.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={faq.q}
              className="bg-white border border-[#ececec] rounded-[20px] p-6 flex flex-col gap-3"
            >
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full flex items-center justify-between text-left text-[17px] font-medium text-black"
              >
                <span>{faq.q}</span>
                <span className="text-[#ff6e20] font-bold ml-4">
                  {isOpen ? '−' : '+'}
                </span>
              </button>
              {isOpen && (
                <p className="text-[14.5px] text-[#767676] leading-[1.55]">
                  {faq.a}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          to="/help/contact"
          className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[14px] font-semibold px-6 py-3 rounded-full"
        >
          Contact support
        </Link>
        <Link
          to="/help/tickets"
          className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-black text-[14px] font-semibold px-6 py-3 rounded-full"
        >
          View my messages
        </Link>
      </div>
    </div>
  );
}

/**
 * Contact entry point: immediately routes into the full-screen Message Portal
 * and automatically opens (or creates) the conversation with the store or Kova Support.
 */
export function ContactSupportPage() {
  const [searchParams] = useSearchParams();
  const nextParams = new URLSearchParams();
  nextParams.set('start', '1');

  const storeId = searchParams.get('storeId');
  const orderId = searchParams.get('orderId');

  if (storeId) {
    nextParams.set('storeId', storeId);
  } else {
    nextParams.set('target', 'support');
  }
  if (orderId) {
    nextParams.set('orderId', orderId);
  }

  return <Navigate to={`/help/tickets?${nextParams.toString()}`} replace />;
}

export function SupportTicketsPage() {
  const { isSignedIn, user, unreadNotificationsCount } = useStore();
  const [notifOpen, setNotifOpen] = useState(false);

  const initials = (user?.name || 'U')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#f7f7f7] flex flex-col">
      {/* Dedicated Minimal Message Portal Navbar */}
      <header className="h-[62px] bg-white border-b border-[#ececec] px-4 lg:px-6 flex items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            state={{ allowStorefront: true }}
            className="inline-flex items-center gap-1.5 bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-black text-[13px] font-semibold px-3.5 py-2 rounded-full transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to store</span>
          </Link>

          <div className="hidden sm:block h-5 w-[1px] bg-[#ececec]" />

          <div className="hidden sm:flex items-center gap-2">
            <KovaLogo size="sm" />
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {isSignedIn && (
            <>
              <button
                type="button"
                onClick={() => setNotifOpen(true)}
                aria-label="Notifications"
                className="relative inline-flex items-center justify-center bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-black w-9 h-9 rounded-full transition-colors"
              >
                <FigmaIcon name="bell" className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6e20] text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              <Link
                to="/account/profile"
                className="hidden sm:flex items-center gap-2 bg-[#f7f7f7] hover:bg-[#ffefe6] border border-[#ececec] rounded-full pl-1 pr-3 py-1 transition-colors"
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-[#ff6e20] text-white text-[11px] font-bold flex items-center justify-center">
                    {initials}
                  </span>
                )}
                <span className="text-[12.5px] font-semibold text-black max-w-[120px] truncate">
                  {user?.name}
                </span>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Full-Screen Message Portal Body */}
      {!isSignedIn ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white border border-[#ececec] rounded-[22px] p-10 max-w-[420px] w-full text-center flex flex-col items-center gap-3">
            <span className="w-12 h-12 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
              <MessageCircle className="w-6 h-6" />
            </span>
            <h1 className="text-[20px] font-bold text-black">
              Sign in to view your messages
            </h1>
            <p className="text-[13.5px] text-[#767676]">
              Chat directly with stores and Kova Support.
            </p>
            <Link
              to="/login"
              className="mt-1 bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[14px] font-semibold px-6 py-2.5 rounded-full transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      ) : (
        <MessengerWorkspace mode="customer" fullScreen />
      )}

      <NotificationModal
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
      />
    </div>
  );
}

export function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (ticketId) {
      navigate(`/help/tickets?chat=${encodeURIComponent(ticketId)}`, {
        replace: true,
      });
    } else {
      navigate('/help/tickets', { replace: true });
    }
  }, [ticketId, navigate]);

  return null;
}
