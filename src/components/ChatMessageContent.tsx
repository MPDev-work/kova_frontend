import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ExternalLink,
  Package,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import type {
  ChatContextCard,
  ChatMessageMetadata,
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
    <div className="w-[272px] sm:w-[308px] max-w-full bg-white border border-[#ececec] rounded-[16px] overflow-hidden shadow-[0_3px_12px_rgba(0,0,0,0.06)] text-left">
      <div className="bg-[#fafafa] border-b border-[#f0f0f0] px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isOrder ? (
            <Package className="w-3.5 h-3.5 text-[#ff6e20] shrink-0" />
          ) : (
            <ShoppingBag className="w-3.5 h-3.5 text-[#ff6e20] shrink-0" />
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
        <div className="w-[56px] h-[56px] rounded-[10px] overflow-hidden border border-[#ececec] bg-[#f7f7f7] shrink-0 flex items-center justify-center">
          {card.product_image ? (
            <img
              src={card.product_image}
              alt={card.product_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="w-5 h-5 text-[#979797]" />
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
            <ArrowUpRight className="w-3.5 h-3.5" />
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
          <ExternalLink className="w-3 h-3 shrink-0 inline" />
        </a>
        {trailing}
      </span>
    );
  });
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
                ? 'bg-[#ff6e20] text-white rounded-br-[6px] shadow-[0_4px_14px_rgba(255,110,32,0.22)]'
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
            className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPreviewUrl(null)}
          >
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              aria-label="Close image preview"
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewUrl}
              alt="Full size attachment"
              onClick={(e) => e.stopPropagation()}
              className="max-w-[92vw] max-h-[88vh] rounded-[16px] object-contain shadow-2xl"
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
    <div className="flex items-center gap-3 bg-[#fafafa] border border-[#ececec] rounded-[14px] p-2.5 pr-3">
      <div className="w-[48px] h-[48px] rounded-[10px] overflow-hidden border border-[#ececec] bg-white shrink-0 flex items-center justify-center">
        {card.product_image ? (
          <img
            src={card.product_image}
            alt={card.product_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Package className="w-5 h-5 text-[#979797]" />
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
        <X className="w-3.5 h-3.5" />
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
          className="relative w-16 h-16 rounded-[12px] overflow-hidden border border-[#ececec] bg-[#f7f7f7] shrink-0"
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
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
