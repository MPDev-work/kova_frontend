import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { FigmaIcon } from './FigmaIcon';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import type {
  ChatContextCard,
  ChatMessageMetadata,
  ChatVoiceMessage,
} from '../types/marketplace';

function getCardDestination(
  card: ChatContextCard,
  viewerMode: 'customer' | 'seller' | 'admin',
): { to: string; label: string } | null {
  if (card.kind === 'order' && card.order_number) {
    const cleanOrder = card.order_number.replace(/^#/, '');
    if (viewerMode === 'seller') {
      return {
        to: `/seller/orders?order=${encodeURIComponent(cleanOrder)}`,
        label: 'View order',
      };
    }
    if (viewerMode === 'admin') {
      return {
        to: `/admin/shipping?search=${encodeURIComponent(cleanOrder)}`,
        label: 'View order',
      };
    }
    return {
      to: `/account/orders?order=${encodeURIComponent(cleanOrder)}`,
      label: 'View order',
    };
  }

  if (card.kind === 'product') {
    if (viewerMode === 'seller') {
      return {
        to: card.product_id
          ? `/seller/products?view=${card.product_id}`
          : '/seller/products',
        label: 'View product',
      };
    }
    if (card.product_slug) {
      return {
        to: `/product/${encodeURIComponent(card.product_slug)}`,
        label: 'View product',
      };
    }
  }

  return null;
}

function formatCardStatus(status?: string | null): string | null {
  if (!status) return null;
  return status.replace(/_/g, ' ');
}

function ChatContextCardView({
  card,
  viewerMode,
  onNavigate,
}: {
  card: ChatContextCard;
  viewerMode: 'customer' | 'seller' | 'admin';
  onNavigate?: () => void;
}) {
  const destination = getCardDestination(card, viewerMode);
  const statusLabel = formatCardStatus(card.order_status);
  const isOrder = card.kind === 'order';
  const extraItemsCount =
    card.item_count && card.quantity && card.item_count > card.quantity
      ? card.item_count - card.quantity
      : 0;
  const displayPrice =
    isOrder && card.total_amount != null
      ? Number(card.total_amount)
      : card.unit_price != null
        ? Number(card.unit_price)
        : null;

  return (
    <div className="w-[272px] sm:w-[308px] max-w-full bg-white border border-[#ececec] overflow-hidden shadow-[0_3px_12px_rgba(0,0,0,0.06)] text-left rounded-[24px]">
      <div className="bg-[#fafafa] border-b border-[#f0f0f0] px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isOrder ? (
            <FigmaIcon
              name="package"
              className="w-3.5 h-3.5 text-[#ff6e20] shrink-0"
            />
          ) : (
            <FigmaIcon
              name="shopping-bag"
              className="w-3.5 h-3.5 text-[#ff6e20] shrink-0"
            />
          )}
          <span className="text-[11.5px] font-semibold text-black truncate">
            {isOrder && card.order_number
              ? `Order #${card.order_number.replace(/^#/, '')}`
              : 'Product inquiry'}
          </span>
        </div>
        {isOrder && statusLabel ? (
          <span className="bg-[#ffefe6] text-[#ff6e20] text-[10.5px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0">
            {statusLabel}
          </span>
        ) : card.store_name ? (
          <span className="text-[11px] text-[#767676] truncate max-w-[120px]">
            {card.store_name}
          </span>
        ) : null}
      </div>

      <div className="p-3 flex items-center gap-3">
        <div className="w-[56px] h-[56px] overflow-hidden border border-[#ececec] bg-[#f7f7f7] shrink-0 flex items-center justify-center rounded-[14px]">
          {card.product_image ? (
            <img
              src={card.product_image}
              alt={card.product_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <FigmaIcon name="package" className="w-5 h-5 text-[#979797]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-black leading-snug line-clamp-2">
            {card.product_name}
          </p>
          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-[11.5px] text-[#767676] truncate">
              {isOrder && card.quantity != null
                ? `Qty ${card.quantity}${
                    card.unit_price != null
                      ? ` · $${Number(card.unit_price).toFixed(2)}`
                      : ''
                  }${extraItemsCount > 0 ? ` · +${extraItemsCount} more` : ''}`
                : card.store_name || 'Item details'}
            </p>
            {displayPrice != null && (
              <span className="text-[13.5px] font-bold text-[#ff6e20] shrink-0">
                ${displayPrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>

      {destination && (
        <div className="px-3 pb-3">
          <Link
            to={destination.to}
            onClick={onNavigate}
            className="w-full inline-flex items-center justify-center gap-1.5 bg-[#ffefe6] hover:bg-[#ff6e20] text-[#ff6e20] hover:text-white text-[12px] font-semibold py-2 px-3 rounded-full transition-colors"
          >
            <span>{destination.label}</span>
            <FigmaIcon name="arrow-up-right" className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

const URL_REGEX =
  /(https?:\/\/[^\s<]+|www\.[^\s<]+|(?<![@\w/.])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|co|app|dev|ai|kh|edu|gov|me|tv|gg|ly|sh|xyz|info|biz|shop|store|site|online|tech|cloud|pro|link)(?:\/[^\s<]*)?)/gi;

function toSafeHref(raw: string): string | null {
  const trimmed = raw.replace(/[),.!?:;]+$/, '');
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function renderLinkedText(text: string, isOwn: boolean) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, idx) => {
    if (!part) return null;
    const isLikelyUrl = idx % 2 === 1;
    if (!isLikelyUrl) {
      return <span key={idx}>{part}</span>;
    }
    const cleanText = part.replace(/[),.!?:;]+$/, '');
    const trailing = part.slice(cleanText.length);
    const href = toSafeHref(cleanText);
    if (!href) {
      return <span key={idx}>{part}</span>;
    }
    return (
      <span key={idx}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 underline underline-offset-2 break-all font-medium px-1.5 py-0.5 -mx-0.5 rounded-[6px] transition-colors ${
            isOwn
              ? 'bg-white/20 hover:bg-white/30 text-white'
              : 'bg-[#ffefe6] hover:bg-[#ffe1cf] text-[#ff6e20]'
          }`}
        >
          <span>{cleanText}</span>
          <FigmaIcon
            name="external-link"
            className="w-3 h-3 shrink-0 inline-block"
          />
        </a>
        {trailing}
      </span>
    );
  });
}

const VOICE_BAR_HEIGHTS = [35, 62, 48, 84, 56, 95, 72, 44, 88, 66, 52, 78, 42, 68, 54, 80, 46, 60];

let activeVoiceAudioEl: HTMLAudioElement | null = null;

/**
 * Ensure Cloudinary-hosted voice messages (including legacy .webm/.ogg recordings)
 * are served as universally playable MP3 with valid duration headers and byte-range
 * seeking (required for reliable first-tap playback on iOS Safari and mobile Chrome).
 */
function getPlayableVoiceUrl(rawUrl: string): string {
  if (!rawUrl || !rawUrl.includes('res.cloudinary.com')) return rawUrl;
  if (/\.mp3(\?|$)/i.test(rawUrl)) return rawUrl;
  if (!/\/video\/upload\//i.test(rawUrl)) return rawUrl;
  const withTransform = rawUrl.includes('/video/upload/f_mp3')
    ? rawUrl
    : rawUrl.replace('/video/upload/', '/video/upload/f_mp3/');
  return withTransform.replace(/\.(webm|weba|ogg|oga|opus|m4a|mp4)(\?|$)/i, '.mp3$2');
}

function formatAudioSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function VoiceMessagePlayer({
  voice,
  isOwn,
}: {
  voice: ChatVoiceMessage;
  isOwn: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const primarySrc = getPlayableVoiceUrl(voice.url);
  const [srcUrl, setSrcUrl] = useState(primarySrc);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const fallbackDuration =
    typeof voice.duration === 'number' &&
    Number.isFinite(voice.duration) &&
    voice.duration > 0
      ? voice.duration
      : 0;

  const [duration, setDuration] = useState<number>(fallbackDuration);
  const durationRef = useRef<number>(fallbackDuration);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const finishPlayback = () => {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // Ignore seek errors on unloaded streams
      }
      if (activeVoiceAudioEl === audio) {
        activeVoiceAudioEl = null;
      }
      setPlaying(false);
      setBuffering(false);
      setCurrentTime(0);
    };

    const syncDuration = () => {
      const d = audio.duration;
      // Ignore Infinity / NaN / absurdly large bogus durations from streaming containers
      if (Number.isFinite(d) && d > 0 && d < 36000) {
        durationRef.current = d;
        setDuration(d);
      } else if (fallbackDuration > 0) {
        durationRef.current = fallbackDuration;
        setDuration(fallbackDuration);
      }
    };

    const onTimeUpdate = () => {
      const maxDur = durationRef.current;
      const t = audio.currentTime;

      if (audio.ended) {
        finishPlayback();
        return;
      }

      // Guard against mobile/WebM streams that fail to emit `ended` and count infinitely
      if (maxDur > 0 && t >= maxDur + 0.35) {
        finishPlayback();
        return;
      }

      setCurrentTime(maxDur > 0 ? Math.min(t, maxDur) : t);
    };

    const onEnded = () => {
      finishPlayback();
    };

    const onPause = () => {
      if (activeVoiceAudioEl === audio) {
        activeVoiceAudioEl = null;
      }
      setPlaying(false);
      setBuffering(false);
    };

    const onPlay = () => {
      setPlaying(true);
    };

    const onPlaying = () => {
      setPlaying(true);
      setBuffering(false);
    };

    const onWaiting = () => {
      setBuffering(true);
    };

    const onError = () => {
      // If transformed MP3 URL fails, fall back once to the original raw URL
      if (srcUrl !== voice.url) {
        setSrcUrl(voice.url);
      } else {
        finishPlayback();
      }
    };

    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('durationchange', syncDuration);
    audio.addEventListener('canplay', syncDuration);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      if (activeVoiceAudioEl === audio) {
        activeVoiceAudioEl = null;
      }
      audio.removeEventListener('loadedmetadata', syncDuration);
      audio.removeEventListener('durationchange', syncDuration);
      audio.removeEventListener('canplay', syncDuration);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('error', onError);
    };
  }, [srcUrl, voice.url, fallbackDuration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing || !audio.paused) {
      audio.pause();
      return;
    }

    // Pause any other currently playing voice message
    if (activeVoiceAudioEl && activeVoiceAudioEl !== audio) {
      activeVoiceAudioEl.pause();
    }
    activeVoiceAudioEl = audio;

    // Reset if previous play finished or drifted near the end
    const maxDur = durationRef.current;
    if (audio.ended || (maxDur > 0 && audio.currentTime >= maxDur - 0.1)) {
      try {
        audio.currentTime = 0;
      } catch {
        // Ignore
      }
      setCurrentTime(0);
    }

    setBuffering(audio.readyState < 2);

    // Call play() directly inside the user-gesture tap handler (required by iOS Safari!)
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      void playPromise.catch(() => {
        // On mobile browsers where first play fails before metadata loads, reload & retry once
        try {
          audio.load();
          void audio.play().catch(() => {
            setPlaying(false);
            setBuffering(false);
            if (activeVoiceAudioEl === audio) {
              activeVoiceAudioEl = null;
            }
          });
        } catch {
          setPlaying(false);
          setBuffering(false);
        }
      });
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const maxDur = durationRef.current;
    if (!audio || !maxDur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    try {
      audio.currentTime = ratio * maxDur;
      setCurrentTime(audio.currentTime);
    } catch {
      // Ignore seek errors before audio is seekable
    }
  };

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const displayTime =
    playing || buffering || currentTime > 0
      ? formatAudioSeconds(currentTime)
      : formatAudioSeconds(duration);

  return (
    <div
      className={`w-[252px] sm:w-[276px] max-w-full rounded-[20px] pl-2.5 pr-3.5 py-2 flex items-center gap-2.5 ${
        isOwn
          ? 'bg-[#ff6e20] text-white rounded-br-[6px]'
          : 'bg-white border border-[#ececec] text-black rounded-bl-[6px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
      }`}
    >
      <audio
        ref={audioRef}
        src={srcUrl}
        preload="auto"
        playsInline
      />
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
          isOwn
            ? 'bg-white text-[#ff6e20] hover:bg-[#ffefe6]'
            : 'bg-[#ffefe6] text-[#ff6e20] hover:bg-[#ff6e20] hover:text-white'
        }`}
      >
        {buffering && !playing ? (
          <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : playing ? (
          <FigmaIcon name="pause-filled" className="w-4 h-4" />
        ) : (
          <FigmaIcon name="play-filled" className="w-4 h-4 ml-0.5" />
        )}
      </button>

      <div
        role="slider"
        aria-label="Voice message progress"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        tabIndex={0}
        onClick={handleSeek}
        className="flex-1 min-w-0 h-7 flex items-center gap-[3px] cursor-pointer"
      >
        {VOICE_BAR_HEIGHTS.map((pct, idx) => {
          const barRatio = (idx + 1) / VOICE_BAR_HEIGHTS.length;
          const active = progress >= barRatio - 0.03;
          return (
            <span
              key={idx}
              style={{ height: `${Math.round((pct / 100) * 20)}px` }}
              className={`flex-1 rounded-full transition-colors ${
                isOwn
                  ? active
                    ? 'bg-white'
                    : 'bg-white/40'
                  : active
                    ? 'bg-[#ff6e20]'
                    : 'bg-[#dcdcdc]'
              }`}
            />
          );
        })}
      </div>

      <span
        className={`shrink-0 text-[11.5px] font-medium tabular-nums leading-none min-w-[28px] text-right ${
          isOwn ? 'text-white/90' : 'text-[#8a8a8a]'
        }`}
      >
        {displayTime}
      </span>
    </div>
  );
}

export function ChatMessageBody({
  message,
  attachments,
  metadata,
  isOwn,
  viewerMode = 'customer',
  onCardNavigate,
}: {
  message?: string | null;
  attachments?: string[] | null;
  metadata?: ChatMessageMetadata | null;
  isOwn: boolean;
  viewerMode?: 'customer' | 'seller' | 'admin';
  onCardNavigate?: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useBodyScrollLock(Boolean(previewUrl));

  useEffect(() => {
    if (!previewUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewUrl(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewUrl]);

  const images = (attachments || []).filter(Boolean);
  const text = (message || '').trim();
  const contextCard = metadata?.context_card ?? null;
  const voiceMessage = metadata?.voice?.url ? metadata.voice : null;

  return (
    <>
      <div
        className={`flex flex-col gap-1.5 ${
          isOwn ? 'items-end' : 'items-start'
        }`}
      >
        {contextCard && (
          <ChatContextCardView
            card={contextCard}
            viewerMode={viewerMode}
            onNavigate={onCardNavigate}
          />
        )}

        {voiceMessage && (
          <VoiceMessagePlayer
            key={voiceMessage.url}
            voice={voiceMessage}
            isOwn={isOwn}
          />
        )}

        {images.length > 0 && (
          <div
            className={`grid gap-1.5 ${
              images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
            }`}
          >
            {images.map((url, idx) => (
              <button
                key={`${url}-${idx}`}
                type="button"
                onClick={() => setPreviewUrl(url)}
                className="group relative overflow-hidden rounded-[16px] text-left block"
              >
                <img
                  src={url}
                  alt="Shared attachment"
                  className={`block object-cover transition-transform duration-200 group-hover:scale-[1.02] ${
                    images.length === 1
                      ? 'max-h-[260px] max-w-[260px] w-auto h-auto rounded-[16px]'
                      : 'h-[124px] w-[124px] rounded-[14px]'
                  }`}
                />
              </button>
            ))}
          </div>
        )}

        {text && (
          <div
            className={`rounded-[20px] px-4 py-2.5 ${
              isOwn
                ? 'bg-[#ff6e20] text-white rounded-br-[6px]'
                : 'bg-white border border-[#ececec] text-black rounded-bl-[6px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
            }`}
          >
            <p className="text-[14px] leading-[1.55] whitespace-pre-wrap break-words">
              {renderLinkedText(text, isOwn)}
            </p>
          </div>
        )}
      </div>

      {previewUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/92 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
            onClick={() => setPreviewUrl(null)}
          >
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              aria-label="Close image preview"
              className="fixed top-[max(1rem,env(safe-area-inset-top))] right-4 z-10 w-11 h-11 rounded-full bg-[#171717] hover:bg-black text-white border-2 border-white shadow-[0_6px_24px_rgba(0,0,0,0.65)] flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
            >
              <FigmaIcon name="x" className="w-5 h-5" />
            </button>
            <img
              src={previewUrl}
              alt="Full size attachment"
              onClick={(e) => e.stopPropagation()}
              className="max-w-[96vw] max-h-[92dvh] rounded-[12px] sm:rounded-[16px] object-contain shadow-2xl"
            />
          </div>,
          document.body,
        )}
    </>
  );
}

export function PendingContextCardBar({
  card,
  onRemove,
}: {
  card: ChatContextCard | null;
  onRemove: () => void;
}) {
  if (!card) return null;
  const isOrder = card.kind === 'order';
  const statusLabel = formatCardStatus(card.order_status);
  const extraItemsCount =
    card.item_count && card.quantity && card.item_count > card.quantity
      ? card.item_count - card.quantity
      : 0;
  const displayPrice =
    isOrder && card.total_amount != null
      ? Number(card.total_amount)
      : card.unit_price != null
        ? Number(card.unit_price)
        : null;

  return (
    <div className="flex items-center gap-3 bg-[#fafafa] border border-[#ececec] p-2.5 pr-3 rounded-[14px]">
      <div className="w-[48px] h-[48px] rounded-[10px] overflow-hidden border border-[#ececec] bg-white shrink-0 flex items-center justify-center">
        {card.product_image ? (
          <img
            src={card.product_image}
            alt={card.product_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <FigmaIcon name="package" className="w-5 h-5 text-[#979797]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-[#ff6e20]">
            {isOrder && card.order_number
              ? `Asking about Order #${card.order_number.replace(/^#/, '')}`
              : 'Asking about this product'}
          </span>
          {isOrder && statusLabel && (
            <span className="bg-[#ffefe6] text-[#ff6e20] text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize">
              {statusLabel}
            </span>
          )}
        </div>
        <p className="text-[13px] font-semibold text-black truncate mt-0.5">
          {card.product_name}
        </p>
        <p className="text-[11.5px] text-[#767676] truncate">
          {isOrder && card.quantity != null
            ? `Qty ${card.quantity}${
                card.unit_price != null
                  ? ` · $${Number(card.unit_price).toFixed(2)} each`
                  : ''
              }${extraItemsCount > 0 ? ` · +${extraItemsCount} more` : ''}`
            : card.store_name || 'Attached product details'}
          {displayPrice != null ? ` · $${displayPrice.toFixed(2)}` : ''}
        </p>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove attached item"
        title="Remove attached item"
        className="w-7 h-7 rounded-full bg-white border border-[#ececec] hover:border-[#ff6e20] hover:text-[#ff6e20] text-[#767676] flex items-center justify-center shrink-0 transition-colors"
      >
        <FigmaIcon name="x" className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function PendingAttachmentsBar({
  attachments,
  onRemove,
}: {
  attachments: string[];
  onRemove: (index: number) => void;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 pb-2">
      {attachments.map((url, idx) => (
        <div
          key={`${url}-${idx}`}
          className="relative w-16 h-16 overflow-hidden border border-[#ececec] bg-[#f7f7f7] shrink-0 rounded-[14px]"
        >
          <img
            src={url}
            alt="Attachment preview"
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => onRemove(idx)}
            aria-label="Remove image"
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center"
          >
            <FigmaIcon name="x" className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
