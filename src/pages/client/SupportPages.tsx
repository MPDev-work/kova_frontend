import { useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { FigmaIcon } from '../../components/FigmaIcon';
import { MessengerWorkspace } from '../../components/MessengerWorkspace';
import { useClientDrawer } from '../../context/ClientDrawerContext';
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
  const { openMessages } = useClientDrawer();
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

      <div className="bg-[#ffefe6] border border-[#ececec] p-6 flex flex-col gap-4 rounded-[14px]">
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

      <div className="bg-white border border-[#ececec] p-2.5 sm:p-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 rounded-[24px]">
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
            className="bg-[#f7f7f7] border border-[#ececec] p-6 flex flex-col justify-between gap-5 rounded-[14px]"
          >
            <div>
              <h2 className="text-[20px] font-semibold text-black">
                {card.title}
              </h2>
              <p className="text-[14px] text-[#767676] mt-2">{card.desc}</p>
            </div>
            {card.to === '/help/tickets' ? (
              <button
                type="button"
                onClick={() => openMessages()}
                className="self-start bg-white border border-[#ececec] hover:border-[#ff6e20] text-[14px] font-semibold text-black px-5 py-2.5 transition-colors rounded-[24px]"
              >
                Get help
              </button>
            ) : (
              <Link
                to={card.to}
                className="self-start bg-white border border-[#ececec] hover:border-[#ff6e20] text-[14px] font-semibold text-black px-5 py-2.5 transition-colors rounded-[24px]"
              >
                Get help
              </Link>
            )}
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
              className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-3 rounded-[24px]"
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
        <button
          type="button"
          onClick={() => openMessages({ target: 'support' })}
          className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[14px] font-semibold px-6 py-3 rounded-full"
        >
          Contact support
        </button>
        <button
          type="button"
          onClick={() => openMessages()}
          className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-black text-[14px] font-semibold px-6 py-3 rounded-full"
        >
          View my messages
        </button>
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
  const { isSignedIn } = useStore();
  const navigate = useNavigate();

  const handleBack = () => {
    const historyIdx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof historyIdx === 'number' && historyIdx > 0) {
      navigate(-1);
    } else {
      navigate('/', { state: { allowStorefront: true } });
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-white flex flex-col">
      {!isSignedIn ? (
        <div className="flex-1 flex flex-col bg-[#f7f7f7]">
          <div className="px-4 pt-4 pb-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back to store"
              className="-ml-1.5 w-9 h-9 rounded-full hover:bg-white text-black flex items-center justify-center transition-colors shrink-0"
            >
              <FigmaIcon name="chevron-left" className="w-5 h-5" />
            </button>
            <h1 className="text-[22px] font-bold text-black tracking-tight">
              Chats
            </h1>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="bg-white border border-[#ececec] p-10 max-w-[420px] w-full text-center flex flex-col items-center gap-3 rounded-[24px]">
              <span className="w-12 h-12 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
                <FigmaIcon name="message-circle" className="w-6 h-6" />
              </span>
              <h2 className="text-[20px] font-bold text-black">
                Sign in to view your messages
              </h2>
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
        </div>
      ) : (
        <MessengerWorkspace mode="customer" fullScreen />
      )}
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
