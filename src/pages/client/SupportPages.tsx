import { useEffect, useRef, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  ArrowLeft,
  ImagePlus,
  Link2,
  MessageCircle,
  Send,
} from 'lucide-react';
import {
  PendingAttachmentsBar,
} from '../../components/ChatMessageContent';
import { KovaLogo } from '../../components/KovaLogo';
import { MessengerWorkspace } from '../../components/MessengerWorkspace';
import { NotificationModal } from '../../components/NotificationModal';
import { FigmaIcon } from '../../components/FigmaIcon';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { useStore } from '../../context/StoreContext';
import { ApiError, customerApi } from '../../services/api';

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
          className="bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-[25px] px-4 py-3.5 text-[14px] outline-none max-w-[540px]"
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

export function ContactSupportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSignedIn, stores, createTicket, showToast } = useStore();
  const navigate = useNavigate();

  const storeIdParam = Number(searchParams.get('storeId')) || null;
  const storeNameParam = searchParams.get('storeName') || '';
  const storeSlugParam = searchParams.get('storeSlug') || '';
  const orderIdParam = Number(searchParams.get('orderId')) || null;
  const orderNumberParam = searchParams.get('orderNumber') || '';

  const matchedStore = storeIdParam
    ? stores.find((s) => s.id === storeIdParam) || null
    : null;
  const recipientName =
    matchedStore?.name || storeNameParam || 'Kova Support';
  const recipientLogo = matchedStore?.logo || null;
  const recipientVerified = Boolean(matchedStore?.is_verified);

  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isSignedIn) {
    return (
      <div className="kova-container px-4 py-16 text-center">
        <div className="bg-white border border-[#ececec] rounded-[24px] p-10 max-w-[480px] mx-auto flex flex-col items-center gap-4">
          <h1 className="text-[22px] font-semibold text-black">
            Sign in to send a message
          </h1>
          <Link
            to="/login"
            className="bg-[#ff6e20] text-white text-[14px] font-semibold px-6 py-3 rounded-full"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = 6 - attachments.length;
    if (remaining <= 0) {
      showToast('You can attach up to 6 images per message.');
      return;
    }
    setUploadingImage(true);
    try {
      const selected = Array.from(files).slice(0, remaining);
      const uploadedUrls: string[] = [];
      for (const file of selected) {
        const url = await customerApi.uploadChatImage(file);
        uploadedUrls.push(url);
      }
      setAttachments((prev) => [...prev, ...uploadedUrls]);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to upload image.',
      );
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInsertUrl = () => {
    const raw = urlDraft.trim();
    if (!raw) return;
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    setMessage((prev) => (prev.trim() ? `${prev.trim()} ${normalized}` : normalized));
    setUrlDraft('');
    setShowUrlInput(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && attachments.length === 0) return;
    setSubmitting(true);
    try {
      const ticket = await createTicket({
        message: message.trim() || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        store_id: storeIdParam,
        order_id: orderIdParam,
      });
      navigate(`/help/tickets?chat=${ticket.id}`);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to send message.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="kova-container px-4 lg:px-6 pt-5 pb-12 max-w-[780px]">
      <p className="text-[12px] text-[#767676] mb-3">
        <Link to="/help/tickets" className="hover:text-[#ff6e20]">
          Messages
        </Link>{' '}
        &nbsp;/&nbsp;{' '}
        {storeIdParam ? `Message ${recipientName}` : 'Kova Support'}
      </p>

      <div className="bg-white border border-[#ececec] rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        {/* Recipient Profile Header */}
        <div className="px-6 py-5 border-b border-[#ececec] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="w-12 h-12 rounded-full border border-[#ececec] bg-[#ffefe6] text-[#ff6e20] overflow-hidden shrink-0 flex items-center justify-center">
              {recipientLogo ? (
                <img
                  src={recipientLogo}
                  alt={recipientName}
                  className="w-full h-full object-cover"
                />
              ) : storeIdParam ? (
                <FigmaIcon name="home" className="w-5 h-5" />
              ) : (
                <MessageCircle className="w-5 h-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[18px] font-bold text-black flex items-center gap-1.5 truncate">
                <span className="truncate">{recipientName}</span>
                {recipientVerified && <VerifiedBadge size="xs" />}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-[#767676]">
                <span>
                  {storeIdParam
                    ? 'Direct message to store'
                    : 'Kova customer support'}
                </span>
                {orderNumberParam && (
                  <span className="bg-[#ffefe6] text-[#ff6e20] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                    Order #{orderNumberParam}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {storeIdParam && storeSlugParam && (
              <Link
                to={`/store/${storeSlugParam}`}
                className="bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-black text-[12px] font-semibold px-3.5 py-1.5 rounded-full transition-colors"
              >
                View store
              </Link>
            )}
            {storeIdParam && (
              <button
                type="button"
                onClick={() => setSearchParams({}, { replace: true })}
                className="text-[12px] font-medium text-[#767676] hover:text-black underline"
              >
                Kova Support
              </button>
            )}
          </div>
        </div>

        {/* Clean Modern Composer */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-3.5">
          <PendingAttachmentsBar
            attachments={attachments}
            onRemove={(idx) =>
              setAttachments((prev) => prev.filter((_, i) => i !== idx))
            }
          />

          <textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              storeIdParam
                ? `Write your message or paste a link for ${recipientName}...`
                : 'Write your message or paste a link for Kova Support...'
            }
            className="w-full bg-[#fafafa] focus:bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-[18px] p-4 text-[14.5px] text-black placeholder:text-[#979797] outline-none resize-none transition-colors leading-relaxed"
          />

          {showUrlInput && (
            <div className="flex items-center gap-2 bg-[#f7f7f7] border border-[#ececec] rounded-full px-3.5 py-1.5">
              <Link2 className="w-4 h-4 text-[#767676] shrink-0" />
              <input
                type="text"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleInsertUrl();
                  }
                }}
                placeholder="Paste URL (https://...)"
                className="flex-1 bg-transparent text-[13px] text-black outline-none min-w-0"
              />
              <button
                type="button"
                onClick={handleInsertUrl}
                className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[11.5px] font-semibold px-3 py-1 rounded-full"
              >
                Insert
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void handleImageUpload(e.target.files)}
              />
              <button
                type="button"
                disabled={uploadingImage}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] border border-[#ececec] text-[#555555] text-[12.5px] font-semibold px-3.5 py-2 rounded-full transition-colors"
              >
                <ImagePlus className="w-4 h-4" />
                <span>{uploadingImage ? 'Uploading...' : 'Add photo'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowUrlInput((v) => !v)}
                className={`inline-flex items-center gap-1.5 border text-[12.5px] font-semibold px-3.5 py-2 rounded-full transition-colors ${
                  showUrlInput
                    ? 'bg-[#ffefe6] border-[#ffdfcd] text-[#ff6e20]'
                    : 'bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] border-[#ececec] text-[#555555]'
                }`}
              >
                <Link2 className="w-4 h-4" />
                <span>Add URL</span>
              </button>
              <Link
                to="/help/tickets"
                className="text-[12.5px] font-semibold text-[#767676] hover:text-black ml-1"
              >
                Conversations
              </Link>
            </div>

            <button
              type="submit"
              disabled={
                submitting ||
                uploadingImage ||
                (!message.trim() && attachments.length === 0)
              }
              className="inline-flex items-center gap-2 bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-50 text-white text-[14px] font-semibold px-6 py-2.5 rounded-full transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Sending...' : 'Send message'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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
    <div className="h-screen w-full overflow-hidden bg-[#f7f7f7] flex flex-col">
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
            <span className="bg-[#ffefe6] text-[#ff6e20] text-[10px] font-bold px-2.5 py-[3px] rounded-full tracking-wide">
              MESSAGES
            </span>
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
