import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, ImagePlus, MessageCircle, Send } from 'lucide-react';
import {
  ChatMessageBody,
  PendingAttachmentsBar,
} from './ChatMessageContent';
import { DashboardModal } from './DashboardPrimitives';
import { FigmaIcon } from './FigmaIcon';
import { VerifiedBadge } from './VerifiedBadge';
import { useStore } from '../context/StoreContext';
import { ApiError, customerApi } from '../services/api';
import { formatShortDate } from '../utils/currency';
import { validateUploadFile } from '../utils/mediaUpload';
import type { SupportTicket } from '../types/marketplace';

interface ChatThreadModalProps {
  ticketId: number | null;
  onClose: () => void;
  onMessageSent?: () => void;
}

export function ChatThreadModal({
  ticketId,
  onClose,
  onMessageSent,
}: ChatThreadModalProps) {
  const { user, replyTicket, refreshNotifications, showToast } = useStore();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const prevThreadMetaRef = useRef<{ id: number | null; count: number }>({
    id: null,
    count: 0,
  });
  const forceScrollBottomRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!ticketId) {
      prevThreadMetaRef.current = { id: null, count: 0 };
      return;
    }
    let active = true;
    const initTimer = window.setTimeout(() => {
      setLoading(true);
      setReplyText('');
      setReplyAttachments([]);
      if (replyTextareaRef.current) {
        replyTextareaRef.current.style.height = 'auto';
      }
      customerApi
        .getTicket(ticketId)
        .then((data) => {
          if (active) setTicket(data);
        })
        .catch(() => {
          if (active) setTicket(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void customerApi
          .getTicket(ticketId)
          .then((data) => {
            if (active) setTicket(data);
          })
          .catch(() => {
            // Keep current thread on transient error
          });
      }
    }, 5000);

    return () => {
      active = false;
      window.clearTimeout(initTimer);
      window.clearInterval(interval);
    };
  }, [ticketId]);

  const activeTicketId = ticket?.id ?? null;
  const activeMessageCount = ticket?.messages?.length ?? 0;

  useEffect(() => {
    if (!activeTicketId || loading) return;
    const prev = prevThreadMetaRef.current;
    const switchedChat = prev.id !== activeTicketId;
    const hasNewMessages =
      prev.id === activeTicketId && activeMessageCount > prev.count;

    prevThreadMetaRef.current = {
      id: activeTicketId,
      count: activeMessageCount,
    };

    if (switchedChat) {
      threadEndRef.current?.scrollIntoView({ behavior: 'auto' });
      return;
    }

    if (forceScrollBottomRef.current) {
      forceScrollBottomRef.current = false;
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (hasNewMessages) {
      const scroller = threadEndRef.current?.closest('.overflow-y-auto');
      if (
        !scroller ||
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140
      ) {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [activeTicketId, activeMessageCount, loading]);

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = 6 - replyAttachments.length;
    if (remaining <= 0) {
      showToast('You can attach up to 6 images per message.');
      return;
    }
    setUploadingImage(true);
    try {
      const validFiles: File[] = [];
      for (const file of Array.from(files)) {
        const error = validateUploadFile(file, 'image');
        if (error) {
          showToast(error);
          continue;
        }
        validFiles.push(file);
        if (validFiles.length >= remaining) break;
      }
      if (validFiles.length === 0) return;

      const uploadedUrls: string[] = [];
      for (const file of validFiles) {
        const url = await customerApi.uploadChatImage(file);
        uploadedUrls.push(url);
      }
      setReplyAttachments((prev) => [...prev, ...uploadedUrls]);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to upload image.',
      );
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || (!replyText.trim() && replyAttachments.length === 0)) return;
    setSending(true);
    try {
      forceScrollBottomRef.current = true;
      await replyTicket(ticket.id, replyText.trim(), replyAttachments);
      setReplyText('');
      setReplyAttachments([]);
      if (replyTextareaRef.current) {
        replyTextareaRef.current.style.height = 'auto';
      }
      const fresh = await customerApi.getTicket(ticket.id);
      setTicket(fresh);
      void refreshNotifications(false);
      onMessageSent?.();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to send reply.',
      );
    } finally {
      setSending(false);
    }
  };

  const viewingAsStaff = Boolean(
    ticket && user && ticket.user_id && ticket.user_id !== user.id,
  );
  const headerName = ticket
    ? viewingAsStaff
      ? ticket.user?.name || 'Customer'
      : ticket.store?.name || 'Kova Support'
    : 'Conversation';
  const headerAvatar = ticket
    ? viewingAsStaff
      ? ticket.user?.avatar || null
      : ticket.store?.logo || null
    : null;
  const headerVerified = Boolean(
    ticket && !viewingAsStaff && ticket.store?.is_verified,
  );
  const headerSubtitle = ticket
    ? `${formatShortDate(ticket.created_at)}${
        ticket.order ? ` · Order #${ticket.order.order_number}` : ''
      }`
    : undefined;

  return (
    <DashboardModal
      open={Boolean(ticketId)}
      onClose={onClose}
      title={headerName}
      subtitle={headerSubtitle}
      widthClass="max-w-[680px]"
      footer={
        ticket &&
        (ticket.is_blocked ? (
          <div className="w-full flex items-center justify-between gap-3 py-1">
            <div className="flex items-center gap-2 text-[13px] text-[#767676]">
              <Ban className="w-4 h-4 text-[#d93025] shrink-0" />
              <span>
                {ticket.blocked_by_me
                  ? 'You blocked this conversation.'
                  : 'This conversation is blocked.'}
              </span>
            </div>
            {ticket.blocked_by_me && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await customerApi.bulkTicketAction('unblock', [ticket.id]);
                    const fresh = await customerApi.getTicket(ticket.id);
                    setTicket(fresh);
                    showToast('Conversation unblocked.');
                    onMessageSent?.();
                  } catch (err) {
                    showToast(
                      err instanceof ApiError
                        ? err.message
                        : 'Unable to unblock conversation.',
                    );
                  }
                }}
                className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4 py-1.5 rounded-full transition-colors"
              >
                Unblock
              </button>
            )}
          </div>
        ) : (
          <form
            onSubmit={handleSendReply}
            className="w-full flex flex-col gap-2"
          >
            <PendingAttachmentsBar
              attachments={replyAttachments}
              onRemove={(idx) =>
                setReplyAttachments((prev) => prev.filter((_, i) => i !== idx))
              }
            />

            <div className="flex items-end gap-2">
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
                title="Send photo"
                aria-label="Send photo"
                className="w-10 h-10 rounded-full bg-white hover:bg-[#ffefe6] hover:text-[#ff6e20] border border-[#ececec] text-[#555555] flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
              >
                <ImagePlus className="w-4 h-4" />
              </button>
              <textarea
                ref={replyTextareaRef}
                rows={1}
                value={replyText}
                onChange={(e) => {
                  setReplyText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 132)}px`;
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={
                  uploadingImage
                    ? 'Uploading photo...'
                    : 'Write your reply... (Shift + Enter for new line)'
                }
                className="flex-1 bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-[20px] px-4 py-2.5 text-[13.5px] leading-[1.45] text-black outline-none min-w-0 resize-none max-h-[132px] overflow-y-auto no-scrollbar"
              />
              <button
                type="submit"
                disabled={
                  sending ||
                  uploadingImage ||
                  (!replyText.trim() && replyAttachments.length === 0)
                }
                className="inline-flex items-center gap-1.5 bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-50 text-white text-[13px] font-semibold px-5 py-2.5 rounded-full transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? 'Sending...' : 'Send'}</span>
              </button>
            </div>
          </form>
        ))
      }
    >
      {loading ? (
        <div className="py-12 text-center text-[13.5px] text-[#767676]">
          Loading conversation...
        </div>
      ) : !ticket ? (
        <div className="py-12 text-center text-[14px] text-[#767676]">
          Conversation not found.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Profile Card Bar (matches Seller & Admin chat modal) */}
          <div className="bg-[#f7f7f7] border border-[#ececec] p-3.5 flex flex-wrap items-center justify-between gap-3 rounded-[14px]">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-full border border-[#ececec] bg-[#ffefe6] text-[#ff6e20] overflow-hidden shrink-0 flex items-center justify-center text-[13px] font-bold">
                {headerAvatar ? (
                  <img
                    src={headerAvatar}
                    alt={headerName}
                    className="w-full h-full object-cover"
                  />
                ) : viewingAsStaff ? (
                  headerName.charAt(0).toUpperCase()
                ) : ticket.store ? (
                  <FigmaIcon name="home" className="w-4 h-4" />
                ) : (
                  <MessageCircle className="w-4 h-4" />
                )}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {!viewingAsStaff && ticket.store ? (
                    <Link
                      to={`/store/${ticket.store.slug}`}
                      onClick={onClose}
                      className="text-[14px] font-semibold text-black hover:text-[#ff6e20] truncate"
                    >
                      {headerName}
                    </Link>
                  ) : (
                    <p className="text-[14px] font-semibold text-black truncate">
                      {headerName}
                    </p>
                  )}
                  {headerVerified && <VerifiedBadge size="xs" />}
                </div>
                <p className="text-[12px] text-[#767676] truncate">
                  {viewingAsStaff
                    ? ticket.user?.email || formatShortDate(ticket.created_at)
                    : ticket.store
                      ? 'Store support'
                      : 'Kova customer support'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {ticket.order && (
                <Link
                  to={`/account/orders?order=${encodeURIComponent(ticket.order.order_number)}`}
                  onClick={onClose}
                  className="text-[11.5px] font-semibold bg-white border border-[#ececec] hover:border-[#ff6e20] text-black px-2.5 py-1 rounded-full transition-colors"
                >
                  Order #{ticket.order.order_number}
                </Link>
              )}
              <span className="bg-white border border-[#ececec] text-black text-[12px] font-semibold px-3 py-1 rounded-full capitalize">
                Status: {ticket.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Chat Thread Canvas */}
          <div className="bg-[#fafafa] border border-[#ececec] p-2.5 flex flex-col gap-3 min-h-[240px] rounded-[14px]">
            {(() => {
              const hasInitial =
                Boolean(ticket.message?.trim()) ||
                Boolean(ticket.attachments && ticket.attachments.length > 0);
              if (!hasInitial) return null;
              const isOwnInitial = !viewingAsStaff;
              const customerName = ticket.user?.name || 'Customer';
              return (
                <div
                  className={`max-w-[82%] flex flex-col ${
                    isOwnInitial
                      ? 'self-end items-end'
                      : 'self-start items-start'
                  }`}
                >
                  <ChatMessageBody
                    message={ticket.message}
                    attachments={ticket.attachments}
                    isOwn={isOwnInitial}
                  />
                  <span className="text-[11px] text-[#8a8a8a] mt-1 px-1">
                    {isOwnInitial ? 'You' : customerName} ·{' '}
                    {formatShortDate(ticket.created_at)}
                  </span>
                </div>
              );
            })()}

            {(ticket.messages || []).map((msg) => {
              const isOwn = viewingAsStaff
                ? msg.is_admin_reply
                : !msg.is_admin_reply;
              const senderName = isOwn
                ? 'You'
                : msg.is_admin_reply
                  ? ticket.store?.name || 'Kova Support'
                  : msg.user?.name || ticket.user?.name || 'Customer';
              return (
                <div
                  key={msg.id}
                  className={`max-w-[82%] flex flex-col ${
                    isOwn ? 'self-end items-end' : 'self-start items-start'
                  }`}
                >
                  <ChatMessageBody
                    message={msg.message}
                    attachments={msg.attachments}
                    metadata={msg.metadata}
                    isOwn={isOwn}
                    viewerMode={viewingAsStaff ? 'seller' : 'customer'}
                    onCardNavigate={onClose}
                  />
                  <span className="text-[11px] text-[#8a8a8a] mt-1 px-1">
                    {senderName} · {formatShortDate(msg.created_at)}
                  </span>
                </div>
              );
            })}
            <div ref={threadEndRef} />
          </div>
        </div>
      )}
    </DashboardModal>
  );
}
