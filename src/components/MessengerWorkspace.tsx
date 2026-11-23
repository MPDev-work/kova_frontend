import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  CheckSquare,
  ImagePlus,
  MessageCircle,
  MessageCircleMore,
  MoreHorizontal,
  RefreshCw,
  Search,
  Send,
  SquarePen,
  Trash2,
} from 'lucide-react';
import {
  ChatMessageBody,
  PendingAttachmentsBar,
  PendingContextCardBar,
} from './ChatMessageContent';
import { consumePendingChatCard } from '../utils/chatContextCard';
import { FigmaIcon } from './FigmaIcon';
import { VerifiedBadge } from './VerifiedBadge';
import { useStore } from '../context/StoreContext';
import { useConfirmDelete } from '../context/ConfirmDeleteContext';
import { ApiError, customerApi } from '../services/api';
import {
  adminApi,
  storeOwnerApi,
  type DashboardTicketItem,
} from '../services/dashboardApi';
import { formatChatTimestamp, formatShortDate } from '../utils/currency';
import type {
  ChatContextCard,
  ChatMessageMetadata,
  SupportTicket,
} from '../types/marketplace';

type WorkspaceMode = 'customer' | 'seller' | 'admin';
type FilterTab = 'all' | 'active' | 'unread';

type UnifiedTicket = SupportTicket | DashboardTicketItem;

function getMessageMinuteKey(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
}

function getLastPreview(ticket: UnifiedTicket, mode: WorkspaceMode): string {
  const latest = ticket.latest_message;
  if (latest) {
    const isOwn =
      mode === 'customer' ? !latest.is_admin_reply : latest.is_admin_reply;
    const card = latest.metadata?.context_card;
    const body =
      latest.message?.trim() ||
      (latest.attachments && latest.attachments.length > 0
        ? latest.attachments.length === 1
          ? 'Sent a photo'
          : `Sent ${latest.attachments.length} photos`
        : card
          ? card.kind === 'order' && card.order_number
            ? `Order #${card.order_number.replace(/^#/, '')}`
            : card.product_name
          : '');
    if (!body) return 'New message';
    return isOwn ? `You: ${body}` : body;
  }
  const initialBody =
    ticket.message?.trim() ||
    (ticket.attachments && ticket.attachments.length > 0
      ? ticket.attachments.length === 1
        ? 'Sent a photo'
        : `Sent ${ticket.attachments.length} photos`
      : '');
  if (!initialBody) return 'Start a conversation';
  return mode === 'customer' ? `You: ${initialBody}` : initialBody;
}

export function MessengerWorkspace({
  mode,
  fullScreen = false,
}: {
  mode: WorkspaceMode;
  fullScreen?: boolean;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshNotifications, showToast } = useStore();
  const { confirmDelete } = useConfirmDelete();

  const [tickets, setTickets] = useState<UnifiedTicket[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const [selectedId, setSelectedId] = useState<number | null>(
    () => Number(searchParams.get('chat')) || null,
  );
  const [activeTicket, setActiveTicket] = useState<UnifiedTicket | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);

  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<string[]>([]);
  const [pendingContextCard, setPendingContextCard] =
    useState<ChatContextCard | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevThreadMetaRef = useRef<{ id: number | null; count: number }>({
    id: null,
    count: 0,
  });
  const forceScrollBottomRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const handledStartKeyRef = useRef<string | null>(null);

  const fetchList = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingList(true);
      try {
        if (mode === 'admin') {
          const res = await adminApi.getTickets({ per_page: 50 });
          setTickets(res.tickets.data);
        } else if (mode === 'seller') {
          const res = await storeOwnerApi.getTickets({ per_page: 50 });
          setTickets(res.tickets.data);
        } else {
          const list = await customerApi.getTickets();
          setTickets(list);
        }
      } catch (err) {
        if (!silent) {
          showToast(
            err instanceof ApiError
              ? err.message
              : 'Unable to load conversations.',
          );
        }
      } finally {
        if (!silent) setLoadingList(false);
      }
    },
    [mode, showToast],
  );

  const fetchThread = useCallback(
    async (id: number, silent = false) => {
      if (!silent) setLoadingThread(true);
      try {
        const data =
          mode === 'admin'
            ? await adminApi.getTicket(id)
            : mode === 'seller'
              ? await storeOwnerApi.getTicket(id)
              : await customerApi.getTicket(id);
        setActiveTicket(data);
        setTickets((prev) =>
          prev.map((item) =>
            item.id === data.id
              ? {
                  ...item,
                  is_unread: false,
                  is_blocked: data.is_blocked,
                  blocked_by_me: data.blocked_by_me,
                  peer_is_online: data.peer_is_online,
                  peer_last_active_at: data.peer_last_active_at,
                }
              : item,
          ),
        );
        if (!silent) {
          void refreshNotifications(false);
        }
      } catch (err) {
        if (!silent) {
          showToast(
            err instanceof ApiError
              ? err.message
              : 'Unable to load conversation.',
          );
          setActiveTicket(null);
        }
      } finally {
        if (!silent) setLoadingThread(false);
      }
    },
    [mode, showToast, refreshNotifications],
  );

  useEffect(() => {
    if (!menuOpen && !chatMenuOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      if (
        chatMenuRef.current &&
        !chatMenuRef.current.contains(event.target as Node)
      ) {
        setChatMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setChatMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen, chatMenuOpen]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetchList(false);
    }, 0);
    return () => window.clearTimeout(t);
  }, [fetchList]);

  // Sync ?chat=<id> query param (e.g. when clicking Reply from NotificationModal)
  const chatParamId = Number(searchParams.get('chat')) || null;
  useEffect(() => {
    if (chatParamId && chatParamId !== selectedId) {
      const t = window.setTimeout(() => setSelectedId(chatParamId), 0);
      return () => window.clearTimeout(t);
    }
  }, [chatParamId, selectedId]);

  const startDirectConversation = useCallback(
    async (opts: { storeId?: number | null; orderId?: number | null }) => {
      if (mode !== 'customer') return;
      setLoadingThread(true);
      try {
        const started = await customerApi.startConversation({
          store_id: opts.storeId ?? null,
          order_id: opts.orderId ?? null,
        });
        setTickets((prev) => [
          started,
          ...prev.filter((item) => item.id !== started.id),
        ]);
        prevThreadMetaRef.current = { id: null, count: 0 };
        setSelectedId(started.id);
        setActiveTicket(started);
        const queuedCard = consumePendingChatCard(
          started.store_id ?? opts.storeId ?? null,
        );
        if (queuedCard) {
          setPendingContextCard(queuedCard);
        }
        setSearchParams({ chat: String(started.id) }, { replace: true });
        void fetchList(true);
        window.setTimeout(() => {
          replyTextareaRef.current?.focus();
        }, 60);
      } catch (err) {
        handledStartKeyRef.current = null;
        showToast(
          err instanceof ApiError
            ? err.message
            : 'Unable to start conversation.',
        );
      } finally {
        setLoadingThread(false);
      }
    },
    [mode, setSearchParams, showToast, fetchList],
  );

  // Auto-open or create conversation when arriving from any "Contact" button
  const shouldStartParam =
    mode === 'customer' &&
    (searchParams.get('start') === '1' ||
      Boolean(searchParams.get('storeId')) ||
      searchParams.get('target') === 'support');
  const startStoreId = Number(searchParams.get('storeId')) || null;
  const startOrderId = Number(searchParams.get('orderId')) || null;
  const startTarget = searchParams.get('target') || '';

  useEffect(() => {
    if (!shouldStartParam) {
      handledStartKeyRef.current = null;
      return;
    }
    const startKey = `${startStoreId ?? 'support'}:${startOrderId ?? ''}:${startTarget}`;
    const t = window.setTimeout(() => {
      if (handledStartKeyRef.current === startKey) return;
      handledStartKeyRef.current = startKey;
      void startDirectConversation({
        storeId: startStoreId,
        orderId: startOrderId,
      });
    }, 0);
    return () => window.clearTimeout(t);
  }, [
    shouldStartParam,
    startStoreId,
    startOrderId,
    startTarget,
    startDirectConversation,
  ]);

  useEffect(() => {
    if (!selectedId) {
      const t = window.setTimeout(() => setActiveTicket(null), 0);
      return () => window.clearTimeout(t);
    }
    const initTimer = window.setTimeout(() => {
      setReplyText('');
      setReplyAttachments([]);
      if (replyTextareaRef.current) {
        replyTextareaRef.current.style.height = 'auto';
      }
      void fetchThread(selectedId, false);
    }, 0);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchThread(selectedId, true);
        void fetchList(true);
      }
    }, 5000);

    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(interval);
    };
  }, [selectedId, fetchThread, fetchList]);

  const activeTicketId = activeTicket?.id ?? null;
  const activeMessageCount = activeTicket?.messages?.length ?? 0;

  useEffect(() => {
    if (!activeTicketId || loadingThread) return;
    const el = messagesContainerRef.current;
    if (!el) return;

    const prev = prevThreadMetaRef.current;
    const switchedChat = prev.id !== activeTicketId;
    const hasNewMessages =
      prev.id === activeTicketId && activeMessageCount > prev.count;

    prevThreadMetaRef.current = {
      id: activeTicketId,
      count: activeMessageCount,
    };

    if (switchedChat) {
      isNearBottomRef.current = true;
      el.scrollTop = el.scrollHeight;
    } else if (
      forceScrollBottomRef.current ||
      (hasNewMessages && isNearBottomRef.current)
    ) {
      forceScrollBottomRef.current = false;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [activeTicketId, activeMessageCount, loadingThread]);

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 120;
    isNearBottomRef.current = nearBottom;
    setShowScrollBottom(!nearBottom);
  };

  const scrollToBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    isNearBottomRef.current = true;
    setShowScrollBottom(false);
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  const selectChat = (id: number | null) => {
    if (id !== selectedId) {
      prevThreadMetaRef.current = { id: null, count: 0 };
      isNearBottomRef.current = true;
      setShowScrollBottom(false);
      setChatMenuOpen(false);
      setPendingContextCard(null);
    }
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    if (id) {
      next.set('chat', String(id));
    } else {
      next.delete('chat');
    }
    setSearchParams(next, { replace: true });
  };

  const getPeerProfile = (t: UnifiedTicket) => {
    const viewingAsStaff =
      mode !== 'customer' ||
      Boolean(user && t.user_id && t.user_id !== user.id);

    if (viewingAsStaff) {
      return {
        name: t.user?.name || 'Customer',
        avatar: t.user?.avatar || null,
        verified: false,
        subtitle: t.user?.email || formatShortDate(t.created_at),
        isStore: false,
        storeSlug: null as string | null,
      };
    }

    return {
      name: t.store?.name || 'Kova Support',
      avatar: t.store?.logo || null,
      verified: Boolean(t.store?.is_verified),
      subtitle: t.store ? 'Store support' : 'Kova Support',
      isStore: Boolean(t.store),
      storeSlug: t.store?.slug || null,
    };
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (filterTab === 'unread' && !t.is_unread) return false;
      if (
        filterTab === 'active' &&
        (Boolean(t.is_blocked) || !t.peer_is_online)
      ) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const cleanQ = q.replace(/^#/, '');
        const peer = getPeerProfile(t);
        const preview = getLastPreview(t, mode);
        return (
          peer.name.toLowerCase().includes(q) ||
          preview.toLowerCase().includes(q) ||
          (t.order?.order_number || '').toLowerCase().includes(cleanQ)
        );
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, filterTab, search, mode, user]);

  const toggleChatSelection = (id: number) => {
    setSelectedChatIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedChatIds([]);
  };

  const allVisibleSelected =
    filteredTickets.length > 0 &&
    filteredTickets.every((t) => selectedChatIds.includes(t.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedChatIds([]);
    } else {
      setSelectedChatIds(filteredTickets.map((t) => t.id));
    }
  };

  const selectedTicketsList = useMemo(
    () => tickets.filter((t) => selectedChatIds.includes(t.id)),
    [tickets, selectedChatIds],
  );

  const shouldUnblockSelected =
    selectedTicketsList.length > 0 &&
    selectedTicketsList.every(
      (t) => t.is_blocked && (t.blocked_by_me || mode === 'admin'),
    );

  const runBulkAction = async (
    action: 'mark_read' | 'delete' | 'block' | 'unblock',
    ids: number[],
  ) => {
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res =
        mode === 'admin'
          ? await adminApi.bulkTicketAction(action, ids)
          : mode === 'seller'
            ? await storeOwnerApi.bulkTicketAction(action, ids)
            : await customerApi.bulkTicketAction(action, ids);

      if (action === 'delete') {
        setTickets((prev) => prev.filter((t) => !ids.includes(t.id)));
        if (selectedId && ids.includes(selectedId)) {
          selectChat(null);
          setActiveTicket(null);
        }
      } else if (action === 'mark_read') {
        setTickets((prev) =>
          prev.map((t) =>
            ids.includes(t.id) ? { ...t, is_unread: false } : t,
          ),
        );
      } else if (action === 'block' || action === 'unblock') {
        const blocked = action === 'block';
        setTickets((prev) =>
          prev.map((t) =>
            ids.includes(t.id)
              ? { ...t, is_blocked: blocked, blocked_by_me: blocked }
              : t,
          ),
        );
        if (activeTicket && ids.includes(activeTicket.id)) {
          setActiveTicket({
            ...activeTicket,
            is_blocked: blocked,
            blocked_by_me: blocked,
          });
        }
      }

      showToast(res.message || 'Conversations updated.');
      exitSelectionMode();
      void fetchList(true);
      void refreshNotifications(false);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to update selected conversations.',
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const requestDeleteConversations = (ids: number[], label?: string) => {
    if (ids.length === 0) return;
    const idList = [...ids];
    const count = idList.length;
    const itemLabel =
      label || (count === 1 ? 'conversation' : `${count} conversations`);

    confirmDelete({
      title:
        count === 1 ? 'Delete conversation?' : `Delete ${count} conversations?`,
      description:
        count === 1
          ? `Remove "${itemLabel}" from your inbox?`
          : `Remove ${count} selected conversations from your inbox?`,
      itemLabel,
      onOptimisticRemove: () => {
        setTickets((prev) => prev.filter((t) => !idList.includes(t.id)));
        if (selectedId && idList.includes(selectedId)) {
          selectChat(null);
          setActiveTicket(null);
        }
        exitSelectionMode();
      },
      onUndo: () => {
        void fetchList(true);
      },
      onCommit: async () => {
        await runBulkAction('delete', idList);
      },
    });
  };

  const handleMarkAllAsRead = async () => {
    setMenuOpen(false);
    setBulkBusy(true);
    try {
      const res =
        mode === 'admin'
          ? await adminApi.markAllTicketsRead()
          : mode === 'seller'
            ? await storeOwnerApi.markAllTicketsRead()
            : await customerApi.markAllTicketsRead();
      setTickets((prev) => prev.map((t) => ({ ...t, is_unread: false })));
      showToast(res.message || 'All conversations marked as read.');
      void refreshNotifications(false);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to mark all conversations as read.',
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = 6 - replyAttachments.length;
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
    if (
      !activeTicket ||
      (!replyText.trim() &&
        replyAttachments.length === 0 &&
        !pendingContextCard)
    ) {
      return;
    }
    setSending(true);
    try {
      forceScrollBottomRef.current = true;
      setShowScrollBottom(false);
      const metadataPayload = pendingContextCard
        ? { context_card: pendingContextCard }
        : undefined;
      if (mode === 'admin') {
        const res = await adminApi.replyTicket(
          activeTicket.id,
          replyText.trim(),
          replyAttachments,
          metadataPayload,
        );
        setActiveTicket(res.ticket);
      } else if (mode === 'seller') {
        const res = await storeOwnerApi.replyTicket(
          activeTicket.id,
          replyText.trim(),
          replyAttachments,
          metadataPayload,
        );
        setActiveTicket(res.ticket);
      } else {
        await customerApi.replyTicket(
          activeTicket.id,
          replyText.trim(),
          replyAttachments,
          metadataPayload,
        );
        const fresh = await customerApi.getTicket(activeTicket.id);
        setActiveTicket(fresh);
      }
      setReplyText('');
      setReplyAttachments([]);
      setPendingContextCard(null);
      if (replyTextareaRef.current) {
        replyTextareaRef.current.style.height = 'auto';
      }
      void fetchList(true);
      void refreshNotifications(false);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to send message.',
      );
    } finally {
      setSending(false);
    }
  };

  const activePeer = activeTicket ? getPeerProfile(activeTicket) : null;
  const activeViewingAsStaff = Boolean(
    activeTicket &&
    (mode !== 'customer' ||
      (user && activeTicket.user_id && activeTicket.user_id !== user.id)),
  );

  return (
    <div
      className={
        fullScreen
          ? 'bg-white flex flex-1 min-h-0 w-full overflow-hidden'
          : 'bg-white border border-[#ececec] rounded-[22px] overflow-hidden shadow-[0_6px_24px_rgba(0,0,0,0.04)] flex h-[calc(100vh-124px)] min-h-[560px]'
      }
    >
      {/* LEFT PANE: Messenger-style Chats Sidebar */}
      <aside
        className={`${
          selectedId ? 'hidden lg:flex' : 'flex'
        } w-full lg:w-[340px] xl:w-[360px] border-r border-[#ececec] bg-white flex-col shrink-0`}
      >
        {/* Top Row: Title + Action Circles */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-2 shrink-0">
          <h1 className="text-[22px] font-bold text-black tracking-tight">
            Chats
          </h1>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void fetchList(false)}
              title="Refresh chats"
              aria-label="Refresh chats"
              className="w-9 h-9 rounded-full bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555] flex items-center justify-center transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                title="Chat options"
                aria-label="Chat options"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  menuOpen || selectionMode
                    ? 'bg-[#ffefe6] text-[#ff6e20]'
                    : 'bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555]'
                }`}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-[210px] bg-white border border-[#ececec] rounded-[14px] shadow-[0_12px_32px_rgba(0,0,0,0.12)] py-1.5 z-30"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      if (selectionMode) {
                        exitSelectionMode();
                      } else {
                        setSelectionMode(true);
                        setSelectedChatIds([]);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-black hover:bg-[#f7f7f7] flex items-center gap-2.5 transition-colors"
                  >
                    <CheckSquare className="w-4 h-4 text-[#ff6e20] shrink-0" />
                    <span>
                      {selectionMode ? 'Cancel selection' : 'Select messages'}
                    </span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={bulkBusy}
                    onClick={() => void handleMarkAllAsRead()}
                    className="w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-black hover:bg-[#f7f7f7] flex items-center gap-2.5 transition-colors disabled:opacity-50"
                  >
                    <CheckCheck className="w-4 h-4 text-[#ff6e20] shrink-0" />
                    <span>Mark all as read</span>
                  </button>

                  {mode === 'customer' && (
                    <>
                      <div className="my-1 border-t border-[#f0f0f0]" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          void startDirectConversation({ storeId: null });
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-black hover:bg-[#f7f7f7] flex items-center gap-2.5 transition-colors"
                      >
                        <SquarePen className="w-4 h-4 text-[#767676] shrink-0" />
                        <span>Message Kova Support</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Input Pill */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 bg-[#f4f4f4] focus-within:bg-white border border-transparent focus-within:border-[#ff6e20] rounded-full px-3.5 h-[38px] transition-colors">
            <Search className="w-4 h-4 text-[#8a8a8a] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages..."
              className="flex-1 bg-transparent text-[13px] text-black placeholder:text-[#8a8a8a] outline-none min-w-0"
            />
          </div>
        </div>

        {/* Selection Mode Header OR Filter Pills */}
        {selectionMode ? (
          <div className="px-4 pb-2.5 flex items-center justify-between gap-2 shrink-0 border-b border-[#f0f0f0] mb-1">
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-black hover:text-[#ff6e20] transition-colors"
            >
              <span
                className={`w-4.5 h-4.5 rounded-[5px] border flex items-center justify-center transition-colors ${
                  allVisibleSelected
                    ? 'bg-[#ff6e20] border-[#ff6e20] text-white'
                    : 'bg-white border-[#cfcfcf]'
                }`}
              >
                {allVisibleSelected && (
                  <Check className="w-3 h-3" strokeWidth={3} />
                )}
              </span>
              <span>
                {selectedChatIds.length > 0
                  ? `${selectedChatIds.length} selected`
                  : 'Select all'}
              </span>
            </button>
            <button
              type="button"
              onClick={exitSelectionMode}
              className="text-[12.5px] font-semibold text-[#767676] hover:text-black transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="px-4 pb-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'unread', label: 'Unread' },
              ] as const
            ).map((tab) => {
              const active = filterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-[12.5px] whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[#ffefe6] text-[#ff6e20] font-semibold'
                      : 'text-[#555555] font-medium hover:bg-[#f4f4f4]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-0.5">
          {loadingList ? (
            <div className="py-12 text-center text-[13px] text-[#8a8a8a]">
              Loading chats...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="py-12 px-4 text-center flex flex-col items-center gap-2">
              <span className="w-11 h-11 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </span>
              <p className="text-[13.5px] font-semibold text-black">
                No conversations
              </p>
              <p className="text-[12px] text-[#8a8a8a]">
                {filterTab === 'active' && !search.trim()
                  ? 'No one is currently online.'
                  : search.trim() || filterTab !== 'all'
                    ? 'Try clearing your search or filter.'
                    : mode === 'customer'
                      ? 'Start a chat with a store or Kova Support.'
                      : 'Incoming customer messages will appear here.'}
              </p>
            </div>
          ) : (
            filteredTickets.map((t) => {
              const peer = getPeerProfile(t);
              const isSelected = selectedId === t.id;
              const isChecked = selectedChatIds.includes(t.id);
              const isUnread = Boolean(t.is_unread);
              const isBlocked = Boolean(t.is_blocked);
              const isPeerOnline = !isBlocked && Boolean(t.peer_is_online);
              const preview = getLastPreview(t, mode);

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    selectionMode ? toggleChatSelection(t.id) : selectChat(t.id)
                  }
                  className={`w-full text-left px-3 py-2.5 rounded-[14px] flex items-center gap-3 transition-colors ${
                    selectionMode
                      ? isChecked
                        ? 'bg-[#ffefe6]'
                        : 'hover:bg-[#f7f7f7]'
                      : isSelected
                        ? 'bg-[#ffefe6]'
                        : 'hover:bg-[#f7f7f7]'
                  }`}
                >
                  {selectionMode && (
                    <span
                      className={`w-5 h-5 rounded-[6px] border shrink-0 flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'bg-[#ff6e20] border-[#ff6e20] text-white'
                          : 'bg-white border-[#cfcfcf]'
                      }`}
                    >
                      {isChecked && (
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                      )}
                    </span>
                  )}

                  <div className="relative shrink-0">
                    <span className="w-12 h-12 rounded-full border border-[#ececec] bg-[#ffefe6] text-[#ff6e20] overflow-hidden flex items-center justify-center text-[15px] font-bold">
                      {peer.avatar ? (
                        <img
                          src={peer.avatar}
                          alt={peer.name}
                          className="w-full h-full object-cover"
                        />
                      ) : peer.isStore ? (
                        <FigmaIcon name="home" className="w-5 h-5" />
                      ) : mode === 'customer' && !peer.isStore ? (
                        <MessageCircle className="w-5 h-5" />
                      ) : (
                        peer.name.charAt(0).toUpperCase()
                      )}
                    </span>
                    {isPeerOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#1e90ff] border-2 border-white" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p
                        className={`text-[14px] truncate ${
                          isUnread
                            ? 'font-bold text-black'
                            : 'font-semibold text-black'
                        }`}
                      >
                        {peer.name}
                      </p>
                      {peer.verified && <VerifiedBadge size="xs" />}
                      {isBlocked && (
                        <span className="bg-[#f4f4f4] text-[#767676] text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0">
                          Blocked
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[12.5px] truncate mt-0.5 ${
                        isUnread ? 'text-black font-semibold' : 'text-[#767676]'
                      }`}
                    >
                      {preview} ·{' '}
                      {formatChatTimestamp(
                        t.latest_message?.created_at ||
                          t.updated_at ||
                          t.created_at,
                      )}
                    </p>
                  </div>

                  {!selectionMode && isUnread && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff6e20] shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Sticky Bulk Action Bar in Selection Mode */}
        {selectionMode && (
          <div className="border-t border-[#ececec] bg-white px-3 py-2.5 flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={selectedChatIds.length === 0 || bulkBusy}
              onClick={() => void runBulkAction('mark_read', selectedChatIds)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] disabled:opacity-45 text-black text-[12px] font-semibold py-2 px-2.5 rounded-full transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Mark read</span>
            </button>
            <button
              type="button"
              disabled={selectedChatIds.length === 0 || bulkBusy}
              onClick={() =>
                void runBulkAction(
                  shouldUnblockSelected ? 'unblock' : 'block',
                  selectedChatIds,
                )
              }
              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#f4f4f4] hover:bg-[#fff0f0] hover:text-[#d93025] disabled:opacity-45 text-black text-[12px] font-semibold py-2 px-2.5 rounded-full transition-colors"
            >
              <Ban className="w-3.5 h-3.5 shrink-0" />
              <span>{shouldUnblockSelected ? 'Unblock' : 'Block'}</span>
            </button>
            <button
              type="button"
              disabled={selectedChatIds.length === 0 || bulkBusy}
              onClick={() => requestDeleteConversations(selectedChatIds)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#fff0f0] hover:bg-[#d93025] text-[#d93025] hover:text-white disabled:opacity-45 text-[12px] font-semibold py-2 px-2.5 rounded-full transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </aside>

      {/* RIGHT PANE: Active Conversation OR "No chats selected" Empty State */}
      <section
        className={`${
          selectedId ? 'flex' : 'hidden lg:flex'
        } flex-1 min-w-0 flex-col bg-[#fafafa]`}
      >
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
            <div className="w-20 h-20 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center mb-4">
              <MessageCircleMore className="w-10 h-10" strokeWidth={1.8} />
            </div>
            <h2 className="text-[19px] font-bold text-black">
              No chats selected
            </h2>
            <p className="text-[13.5px] text-[#767676] mt-1 max-w-[320px]">
              Choose a conversation from the left to read messages, send photos,
              and reply.
            </p>
          </div>
        ) : loadingThread && !activeTicket ? (
          <div className="flex-1 flex items-center justify-center text-[13.5px] text-[#767676]">
            Loading conversation...
          </div>
        ) : !activeTicket || !activePeer ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2">
            <p className="text-[15px] font-semibold text-black">
              Conversation unavailable
            </p>
            <button
              type="button"
              onClick={() => selectChat(null)}
              className="text-[13px] font-semibold text-[#ff6e20] hover:underline"
            >
              Back to chats
            </button>
          </div>
        ) : (
          <>
            {/* Active Chat Header */}
            <div className="bg-white border-b border-[#ececec] px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => selectChat(null)}
                  aria-label="Back to chats"
                  className="lg:hidden w-8 h-8 rounded-full bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-black flex items-center justify-center shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <div className="relative shrink-0">
                  <span className="w-10 h-10 rounded-full border border-[#ececec] bg-[#ffefe6] text-[#ff6e20] overflow-hidden flex items-center justify-center text-[14px] font-bold">
                    {activePeer.avatar ? (
                      <img
                        src={activePeer.avatar}
                        alt={activePeer.name}
                        className="w-full h-full object-cover"
                      />
                    ) : activePeer.isStore ? (
                      <FigmaIcon name="home" className="w-4 h-4" />
                    ) : mode === 'customer' && !activePeer.isStore ? (
                      <MessageCircle className="w-4 h-4" />
                    ) : (
                      activePeer.name.charAt(0).toUpperCase()
                    )}
                  </span>
                  {!activeTicket.is_blocked && activeTicket.peer_is_online && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#1e90ff] border-2 border-white" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {activePeer.storeSlug ? (
                      <Link
                        to={`/store/${activePeer.storeSlug}`}
                        className="text-[15px] font-bold text-black hover:text-[#ff6e20] truncate transition-colors"
                      >
                        {activePeer.name}
                      </Link>
                    ) : (
                      <p className="text-[15px] font-bold text-black truncate">
                        {activePeer.name}
                      </p>
                    )}
                    {activePeer.verified && <VerifiedBadge size="xs" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span
                      className={`font-medium ${
                        !activeTicket.is_blocked && activeTicket.peer_is_online
                          ? 'text-[#1e90ff]'
                          : 'text-[#8a8a8a]'
                      }`}
                    >
                      {!activeTicket.is_blocked && activeTicket.peer_is_online
                        ? 'Active'
                        : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>

              <div ref={chatMenuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setChatMenuOpen((prev) => !prev)}
                  title="Conversation options"
                  aria-label="Conversation options"
                  aria-expanded={chatMenuOpen}
                  aria-haspopup="menu"
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    chatMenuOpen
                      ? 'bg-[#ffefe6] text-[#ff6e20]'
                      : 'bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555]'
                  }`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {chatMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-[180px] bg-white border border-[#ececec] rounded-[14px] shadow-[0_12px_32px_rgba(0,0,0,0.12)] py-1.5 z-30"
                  >
                    {(!activeTicket.is_blocked ||
                      activeTicket.blocked_by_me ||
                      mode === 'admin') && (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={bulkBusy}
                        onClick={() => {
                          setChatMenuOpen(false);
                          void runBulkAction(
                            activeTicket.is_blocked ? 'unblock' : 'block',
                            [activeTicket.id],
                          );
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-black hover:bg-[#f7f7f7] flex items-center gap-2.5 transition-colors disabled:opacity-50"
                      >
                        <Ban className="w-4 h-4 text-[#767676] shrink-0" />
                        <span>
                          {activeTicket.is_blocked ? 'Unblock' : 'Block'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      role="menuitem"
                      disabled={bulkBusy}
                      onClick={() => {
                        setChatMenuOpen(false);
                        requestDeleteConversations(
                          [activeTicket.id],
                          activePeer?.name || activeTicket.subject,
                        );
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-[#d93025] hover:bg-[#fff0f0] flex items-center gap-2.5 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4 shrink-0" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable Message Thread */}
            <div className="relative flex-1 min-h-0 flex flex-col">
              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="flex-1 overflow-y-auto px-5 py-5 flex flex-col"
              >
                {/* Empty new conversation welcome header */}
                {!activeTicket.message?.trim() &&
                  (!activeTicket.attachments ||
                    activeTicket.attachments.length === 0) &&
                  (!activeTicket.messages ||
                    activeTicket.messages.length === 0) && (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 text-center select-none">
                      <span className="w-16 h-16 rounded-full border border-[#ececec] bg-[#ffefe6] text-[#ff6e20] overflow-hidden flex items-center justify-center text-[20px] font-bold mb-3">
                        {activePeer.avatar ? (
                          <img
                            src={activePeer.avatar}
                            alt={activePeer.name}
                            className="w-full h-full object-cover"
                          />
                        ) : activePeer.isStore ? (
                          <FigmaIcon name="home" className="w-7 h-7" />
                        ) : (
                          <MessageCircle className="w-7 h-7" />
                        )}
                      </span>
                      <p className="text-[16px] font-bold text-black flex items-center gap-1.5">
                        <span>{activePeer.name}</span>
                        {activePeer.verified && <VerifiedBadge size="xs" />}
                      </p>
                      <p className="text-[13px] text-[#767676] mt-1 max-w-[300px]">
                        Start a conversation with {activePeer.name}. Send a
                        message or photo below.
                      </p>
                    </div>
                  )}

                {(() => {
                  const threadItems: {
                    key: string;
                    isOwn: boolean;
                    senderKey: string;
                    senderName: string;
                    senderAvatar: string | null;
                    isSupportFallback: boolean;
                    message?: string | null;
                    attachments?: string[] | null;
                    metadata?: ChatMessageMetadata | null;
                    createdAt: string;
                    minuteKey: string;
                  }[] = [];

                  const hasInitialContent =
                    Boolean(activeTicket.message?.trim()) ||
                    Boolean(
                      activeTicket.attachments &&
                      activeTicket.attachments.length > 0,
                    );

                  if (hasInitialContent) {
                    const isOwnInitial = !activeViewingAsStaff;
                    const customerName = activeTicket.user?.name || 'Customer';
                    const customerAvatar = activeTicket.user?.avatar || null;
                    threadItems.push({
                      key: `initial-${activeTicket.id}`,
                      isOwn: isOwnInitial,
                      senderKey: isOwnInitial
                        ? 'self'
                        : `customer-${activeTicket.user_id ?? '0'}`,
                      senderName: isOwnInitial ? 'You' : customerName,
                      senderAvatar: isOwnInitial ? null : customerAvatar,
                      isSupportFallback: false,
                      message: activeTicket.message,
                      attachments: activeTicket.attachments,
                      metadata: null,
                      createdAt: activeTicket.created_at,
                      minuteKey: getMessageMinuteKey(activeTicket.created_at),
                    });
                  }

                  (activeTicket.messages || []).forEach((msg) => {
                    const isOwn = activeViewingAsStaff
                      ? msg.is_admin_reply
                      : !msg.is_admin_reply;
                    const senderName = isOwn
                      ? 'You'
                      : msg.is_admin_reply
                        ? activeTicket.store?.name || 'Kova Support'
                        : msg.user?.name ||
                          activeTicket.user?.name ||
                          'Customer';
                    const senderAvatar = isOwn
                      ? null
                      : msg.is_admin_reply
                        ? activeTicket.store?.logo || msg.user?.avatar || null
                        : msg.user?.avatar || activeTicket.user?.avatar || null;
                    threadItems.push({
                      key: String(msg.id),
                      isOwn,
                      senderKey: isOwn
                        ? 'self'
                        : msg.is_admin_reply
                          ? `staff-${activeTicket.store?.id ?? 'support'}`
                          : `customer-${msg.user?.id ?? activeTicket.user_id ?? '0'}`,
                      senderName,
                      senderAvatar,
                      isSupportFallback: Boolean(
                        msg.is_admin_reply && !activeTicket.store,
                      ),
                      message: msg.message,
                      attachments: msg.attachments,
                      metadata: msg.metadata ?? null,
                      createdAt: msg.created_at,
                      minuteKey: getMessageMinuteKey(msg.created_at),
                    });
                  });

                  return threadItems.map((item, idx) => {
                    const prev = idx > 0 ? threadItems[idx - 1] : null;
                    const next =
                      idx < threadItems.length - 1
                        ? threadItems[idx + 1]
                        : null;
                    const sameMinuteAsPrev = Boolean(
                      prev &&
                      prev.senderKey === item.senderKey &&
                      prev.minuteKey !== '' &&
                      prev.minuteKey === item.minuteKey,
                    );
                    const sameMinuteAsNext = Boolean(
                      next &&
                      next.senderKey === item.senderKey &&
                      next.minuteKey !== '' &&
                      next.minuteKey === item.minuteKey,
                    );
                    const showTimestamp = !sameMinuteAsNext;
                    const showPeerAvatar = !item.isOwn && !sameMinuteAsNext;

                    return (
                      <div
                        key={item.key}
                        className={`flex items-end gap-2.5 ${
                          item.isOwn ? 'justify-end' : 'justify-start'
                        } ${
                          idx === 0 ? '' : sameMinuteAsPrev ? 'mt-1' : 'mt-3.5'
                        }`}
                      >
                        {!item.isOwn &&
                          (showPeerAvatar ? (
                            <span className="w-8 h-8 rounded-full border border-[#ececec] bg-[#ffefe6] text-[#ff6e20] overflow-hidden shrink-0 flex items-center justify-center text-[11px] font-bold">
                              {item.senderAvatar ? (
                                <img
                                  src={item.senderAvatar}
                                  alt={item.senderName}
                                  className="w-full h-full object-cover"
                                />
                              ) : item.isSupportFallback ? (
                                <MessageCircle className="w-4 h-4" />
                              ) : (
                                item.senderName.charAt(0).toUpperCase()
                              )}
                            </span>
                          ) : (
                            <span
                              className="w-8 h-8 shrink-0"
                              aria-hidden="true"
                            />
                          ))}
                        <div
                          className={`max-w-[78%] flex flex-col ${
                            item.isOwn ? 'items-end' : 'items-start'
                          }`}
                        >
                          <ChatMessageBody
                            message={item.message}
                            attachments={item.attachments}
                            metadata={item.metadata}
                            isOwn={item.isOwn}
                            viewerMode={mode}
                          />
                          {showTimestamp && (
                            <span className="text-[11px] text-[#8a8a8a] mt-1 px-1">
                              {formatChatTimestamp(item.createdAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {showScrollBottom && (
                <button
                  type="button"
                  onClick={scrollToBottom}
                  aria-label="Scroll to latest messages"
                  title="Jump to latest"
                  className="absolute bottom-4 right-5 w-9 h-9 rounded-full bg-white hover:bg-[#ffefe6] text-[#ff6e20] border border-[#ececec] shadow-[0_6px_18px_rgba(0,0,0,0.12)] flex items-center justify-center transition-colors"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Bottom Composer Bar OR Blocked Banner */}
            {activeTicket.is_blocked ? (
              <div className="bg-white border-t border-[#ececec] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 text-[13px] text-[#767676]">
                  <Ban className="w-4 h-4 text-[#d93025] shrink-0" />
                  <span>
                    {activeTicket.blocked_by_me
                      ? 'You blocked this conversation.'
                      : 'This conversation is blocked. Replies are disabled.'}
                  </span>
                </div>
                {(activeTicket.blocked_by_me || mode === 'admin') && (
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() =>
                      void runBulkAction('unblock', [activeTicket.id])
                    }
                    className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-50 text-white text-[12.5px] font-semibold px-4 py-1.5 rounded-full transition-colors"
                  >
                    Unblock
                  </button>
                )}
              </div>
            ) : (
              <form
                onSubmit={handleSendReply}
                className="bg-white border-t border-[#ececec] px-4 py-3 flex flex-col gap-2 shrink-0"
              >
                <PendingContextCardBar
                  card={pendingContextCard}
                  onRemove={() => setPendingContextCard(null)}
                />
                <PendingAttachmentsBar
                  attachments={replyAttachments}
                  onRemove={(idx) =>
                    setReplyAttachments((prev) =>
                      prev.filter((_, i) => i !== idx),
                    )
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
                    className="w-9 h-9 mb-0.5 rounded-full bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555] flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
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
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
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
                        : 'Write a message... (Shift + Enter for new line)'
                    }
                    className="flex-1 bg-[#f4f4f4] focus:bg-white border border-transparent focus:border-[#ff6e20] rounded-[20px] px-4 py-2.5 text-[14px] leading-[1.45] text-black placeholder:text-[#8a8a8a] outline-none transition-colors min-w-0 resize-none max-h-[140px] overflow-y-auto no-scrollbar"
                  />
                  <button
                    type="submit"
                    disabled={
                      sending ||
                      uploadingImage ||
                      (!replyText.trim() &&
                        replyAttachments.length === 0 &&
                        !pendingContextCard)
                    }
                    className="mb-0.5 inline-flex items-center gap-1.5 bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-45 text-white px-4.5 py-2 rounded-full text-[13px] font-semibold transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sending ? 'Sending...' : 'Send'}</span>
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}
