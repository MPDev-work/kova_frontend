import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCheck, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import {
  ChatMessageBody,
  PendingAttachmentsBar,
  PendingContextCardBar,
} from './ChatMessageContent';
import { consumePendingChatCard } from '../utils/chatContextCard';
import { validateUploadFile } from '../utils/mediaUpload';
import { FigmaIcon, ICON_STROKE_WIDTH } from './FigmaIcon';
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
import { runOptimisticMutation } from '../utils/optimisticSync';
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
    const hasVoice = Boolean(latest.metadata?.voice?.url);
    const body =
      latest.message?.trim() ||
      (hasVoice
        ? 'Voice message'
        : latest.attachments && latest.attachments.length > 0
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

export interface MessengerStartRequest {
  storeId?: number | null;
  orderId?: number | null;
  target?: 'support';
  nonce: number;
}

export function MessengerWorkspace({
  mode,
  fullScreen = false,
  drawerMode = false,
  isMaximized = false,
  onToggleMaximize,
  onCloseDrawer,
  initialChatId = null,
  startRequest = null,
}: {
  mode: WorkspaceMode;
  fullScreen?: boolean;
  drawerMode?: boolean;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onCloseDrawer?: () => void;
  initialChatId?: number | null;
  startRequest?: MessengerStartRequest | null;
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshNotifications, showToast } = useStore();
  const { confirmDelete } = useConfirmDelete();

  const [tickets, setTickets] = useState<UnifiedTicket[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const [drawerSelectedId, setDrawerSelectedId] = useState<number | null>(
    drawerMode ? initialChatId : null,
  );
  const selectedId = drawerMode
    ? drawerSelectedId
    : Number(searchParams.get('chat')) || null;
  const [activeTicket, setActiveTicket] = useState<UnifiedTicket | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);

  useEffect(() => {
    if (!drawerMode) return;
    const t = window.setTimeout(() => {
      setDrawerSelectedId(initialChatId ?? null);
    }, 0);
    return () => window.clearTimeout(t);
  }, [drawerMode, initialChatId]);

  const selectedIdRef = useRef<number | null>(selectedId);
  const activeTicketRef = useRef<UnifiedTicket | null>(activeTicket);
  const activeThreadReqRef = useRef(0);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    activeTicketRef.current = activeTicket;
  }, [activeTicket]);

  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<string[]>([]);
  const [pendingContextCard, setPendingContextCard] =
    useState<ChatContextCard | null>(null);
  const replyTextRef = useRef(replyText);
  const replyAttachmentsRef = useRef<string[]>(replyAttachments);
  const pendingContextCardRef = useRef<ChatContextCard | null>(
    pendingContextCard,
  );
  const lastInitializedChatIdRef = useRef<number | null>(null);

  useEffect(() => {
    replyTextRef.current = replyText;
  }, [replyText]);

  useEffect(() => {
    replyAttachmentsRef.current = replyAttachments;
  }, [replyAttachments]);

  useEffect(() => {
    pendingContextCardRef.current = pendingContextCard;
  }, [pendingContextCard]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const sending = false;
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  // Voice messenger state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadingVoice, setUploadingVoice] = useState(false);

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
  const dragDepthRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordCancelledRef = useRef(false);
  const recordStartMsRef = useRef(0);

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
      const reqSeq = silent
        ? activeThreadReqRef.current
        : ++activeThreadReqRef.current;
      if (!silent) setLoadingThread(true);
      try {
        const data =
          mode === 'admin'
            ? await adminApi.getTicket(id)
            : mode === 'seller'
              ? await storeOwnerApi.getTicket(id)
              : await customerApi.getTicket(id);
        if (selectedIdRef.current !== id) return;
        if (!silent && reqSeq !== activeThreadReqRef.current) return;
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
        if (selectedIdRef.current !== id) return;
        if (!silent && reqSeq === activeThreadReqRef.current) {
          showToast(
            err instanceof ApiError
              ? err.message
              : 'Unable to load conversation.',
          );
          setActiveTicket(null);
        }
      } finally {
        if (!silent && reqSeq === activeThreadReqRef.current) {
          setLoadingThread(false);
        }
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

  const startDirectConversation = useCallback(
    async (opts: { storeId?: number | null; orderId?: number | null }) => {
      if (mode !== 'customer') return;
      const reqSeq = ++activeThreadReqRef.current;
      setLoadingThread(true);
      try {
        const started = await customerApi.startConversation({
          store_id: opts.storeId ?? null,
          order_id: opts.orderId ?? null,
        });
        if (reqSeq !== activeThreadReqRef.current) return;
        setTickets((prev) => [
          started,
          ...prev.filter((item) => item.id !== started.id),
        ]);
        prevThreadMetaRef.current = { id: null, count: 0 };
        selectedIdRef.current = started.id;
        activeTicketRef.current = started;
        setActiveTicket(started);
        const queuedCard = consumePendingChatCard(
          started.store_id ?? opts.storeId ?? null,
        );
        if (queuedCard) {
          pendingContextCardRef.current = queuedCard;
          setPendingContextCard(queuedCard);
        }
        if (drawerMode) {
          setDrawerSelectedId(started.id);
        } else {
          setSearchParams({ chat: String(started.id) }, { replace: true });
        }
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
        if (reqSeq === activeThreadReqRef.current) {
          setLoadingThread(false);
        }
      }
    },
    [mode, drawerMode, setSearchParams, showToast, fetchList],
  );

  // Auto-open or create conversation when arriving from any "Contact" button
  const shouldStartParam =
    mode === 'customer' &&
    (drawerMode
      ? Boolean(startRequest)
      : searchParams.get('start') === '1' ||
        Boolean(searchParams.get('storeId')) ||
        searchParams.get('target') === 'support');
  const startStoreId = drawerMode
    ? (startRequest?.storeId ?? null)
    : Number(searchParams.get('storeId')) || null;
  const startOrderId = drawerMode
    ? (startRequest?.orderId ?? null)
    : Number(searchParams.get('orderId')) || null;
  const startTarget = drawerMode
    ? startRequest?.target || ''
    : searchParams.get('target') || '';
  const startNonce = drawerMode ? (startRequest?.nonce ?? 0) : 0;

  useEffect(() => {
    if (!shouldStartParam) {
      handledStartKeyRef.current = null;
      return;
    }
    const startKey = `${startNonce}:${startStoreId ?? 'support'}:${startOrderId ?? ''}:${startTarget}`;
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
    startNonce,
    startStoreId,
    startOrderId,
    startTarget,
    startDirectConversation,
  ]);

  useEffect(() => {
    if (!selectedId) {
      lastInitializedChatIdRef.current = null;
      const t = window.setTimeout(() => {
        setActiveTicket(null);
        setLoadingThread(false);
      }, 0);
      return () => window.clearTimeout(t);
    }
    const alreadyLoaded = activeTicketRef.current?.id === selectedId;
    const switchedToNewChat = lastInitializedChatIdRef.current !== selectedId;
    lastInitializedChatIdRef.current = selectedId;
    const initTimer = window.setTimeout(() => {
      if (switchedToNewChat) {
        setReplyText('');
        setReplyAttachments([]);
        if (replyTextareaRef.current) {
          replyTextareaRef.current.style.height = 'auto';
        }
      }
      void fetchThread(selectedId, alreadyLoaded);
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
      cancelVoiceRecording();
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);
      prevThreadMetaRef.current = { id: null, count: 0 };
      isNearBottomRef.current = true;
      setShowScrollBottom(false);
      setChatMenuOpen(false);
      setPendingContextCard(null);
      setReplyText('');
      setReplyAttachments([]);
      if (replyTextareaRef.current) {
        replyTextareaRef.current.style.height = 'auto';
      }
      selectedIdRef.current = id;
      if (id) {
        setLoadingThread(true);
        if (activeTicketRef.current?.id !== id) {
          setActiveTicket(null);
        }
      } else {
        setActiveTicket(null);
        setLoadingThread(false);
      }
    }
    if (drawerMode) {
      setDrawerSelectedId(id);
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete('start');
    next.delete('storeId');
    next.delete('orderId');
    next.delete('target');
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
    const prevTickets = tickets;
    showToast('All conversations marked as read.');
    void runOptimisticMutation({
      label: 'Mark all conversations read',
      applyOptimistic: () => {
        setTickets((prev) => prev.map((t) => ({ ...t, is_unread: false })));
      },
      commit: () =>
        mode === 'admin'
          ? adminApi.markAllTicketsRead()
          : mode === 'seller'
            ? storeOwnerApi.markAllTicketsRead()
            : customerApi.markAllTicketsRead(),
      onSuccess: () => {
        void refreshNotifications(false);
      },
      rollback: () => {
        setTickets(prevTickets);
      },
      offlineRequest: {
        path:
          mode === 'admin'
            ? '/admin/tickets/mark-all-read'
            : mode === 'seller'
              ? '/store-owner/tickets/mark-all-read'
              : '/customer/tickets/mark-all-read',
        method: 'POST',
        dedupeKey: `mark-all-read-${mode}`,
      },
      onToast: showToast,
      errorToast: (err) =>
        err instanceof ApiError
          ? err.message
          : 'Unable to mark all conversations as read.',
    });
  };

  const handleImageUpload = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    for (const file of fileArray) {
      const err = validateUploadFile(file, 'image');
      if (err) {
        showToast(err);
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const remaining = 6 - replyAttachments.length;
    if (remaining <= 0) {
      showToast('You can attach up to 6 images per message.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploadingImage(true);
    try {
      const selected = validFiles.slice(0, remaining);
      const uploadedUrls: string[] = [];
      for (const file of selected) {
        const url = await customerApi.uploadChatImage(file, 'standard');
        uploadedUrls.push(url);
      }
      setReplyAttachments((prev) => {
        const next = [...prev, ...uploadedUrls];
        replyAttachmentsRef.current = next;
        return next;
      });
      window.setTimeout(() => {
        replyTextareaRef.current?.focus();
      }, 40);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to upload image.',
      );
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const cleanupRecordingResources = useCallback(() => {
    if (recordTimerRef.current !== null) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      recordCancelledRef.current = true;
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore stop errors on unmount
        }
      }
      cleanupRecordingResources();
    };
  }, [cleanupRecordingResources]);

  const cancelVoiceRecording = useCallback(() => {
    recordCancelledRef.current = true;
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        // Ignore
      }
    }
    cleanupRecordingResources();
    setIsRecording(false);
    setRecordingSeconds(0);
  }, [cleanupRecordingResources]);

  const stopAndSendVoiceRecording = useCallback(() => {
    recordCancelledRef.current = false;
    if (recordTimerRef.current !== null) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.requestData();
      } catch {
        // Ignore if browser doesn't support requestData before stop
      }
      rec.stop();
    } else {
      cleanupRecordingResources();
      setIsRecording(false);
      setRecordingSeconds(0);
    }
  }, [cleanupRecordingResources]);

  const startVoiceRecording = async () => {
    if (!activeTicket || isRecording || uploadingVoice || sending) return;
    if (
      typeof window === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      showToast('Voice recording is not supported in this browser.');
      return;
    }

    let stream: MediaStream;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (constraintErr) {
        const name =
          constraintErr instanceof DOMException ? constraintErr.name : '';
        if (name === 'OverconstrainedError' || name === 'TypeError') {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
          throw constraintErr;
        }
      }
    } catch (err) {
      cleanupRecordingResources();
      setIsRecording(false);
      const errName = err instanceof DOMException ? err.name : '';
      if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        showToast('No microphone was detected on this device.');
      } else if (
        errName === 'NotReadableError' ||
        errName === 'TrackStartError'
      ) {
        showToast(
          'Your microphone is busy or unavailable in another app. Close other mic apps and try again.',
        );
      } else {
        showToast(
          'Microphone permission is blocked. Allow microphone access in your browser settings.',
        );
      }
      return;
    }

    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0 || audioTracks[0].readyState === 'ended') {
        stream.getTracks().forEach((t) => t.stop());
        showToast('Microphone audio track is unavailable. Check your mic input device.');
        return;
      }

      const candidateMimes = [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ];
      const supportedCandidates = candidateMimes.filter((m) => {
        try {
          return (
            typeof MediaRecorder.isTypeSupported === 'function' &&
            MediaRecorder.isTypeSupported(m)
          );
        } catch {
          return false;
        }
      });

      // Try each supported MIME type, then fall back to browser default (no options)
      let recorder: MediaRecorder | null = null;
      let chosenMime = '';
      for (const mime of [...supportedCandidates, '']) {
        try {
          const candidate = mime
            ? new MediaRecorder(stream, { mimeType: mime })
            : new MediaRecorder(stream);
          recorder = candidate;
          chosenMime = candidate.mimeType || mime;
          break;
        } catch {
          // Try next supported format
        }
      }

      if (!recorder) {
        stream.getTracks().forEach((t) => t.stop());
        showToast('Voice recording format is not supported on this device.');
        return;
      }

      const targetTicketId = activeTicket.id;
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recordCancelledRef.current = false;
      recordStartMsRef.current = Date.now();

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onerror = () => {
        cleanupRecordingResources();
        setIsRecording(false);
        setRecordingSeconds(0);
        showToast('Voice recording stopped unexpectedly. Please try again.');
      };

      recorder.onstop = async () => {
        const wasCancelled = recordCancelledRef.current;
        const chunks = [...audioChunksRef.current];
        const elapsedSeconds = Math.max(
          1,
          Math.round((Date.now() - recordStartMsRef.current) / 1000),
        );
        const actualMime =
          recorder?.mimeType || chosenMime || chunks[0]?.type || 'audio/webm';

        cleanupRecordingResources();
        setIsRecording(false);
        setRecordingSeconds(0);

        if (wasCancelled || chunks.length === 0) return;

        const blob = new Blob(chunks, { type: actualMime });
        if (blob.size === 0) return;
        const ext = actualMime.includes('mp4')
          ? 'm4a'
          : actualMime.includes('ogg')
            ? 'ogg'
            : actualMime.includes('mpeg') || actualMime.includes('mp3')
              ? 'mp3'
              : actualMime.includes('wav')
                ? 'wav'
                : 'webm';
        const audioFile = new File([blob], `voice-${Date.now()}.${ext}`, {
          type: actualMime,
        });

        const sizeErr = validateUploadFile(audioFile, 'audio');
        if (sizeErr) {
          showToast(sizeErr);
          return;
        }

        setUploadingVoice(true);
        try {
          const audioUrl = await customerApi.uploadChatAudio(audioFile);
          forceScrollBottomRef.current = true;
          setShowScrollBottom(false);

          // Include any tagged order/product card (and optional text/photos) with the voice message
          const attachedCard = pendingContextCardRef.current;
          const attachedImages = [...replyAttachmentsRef.current];
          const attachedText = replyTextRef.current.trim();
          const voiceMeta: ChatMessageMetadata = {
            voice: {
              url: audioUrl,
              duration: elapsedSeconds,
              mime_type: actualMime,
            },
            ...(attachedCard ? { context_card: attachedCard } : {}),
          };
          const attachmentsArg =
            attachedImages.length > 0 ? attachedImages : undefined;

          if (mode === 'admin') {
            const res = await adminApi.replyTicket(
              targetTicketId,
              attachedText,
              attachmentsArg,
              voiceMeta,
            );
            if (selectedIdRef.current === targetTicketId) {
              setActiveTicket(res.ticket);
            }
          } else if (mode === 'seller') {
            const res = await storeOwnerApi.replyTicket(
              targetTicketId,
              attachedText,
              attachmentsArg,
              voiceMeta,
            );
            if (selectedIdRef.current === targetTicketId) {
              setActiveTicket(res.ticket);
            }
          } else {
            await customerApi.replyTicket(
              targetTicketId,
              attachedText,
              attachmentsArg,
              voiceMeta,
            );
            const fresh = await customerApi.getTicket(targetTicketId);
            if (selectedIdRef.current === targetTicketId) {
              setActiveTicket(fresh);
            }
          }

          if (attachedCard) {
            pendingContextCardRef.current = null;
            setPendingContextCard(null);
          }
          if (attachedImages.length > 0) {
            replyAttachmentsRef.current = [];
            setReplyAttachments([]);
          }
          if (attachedText) {
            replyTextRef.current = '';
            setReplyText('');
            if (replyTextareaRef.current) {
              replyTextareaRef.current.style.height = 'auto';
            }
          }

          void fetchList(true);
          void refreshNotifications(false);
        } catch (err) {
          showToast(
            err instanceof ApiError
              ? err.message
              : 'Unable to send voice message.',
          );
        } finally {
          setUploadingVoice(false);
        }
      };

      try {
        recorder.start(250);
      } catch {
        recorder.start();
      }
      setIsRecording(true);
      setRecordingSeconds(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          if (next >= 180) {
            stopAndSendVoiceRecording();
          }
          return next;
        });
      }, 1000);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      cleanupRecordingResources();
      setIsRecording(false);
      showToast('Unable to start voice recording. Check your microphone input device.');
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const handleChatDragEnter = (e: React.DragEvent<HTMLElement>) => {
    if (!matchedActiveTicket || headerTicket?.is_blocked) return;
    if (!Array.from(e.dataTransfer.types || []).includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  };

  const handleChatDragOver = (e: React.DragEvent<HTMLElement>) => {
    if (!matchedActiveTicket || headerTicket?.is_blocked) return;
    if (!Array.from(e.dataTransfer.types || []).includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleChatDragLeave = (e: React.DragEvent<HTMLElement>) => {
    if (!isDraggingFiles) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingFiles(false);
    }
  };

  const handleChatDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    if (!matchedActiveTicket || headerTicket?.is_blocked) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleImageUpload(e.dataTransfer.files);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const textToSend = (replyTextRef.current || replyText).trim();
    const attachmentsToSend =
      replyAttachmentsRef.current.length > 0
        ? [...replyAttachmentsRef.current]
        : [...replyAttachments];
    const cardToSend = pendingContextCardRef.current ?? pendingContextCard;

    if (
      !activeTicket ||
      (!textToSend && attachmentsToSend.length === 0 && !cardToSend)
    ) {
      return;
    }

    const targetTicketId = activeTicket.id;
    const isStaffReply =
      mode !== 'customer' ||
      Boolean(
        user && activeTicket.user_id && activeTicket.user_id !== user.id,
      );
    const metadataPayload = cardToSend
      ? { context_card: cardToSend }
      : undefined;
    const tempMsgId = -Date.now();
    const optimisticMsg = {
      id: tempMsgId,
      ticket_id: targetTicketId,
      user_id: user?.id ?? 0,
      message: textToSend,
      attachments: attachmentsToSend.length > 0 ? attachmentsToSend : null,
      metadata: metadataPayload ?? null,
      is_admin_reply: isStaffReply,
      created_at: new Date().toISOString(),
      user: user
        ? { id: user.id, name: user.name, avatar: user.avatar }
        : undefined,
    };

    const replyPath =
      mode === 'admin'
        ? `/admin/tickets/${targetTicketId}/reply`
        : mode === 'seller'
          ? `/store-owner/tickets/${targetTicketId}/reply`
          : `/customer/tickets/${targetTicketId}/reply`;

    void runOptimisticMutation({
      label: 'Send message',
      applyOptimistic: () => {
        forceScrollBottomRef.current = true;
        setShowScrollBottom(false);
        replyTextRef.current = '';
        replyAttachmentsRef.current = [];
        pendingContextCardRef.current = null;
        setReplyText('');
        setReplyAttachments([]);
        setPendingContextCard(null);
        if (replyTextareaRef.current) {
          replyTextareaRef.current.style.height = 'auto';
        }
        setActiveTicket((prev) =>
          prev && prev.id === targetTicketId
            ? ({
                ...prev,
                messages: [...(prev.messages || []), optimisticMsg],
                latest_message: optimisticMsg,
              } as UnifiedTicket)
            : prev,
        );
        setTickets((prev) =>
          prev.map((t) =>
            t.id === targetTicketId
              ? ({
                  ...t,
                  latest_message: optimisticMsg,
                  updated_at: optimisticMsg.created_at,
                } as UnifiedTicket)
              : t,
          ),
        );
      },
      commit: async () => {
        if (mode === 'admin') {
          const res = await adminApi.replyTicket(
            targetTicketId,
            textToSend,
            attachmentsToSend,
            metadataPayload,
          );
          return res.ticket;
        }
        if (mode === 'seller') {
          const res = await storeOwnerApi.replyTicket(
            targetTicketId,
            textToSend,
            attachmentsToSend,
            metadataPayload,
          );
          return res.ticket;
        }
        await customerApi.replyTicket(
          targetTicketId,
          textToSend,
          attachmentsToSend,
          metadataPayload,
        );
        return customerApi.getTicket(targetTicketId);
      },
      onSuccess: (freshTicket) => {
        if (selectedIdRef.current === targetTicketId) {
          setActiveTicket(freshTicket);
        }
        void fetchList(true);
        void refreshNotifications(false);
      },
      rollback: () => {
        setActiveTicket((prev) =>
          prev && prev.id === targetTicketId
            ? ({
                ...prev,
                messages: (prev.messages || []).filter(
                  (m) => m.id !== tempMsgId,
                ),
              } as UnifiedTicket)
            : prev,
        );
        // Restore draft so the user never loses their message
        if (!replyTextRef.current && textToSend) {
          replyTextRef.current = textToSend;
          setReplyText(textToSend);
        }
        if (
          replyAttachmentsRef.current.length === 0 &&
          attachmentsToSend.length > 0
        ) {
          replyAttachmentsRef.current = attachmentsToSend;
          setReplyAttachments(attachmentsToSend);
        }
        if (!pendingContextCardRef.current && cardToSend) {
          pendingContextCardRef.current = cardToSend;
          setPendingContextCard(cardToSend);
        }
      },
      offlineRequest: {
        path: replyPath,
        method: 'POST',
        body: {
          message: textToSend,
          attachments:
            attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
          metadata: metadataPayload ?? undefined,
        },
      },
      onReconcileAfterOffline: () => {
        if (selectedIdRef.current === targetTicketId) {
          void fetchThread(targetTicketId, true);
        }
        void fetchList(true);
      },
      onToast: showToast,
      errorToast: (err) =>
        err instanceof ApiError ? err.message : 'Unable to send message.',
    });
  };

  const matchedActiveTicket =
    activeTicket && activeTicket.id === selectedId ? activeTicket : null;
  const headerTicket =
    matchedActiveTicket ??
    (selectedId ? (tickets.find((t) => t.id === selectedId) ?? null) : null);
  const activePeer = headerTicket ? getPeerProfile(headerTicket) : null;
  const activeViewingAsStaff = Boolean(
    matchedActiveTicket &&
    (mode !== 'customer' ||
      (user &&
        matchedActiveTicket.user_id &&
        matchedActiveTicket.user_id !== user.id)),
  );

  return (
    <div
      className={
        fullScreen
          ? 'bg-white flex flex-1 min-h-0 w-full h-full overflow-hidden'
          : 'bg-white border border-[#ececec] rounded-[24px] overflow-hidden shadow-[0_6px_24px_rgba(0,0,0,0.04)] flex h-[calc(100vh-124px)] min-h-[560px]'
      }
    >
      {/* LEFT PANE: Messenger-style Chats Sidebar */}
      <aside
        className={
          drawerMode && !isMaximized
            ? `${selectedId ? 'hidden' : 'flex'} w-full flex-1 min-h-0 bg-white flex-col`
            : `${
                selectedId ? 'hidden lg:flex' : 'flex'
              } w-full lg:w-[340px] xl:w-[360px] border-r border-[#ececec] bg-white flex-col shrink-0`
        }
      >
        {/* Top Row: Title + Action Circles */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 min-w-0">
            {mode === 'customer' && !drawerMode && (
              <button
                type="button"
                onClick={() => {
                  if (window.history.state && window.history.state.idx > 0) {
                    navigate(-1);
                  } else {
                    navigate('/', { state: { allowStorefront: true } });
                  }
                }}
                title="Back"
                aria-label="Back to store"
                className="-ml-2 w-9 h-9 rounded-full hover:bg-[#f4f4f4] text-black flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              >
                <FigmaIcon name="chevron-left" className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-[22px] font-bold text-black tracking-tight">
              Chats
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void fetchList(false)}
              title="Refresh chats"
              aria-label="Refresh chats"
              className="w-9 h-9 rounded-full bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555] flex items-center justify-center transition-colors"
            >
              <FigmaIcon name="refresh-cw" className="w-4 h-4" />
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
                <FigmaIcon name="more-horizontal" className="w-4 h-4" />
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
                    <FigmaIcon
                      name="check-square"
                      className="w-4 h-4 text-[#ff6e20] shrink-0"
                    />
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
                    <CheckCheck
                      className="w-4 h-4 text-[#ff6e20] shrink-0"
                      strokeWidth={ICON_STROKE_WIDTH}
                    />
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
                        <FigmaIcon
                          name="edit"
                          className="w-4 h-4 text-[#767676] shrink-0"
                        />
                        <span>Message Kova Support</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {drawerMode && onToggleMaximize && (
              <button
                type="button"
                onClick={onToggleMaximize}
                title={isMaximized ? 'Minimize chat' : 'Maximize chat'}
                aria-label={isMaximized ? 'Minimize chat' : 'Maximize chat'}
                className={`${
                  isMaximized ? 'lg:hidden flex' : 'flex'
                } w-9 h-9 rounded-full bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555] items-center justify-center transition-colors cursor-pointer`}
              >
                {isMaximized ? (
                  <Minimize2
                    className="w-4 h-4"
                    strokeWidth={ICON_STROKE_WIDTH}
                  />
                ) : (
                  <Maximize2
                    className="w-4 h-4"
                    strokeWidth={ICON_STROKE_WIDTH}
                  />
                )}
              </button>
            )}

            {drawerMode && onCloseDrawer && (
              <button
                type="button"
                onClick={onCloseDrawer}
                title="Close messages"
                aria-label="Close messages"
                className={`${
                  isMaximized ? 'lg:hidden flex' : 'flex'
                } w-9 h-9 rounded-full bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555] items-center justify-center transition-colors cursor-pointer`}
              >
                <FigmaIcon name="x" className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search Input Pill */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 bg-[#f4f4f4] focus-within:bg-white border border-transparent focus-within:border-[#ff6e20] rounded-full px-3.5 h-[38px] transition-colors">
            <FigmaIcon
              name="search"
              className="w-4 h-4 text-[#8a8a8a] shrink-0"
            />
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
                  <FigmaIcon name="check" className="w-3 h-3" />
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
                <FigmaIcon name="message-circle" className="w-5 h-5" />
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
                        <FigmaIcon name="check" className="w-3.5 h-3.5" />
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
                        <FigmaIcon name="message-circle" className="w-5 h-5" />
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
              <CheckCheck
                className="w-3.5 h-3.5 shrink-0"
                strokeWidth={ICON_STROKE_WIDTH}
              />
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
              <FigmaIcon name="slash" className="w-3.5 h-3.5 shrink-0" />
              <span>{shouldUnblockSelected ? 'Unblock' : 'Block'}</span>
            </button>
            <button
              type="button"
              disabled={selectedChatIds.length === 0 || bulkBusy}
              onClick={() => requestDeleteConversations(selectedChatIds)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#fff0f0] hover:bg-[#d93025] text-[#d93025] hover:text-white disabled:opacity-45 text-[12px] font-semibold py-2 px-2.5 rounded-full transition-colors"
            >
              <FigmaIcon name="trash" className="w-3.5 h-3.5 shrink-0" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </aside>

      {/* RIGHT PANE: Active Conversation OR "No chats selected" Empty State */}
      <section
        onDragEnter={handleChatDragEnter}
        onDragOver={handleChatDragOver}
        onDragLeave={handleChatDragLeave}
        onDrop={handleChatDrop}
        className={`${
          drawerMode && !isMaximized
            ? selectedId
              ? 'flex'
              : 'hidden'
            : selectedId
              ? 'flex'
              : 'hidden lg:flex'
        } relative flex-1 min-w-0 flex-col bg-[#fafafa]`}
      >
        {isDraggingFiles && matchedActiveTicket && !headerTicket?.is_blocked && (
          <div className="pointer-events-none absolute inset-2.5 z-40 rounded-[24px] border-2 border-dashed border-[#ff6e20] bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-center p-6">
            <span className="w-12 h-12 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
              <FigmaIcon name="image-plus" className="w-6 h-6" />
            </span>
            <p className="text-[15px] font-bold text-black">
              Drop images to attach
            </p>
            <p className="text-[12px] text-[#767676]">
              Up to 6 images · Max 20MB each
            </p>
          </div>
        )}
        {!selectedId ? (
          <div className="relative flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
            {drawerMode && isMaximized && (
              <div className="absolute top-4 right-4 flex items-center gap-1.5">
                {onToggleMaximize && (
                  <button
                    type="button"
                    onClick={onToggleMaximize}
                    title="Minimize chat"
                    aria-label="Minimize chat"
                    className="w-9 h-9 rounded-full bg-white hover:bg-[#ffefe6] hover:text-[#ff6e20] border border-[#ececec] text-[#555555] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Minimize2
                      className="w-4 h-4"
                      strokeWidth={ICON_STROKE_WIDTH}
                    />
                  </button>
                )}
                {onCloseDrawer && (
                  <button
                    type="button"
                    onClick={onCloseDrawer}
                    title="Close messages"
                    aria-label="Close messages"
                    className="w-9 h-9 rounded-full bg-white hover:bg-[#ffefe6] hover:text-[#ff6e20] border border-[#ececec] text-[#555555] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <FigmaIcon name="x" className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            <div className="w-20 h-20 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center mb-4">
              <FigmaIcon name="message-circle" className="w-10 h-10" />
            </div>
            <h2 className="text-[19px] font-bold text-black">
              No chats selected
            </h2>
            <p className="text-[13.5px] text-[#767676] mt-1 max-w-[320px]">
              Choose a conversation from the left to read messages, send photos,
              and reply.
            </p>
          </div>
        ) : loadingThread && !headerTicket ? (
          <div className="flex-1 flex items-center justify-center text-[13.5px] text-[#767676]">
            Loading conversation...
          </div>
        ) : !headerTicket || !activePeer ? (
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
            <div
              className={`bg-white border-b border-[#ececec] ${
                drawerMode && !isMaximized
                  ? 'px-3.5 py-3'
                  : 'px-4 sm:px-5 py-3.5'
              } flex items-center justify-between gap-2.5 shrink-0`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => selectChat(null)}
                  aria-label="Back to chats"
                  className={`${
                    drawerMode && !isMaximized ? 'flex' : 'lg:hidden flex'
                  } w-8 h-8 rounded-full bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-black items-center justify-center shrink-0 cursor-pointer transition-colors`}
                >
                  <FigmaIcon name="arrow-left" className="w-4 h-4" />
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
                      <FigmaIcon name="message-circle" className="w-4 h-4" />
                    ) : (
                      activePeer.name.charAt(0).toUpperCase()
                    )}
                  </span>
                  {!headerTicket.is_blocked && headerTicket.peer_is_online && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#1e90ff] border-2 border-white" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {activePeer.storeSlug ? (
                      <Link
                        to={`/store/${activePeer.storeSlug}`}
                        onClick={drawerMode ? onCloseDrawer : undefined}
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
                        !headerTicket.is_blocked && headerTicket.peer_is_online
                          ? 'text-[#1e90ff]'
                          : 'text-[#8a8a8a]'
                      }`}
                    >
                      {!headerTicket.is_blocked && headerTicket.peer_is_online
                        ? 'Active'
                        : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
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
                    <FigmaIcon name="more-horizontal" className="w-4 h-4" />
                  </button>

                  {chatMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-[180px] bg-white border border-[#ececec] rounded-[14px] shadow-[0_12px_32px_rgba(0,0,0,0.12)] py-1.5 z-30"
                    >
                      {(!headerTicket.is_blocked ||
                        headerTicket.blocked_by_me ||
                        mode === 'admin') && (
                        <button
                          type="button"
                          role="menuitem"
                          disabled={bulkBusy}
                          onClick={() => {
                            setChatMenuOpen(false);
                            void runBulkAction(
                              headerTicket.is_blocked ? 'unblock' : 'block',
                              [headerTicket.id],
                            );
                          }}
                          className="w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-black hover:bg-[#f7f7f7] flex items-center gap-2.5 transition-colors disabled:opacity-50"
                        >
                          <FigmaIcon
                            name="slash"
                            className="w-4 h-4 text-[#767676] shrink-0"
                          />
                          <span>
                            {headerTicket.is_blocked ? 'Unblock' : 'Block'}
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
                            [headerTicket.id],
                            activePeer?.name || headerTicket.subject,
                          );
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-[#d93025] hover:bg-[#fff0f0] flex items-center gap-2.5 transition-colors disabled:opacity-50"
                      >
                        <FigmaIcon name="trash" className="w-4 h-4 shrink-0" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>

                {drawerMode && onToggleMaximize && (
                  <button
                    type="button"
                    onClick={onToggleMaximize}
                    title={isMaximized ? 'Minimize chat' : 'Maximize chat'}
                    aria-label={isMaximized ? 'Minimize chat' : 'Maximize chat'}
                    className="w-9 h-9 rounded-full bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {isMaximized ? (
                      <Minimize2
                        className="w-4 h-4"
                        strokeWidth={ICON_STROKE_WIDTH}
                      />
                    ) : (
                      <Maximize2
                        className="w-4 h-4"
                        strokeWidth={ICON_STROKE_WIDTH}
                      />
                    )}
                  </button>
                )}

                {drawerMode && onCloseDrawer && (
                  <button
                    type="button"
                    onClick={onCloseDrawer}
                    title="Close messages"
                    aria-label="Close messages"
                    className="w-9 h-9 rounded-full bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <FigmaIcon name="x" className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Message Thread */}
            {!matchedActiveTicket ? (
              <div className="flex-1 flex items-center justify-center text-[13.5px] text-[#767676]">
                Loading messages...
              </div>
            ) : (
              <div className="relative flex-1 min-h-0 flex flex-col">
                <div
                  ref={messagesContainerRef}
                  onScroll={handleMessagesScroll}
                  className={`flex-1 overflow-y-auto overscroll-contain ${
                    drawerMode ? 'px-3.5 py-4' : 'px-5 py-5'
                  } flex flex-col`}
                >
                  {/* Empty new conversation welcome header */}
                  {!matchedActiveTicket.message?.trim() &&
                    (!matchedActiveTicket.attachments ||
                      matchedActiveTicket.attachments.length === 0) &&
                    (!matchedActiveTicket.messages ||
                      matchedActiveTicket.messages.length === 0) && (
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
                            <FigmaIcon
                              name="message-circle"
                              className="w-7 h-7"
                            />
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
                      Boolean(matchedActiveTicket.message?.trim()) ||
                      Boolean(
                        matchedActiveTicket.attachments &&
                        matchedActiveTicket.attachments.length > 0,
                      );

                    if (hasInitialContent) {
                      const isOwnInitial = !activeViewingAsStaff;
                      const customerName =
                        matchedActiveTicket.user?.name || 'Customer';
                      const customerAvatar =
                        matchedActiveTicket.user?.avatar || null;
                      threadItems.push({
                        key: `initial-${matchedActiveTicket.id}`,
                        isOwn: isOwnInitial,
                        senderKey: isOwnInitial
                          ? 'self'
                          : `customer-${matchedActiveTicket.user_id ?? '0'}`,
                        senderName: isOwnInitial ? 'You' : customerName,
                        senderAvatar: isOwnInitial ? null : customerAvatar,
                        isSupportFallback: false,
                        message: matchedActiveTicket.message,
                        attachments: matchedActiveTicket.attachments,
                        metadata: null,
                        createdAt: matchedActiveTicket.created_at,
                        minuteKey: getMessageMinuteKey(
                          matchedActiveTicket.created_at,
                        ),
                      });
                    }

                    (matchedActiveTicket.messages || []).forEach((msg) => {
                      const isOwn = activeViewingAsStaff
                        ? msg.is_admin_reply
                        : !msg.is_admin_reply;
                      const senderName = isOwn
                        ? 'You'
                        : msg.is_admin_reply
                          ? matchedActiveTicket.store?.name || 'Kova Support'
                          : msg.user?.name ||
                            matchedActiveTicket.user?.name ||
                            'Customer';
                      const senderAvatar = isOwn
                        ? null
                        : msg.is_admin_reply
                          ? matchedActiveTicket.store?.logo ||
                            msg.user?.avatar ||
                            null
                          : msg.user?.avatar ||
                            matchedActiveTicket.user?.avatar ||
                            null;
                      threadItems.push({
                        key: String(msg.id),
                        isOwn,
                        senderKey: isOwn
                          ? 'self'
                          : msg.is_admin_reply
                            ? `staff-${matchedActiveTicket.store?.id ?? 'support'}`
                            : `customer-${msg.user?.id ?? matchedActiveTicket.user_id ?? '0'}`,
                        senderName,
                        senderAvatar,
                        isSupportFallback: Boolean(
                          msg.is_admin_reply && !matchedActiveTicket.store,
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
                                <FigmaIcon
                                  name="message-circle"
                                  className="w-4 h-4"
                                />
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
                  <FigmaIcon name="arrow-down" className="w-4 h-4" />
                </button>
              )}
              </div>
            )}

            {/* Bottom Composer Bar OR Blocked Banner */}
            {headerTicket.is_blocked ? (
              <div className="bg-white border-t border-[#ececec] px-4 sm:px-5 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 text-[13px] text-[#767676]">
                  <FigmaIcon
                    name="slash"
                    className="w-4 h-4 text-[#d93025] shrink-0"
                  />
                  <span>
                    {headerTicket.blocked_by_me
                      ? 'You blocked this conversation.'
                      : 'This conversation is blocked. Replies are disabled.'}
                  </span>
                </div>
                {(headerTicket.blocked_by_me || mode === 'admin') && (
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() =>
                      void runBulkAction('unblock', [headerTicket.id])
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
                className="bg-white border-t border-[#ececec] px-3 sm:px-4 pt-2.5 sm:pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col gap-2 shrink-0"
              >
                <PendingContextCardBar
                  card={pendingContextCard}
                  onRemove={() => {
                    pendingContextCardRef.current = null;
                    setPendingContextCard(null);
                  }}
                />
                <PendingAttachmentsBar
                  attachments={replyAttachments}
                  onRemove={(idx) =>
                    setReplyAttachments((prev) => {
                      const next = prev.filter((_, i) => i !== idx);
                      replyAttachmentsRef.current = next;
                      return next;
                    })
                  }
                />

                {isRecording ? (
                  <div className="flex items-center justify-between gap-2.5 bg-[#fff6f1] border border-[#ff6e20]/40 rounded-full px-2.5 py-1.5">
                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      aria-label="Cancel voice recording"
                      title="Cancel recording"
                      className="w-9 h-9 rounded-full bg-white hover:bg-[#fff0f0] border border-[#ececec] text-[#555555] hover:text-[#e5322d] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                    >
                      <FigmaIcon name="x" className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#e5322d] animate-pulse shrink-0" />
                      <span className="text-[13px] font-semibold text-black">
                        Recording
                      </span>
                      <span className="text-[13px] font-bold text-[#ff6e20] tabular-nums">
                        {formatTimer(recordingSeconds)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={stopAndSendVoiceRecording}
                      aria-label="Send voice message"
                      className="inline-flex items-center gap-1.5 bg-[#ff6e20] hover:bg-[#e85d12] text-white px-4 py-2 rounded-full text-[13px] font-semibold transition-colors shrink-0 cursor-pointer"
                    >
                      <FigmaIcon name="send" className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </div>
                ) : (
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
                      disabled={uploadingImage || uploadingVoice}
                      onClick={() => fileInputRef.current?.click()}
                      title="Send photo (or drag & drop)"
                      aria-label="Send photo"
                      className="w-9 h-9 mb-0.5 rounded-full bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555] flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <FigmaIcon name="image-plus" className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={
                        !matchedActiveTicket ||
                        uploadingImage ||
                        uploadingVoice ||
                        sending
                      }
                      onClick={() => void startVoiceRecording()}
                      title="Record voice message"
                      aria-label="Record voice message"
                      className="w-9 h-9 mb-0.5 rounded-full bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555] flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {uploadingVoice ? (
                        <Loader2
                          className="w-4 h-4 animate-spin text-[#ff6e20]"
                          strokeWidth={ICON_STROKE_WIDTH}
                        />
                      ) : (
                        <FigmaIcon name="mic" className="w-4 h-4" />
                      )}
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
                        uploadingVoice
                          ? 'Sending voice message...'
                          : uploadingImage
                            ? 'Uploading photo...'
                            : 'Message'
                      }
                      className="flex-1 bg-[#f4f4f4] focus:bg-white border border-transparent focus:border-[#ff6e20] rounded-[20px] px-4 py-2.5 text-[14px] leading-[1.45] text-black placeholder:text-[#8a8a8a] outline-none transition-colors min-w-0 resize-none max-h-[140px] overflow-y-auto no-scrollbar"
                    />
                    <button
                      type="submit"
                      disabled={
                        !matchedActiveTicket ||
                        sending ||
                        uploadingImage ||
                        uploadingVoice ||
                        (!replyText.trim() &&
                          replyAttachments.length === 0 &&
                          !pendingContextCard)
                      }
                      className="mb-0.5 inline-flex items-center gap-1.5 bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-45 text-white px-4.5 py-2 rounded-full text-[13px] font-semibold transition-colors shrink-0 cursor-pointer"
                    >
                      <FigmaIcon name="send" className="w-3.5 h-3.5" />
                      <span>{sending ? 'Sending...' : 'Send'}</span>
                    </button>
                  </div>
                )}
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}
