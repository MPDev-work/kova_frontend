import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';

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
  isOwn,
}: {
  message?: string | null;
  attachments?: string[] | null;
  isOwn: boolean;
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

  return (
    <>
      <div
        className={`flex flex-col gap-1.5 ${
          isOwn ? 'items-end' : 'items-start'
        }`}
      >
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
