import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { ApiError, customerApi } from '../../services/api';
import { formatShortDate } from '../../utils/currency';
import type { SupportTicket } from '../../types/marketplace';

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
          Search answers or submit a support ticket.
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
            title: 'Support tickets',
            desc: 'Create or follow up on a support case.',
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
          View my tickets
        </Link>
      </div>
    </div>
  );
}

export function ContactSupportPage() {
  const { isSignedIn, createTicket, showToast } = useStore();
  const navigate = useNavigate();

  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isSignedIn) {
    return (
      <div className="kova-container px-4 py-16 text-center">
        <div className="bg-white border border-[#ececec] rounded-[24px] p-10 max-w-[480px] mx-auto flex flex-col items-center gap-4">
          <h1 className="text-[22px] font-semibold text-black">
            Sign in to submit a support ticket
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const ticket = await createTicket({ subject, message, priority });
      navigate(`/help/tickets/${ticket.id}`);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to create ticket.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="kova-container px-4 lg:px-6 pt-5 pb-12 max-w-[820px]">
      <p className="text-[12px] text-[#767676] mb-3">
        <Link to="/help" className="hover:text-[#ff6e20]">
          Help &amp; support
        </Link>{' '}
        &nbsp;/&nbsp; Contact support
      </p>
      <div className="bg-white border border-[#ececec] rounded-[22px] p-7 flex flex-col gap-5">
        <h1 className="text-[28px] font-semibold text-black">
          Contact Kova Support
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium">Subject</span>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Briefly describe your issue"
              className="border border-[#ececec] rounded-[14px] px-4 py-3 text-[14px]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium">Priority</span>
            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as 'low' | 'medium' | 'high')
              }
              className="border border-[#ececec] rounded-[14px] px-4 py-3 text-[14px] bg-white"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium">Message</span>
            <textarea
              rows={5}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us how we can help..."
              className="border border-[#ececec] rounded-[16px] p-4 text-[14px]"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="self-start bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[14px] font-semibold px-7 py-3 rounded-full"
          >
            {submitting ? 'Submitting...' : 'Submit support ticket'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function SupportTicketsPage() {
  const { isSignedIn, tickets, refreshTickets } = useStore();

  useEffect(() => {
    if (isSignedIn) void refreshTickets();
  }, [isSignedIn, refreshTickets]);

  return (
    <div className="kova-container px-4 lg:px-6 pt-5 pb-12 flex flex-col gap-5">
      <p className="text-[12px] text-[#767676]">
        Help &amp; support &nbsp;/&nbsp; Support tickets
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[30px] font-semibold text-black">
          My support tickets
        </h1>
        <Link
          to="/help/contact"
          className="bg-[#ff6e20] text-white text-[14px] font-semibold px-5 py-2.5 rounded-full"
        >
          New ticket
        </Link>
      </div>

      {!isSignedIn ? (
        <div className="bg-white border border-[#ececec] rounded-[20px] p-10 text-center">
          <p className="text-[15px] text-[#767676] mb-3">
            Sign in to view your support tickets.
          </p>
          <Link
            to="/login"
            className="bg-[#ff6e20] text-white text-[14px] font-semibold px-6 py-2.5 rounded-full"
          >
            Sign in
          </Link>
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white border border-[#ececec] rounded-[20px] p-10 text-center text-[14px] text-[#767676]">
          You have no support tickets yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tickets.map((t) => (
            <Link
              key={t.id}
              to={`/help/tickets/${t.id}`}
              className="bg-white border border-[#ececec] hover:border-[#ff6e20] rounded-[20px] p-6 flex flex-wrap items-center justify-between gap-4 transition-colors"
            >
              <div>
                <p className="text-[12px] text-[#767676]">
                  {t.ticket_number} · Priority: {t.priority}
                </p>
                <p className="text-[17px] font-semibold text-black mt-0.5">
                  {t.subject}
                </p>
                <p className="text-[13px] text-[#767676] mt-0.5">
                  Updated {formatShortDate(t.updated_at)}
                </p>
              </div>
              <span className="px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold bg-[#ffefe6] text-[#ff6e20] capitalize">
                {t.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { replyTicket, showToast } = useStore();
  const numericTicketId = Number(ticketId);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(Boolean(numericTicketId));
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const reloadTicket = async (id: number) => {
    try {
      const data = await customerApi.getTicket(id);
      setTicket(data);
    } catch {
      setTicket(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!numericTicketId) return;
    let active = true;
    customerApi
      .getTicket(numericTicketId)
      .then((data) => {
        if (active) setTicket(data);
      })
      .catch(() => {
        if (active) setTicket(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [numericTicketId]);

  if (loading) {
    return (
      <div className="kova-container px-4 py-16 text-center text-[14px] text-[#767676]">
        Loading ticket...
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="kova-container px-4 py-16 text-center">
        <p className="text-[16px] font-semibold">Ticket not found</p>
      </div>
    );
  }

  return (
    <div className="kova-container px-4 lg:px-6 pt-5 pb-12 max-w-[860px] flex flex-col gap-5">
      <p className="text-[12px] text-[#767676]">
        <Link to="/help/tickets" className="hover:text-[#ff6e20]">
          Support tickets
        </Link>{' '}
        &nbsp;/&nbsp; {ticket.ticket_number}
      </p>
      <div className="bg-white border border-[#ececec] rounded-[22px] p-6 flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#ececec]">
          <div>
            <h1 className="text-[24px] font-semibold text-black">
              {ticket.subject}
            </h1>
            <p className="text-[13px] text-[#767676]">
              {ticket.ticket_number} · {formatShortDate(ticket.created_at)}
            </p>
          </div>
          <span className="bg-[#ffefe6] text-[#ff6e20] text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full capitalize">
            {ticket.status}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-[16px] p-4 max-w-[85%] self-end bg-[#ffefe6] text-black">
            <p className="text-[14px] leading-[1.5]">{ticket.message}</p>
          </div>
          {(ticket.messages || []).map((m) => (
            <div
              key={m.id}
              className={`rounded-[16px] p-4 max-w-[85%] ${
                m.is_admin_reply
                  ? 'self-start bg-[#f7f7f7] text-black'
                  : 'self-end bg-[#ffefe6] text-black'
              }`}
            >
              <p className="text-[12px] font-semibold text-[#767676] mb-1">
                {m.user?.name || (m.is_admin_reply ? 'Support' : 'You')} ·{' '}
                {formatShortDate(m.created_at)}
              </p>
              <p className="text-[14px] leading-[1.5]">{m.message}</p>
            </div>
          ))}
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!reply.trim()) return;
            setSending(true);
            try {
              await replyTicket(ticket.id, reply.trim());
              setReply('');
              await reloadTicket(ticket.id);
            } catch (err) {
              showToast(
                err instanceof ApiError ? err.message : 'Unable to send reply.',
              );
            } finally {
              setSending(false);
            }
          }}
          className="flex gap-2 pt-2"
        >
          <input
            type="text"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply..."
            className="flex-1 border border-[#ececec] rounded-full px-4 py-3 text-[14px] outline-none focus:border-[#ff6e20]"
          />
          <button
            type="submit"
            disabled={sending}
            className="bg-[#ff6e20] disabled:opacity-60 text-white px-5 py-3 rounded-full text-[14px] font-semibold"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
