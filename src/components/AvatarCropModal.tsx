import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, Move, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';

export interface AvatarCropModalProps {
  open: boolean;
  file: File | null;
  uploading?: boolean;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void | Promise<void>;
}

const MAX_AVATAR_PX = 256;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export function AvatarCropModal({
  open,
  file,
  uploading = false,
  onCancel,
  onConfirm,
}: AvatarCropModalProps) {
  useBodyScrollLock(open);

  if (!open || !file) return null;

  return (
    <AvatarCropModalDialog
      key={`${file.name}-${file.size}-${file.lastModified}`}
      file={file}
      uploading={uploading}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function AvatarCropModalDialog({
  file,
  uploading,
  onCancel,
  onConfirm,
}: {
  file: File;
  uploading: boolean;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void | Promise<void>;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const imageUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const [naturalSize, setNaturalSize] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const [viewportSize, setViewportSize] = useState(280);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);

  const dragStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Revoke object URL on unmount or file change
  useEffect(() => {
    return () => {
      URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  // Measure responsive square viewport
  useEffect(() => {
    const measure = () => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0) {
        setViewportSize(rect.width);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Escape key cancels when not busy
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !uploading && !processing) {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [uploading, processing, onCancel]);

  const baseScale = useMemo(() => {
    if (!naturalSize) return 1;
    const minDim = Math.min(naturalSize.w, naturalSize.h);
    return minDim > 0 ? viewportSize / minDim : 1;
  }, [naturalSize, viewportSize]);

  const clampOffset = useCallback(
    (nextX: number, nextY: number, targetZoom: number) => {
      if (!naturalSize) return { x: 0, y: 0 };
      const dispW = naturalSize.w * baseScale * targetZoom;
      const dispH = naturalSize.h * baseScale * targetZoom;
      const maxOffsetX = Math.max(0, (dispW - viewportSize) / 2);
      const maxOffsetY = Math.max(0, (dispH - viewportSize) / 2);
      return {
        x: Math.min(maxOffsetX, Math.max(-maxOffsetX, nextX)),
        y: Math.min(maxOffsetY, Math.max(-maxOffsetY, nextY)),
      };
    },
    [naturalSize, baseScale, viewportSize],
  );

  const handleZoomChange = (nextZoom: number) => {
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    setZoom(clampedZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, clampedZoom));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!naturalSize || uploading || processing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStartRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setOffset(clampOffset(drag.origX + dx, drag.origY + dy, zoom));
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current?.pointerId === e.pointerId) {
      dragStartRef.current = null;
      setDragging(false);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!naturalSize) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    handleZoomChange(zoom + delta);
  };

  const handleConfirm = async () => {
    const img = imgRef.current;
    if (!img || !naturalSize || !file) return;

    setProcessing(true);
    try {
      const totalScale = baseScale * zoom;
      const dispW = naturalSize.w * totalScale;
      const dispH = naturalSize.h * totalScale;

      // Top-left corner of the displayed image relative to the viewport (0, 0)
      const imgLeft = viewportSize / 2 + offset.x - dispW / 2;
      const imgTop = viewportSize / 2 + offset.y - dispH / 2;

      const srcX = Math.max(0, -imgLeft / totalScale);
      const srcY = Math.max(0, -imgTop / totalScale);
      const srcSize = Math.min(
        naturalSize.w - srcX,
        naturalSize.h - srcY,
        viewportSize / totalScale,
      );

      // Output max 256x256 (keep smaller natural crop untouched — never upscale)
      const outSize = Math.min(
        MAX_AVATAR_PX,
        Math.max(1, Math.round(srcSize)),
      );

      const canvas = document.createElement('canvas');
      canvas.width = outSize;
      canvas.height = outSize;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        img,
        srcX,
        srcY,
        srcSize,
        srcSize,
        0,
        0,
        outSize,
        outSize,
      );

      const preferPng = file.type === 'image/png';
      const targetMime = preferPng ? 'image/png' : 'image/webp';
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
          (b) => {
            if (b) {
              resolve(b);
              return;
            }
            canvas.toBlob((jpg) => resolve(jpg), 'image/jpeg', 0.9);
          },
          targetMime,
          preferPng ? undefined : 0.9,
        );
      });

      if (!blob) throw new Error('Failed to crop image');

      const ext =
        blob.type === 'image/png'
          ? 'png'
          : blob.type === 'image/webp'
            ? 'webp'
            : 'jpg';
      const baseName = file.name.replace(/\.[^/.]+$/, '') || 'avatar';
      const croppedFile = new File([blob], `${baseName}-cropped.${ext}`, {
        type: blob.type,
        lastModified: Date.now(),
      });

      await onConfirm(croppedFile);
    } finally {
      setProcessing(false);
    }
  };

  const busy = uploading || processing;
  const dispW = naturalSize ? naturalSize.w * baseScale * zoom : viewportSize;
  const dispH = naturalSize ? naturalSize.h * baseScale * zoom : viewportSize;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop avatar"
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] bg-white border border-[#ececec] rounded-[24px] p-3.5 sm:p-4 shadow-2xl flex flex-col gap-3.5"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-bold text-black leading-tight">
              Adjust profile photo
            </h2>
            <p className="text-[12px] text-[#8a8a8a] mt-0.5 inline-flex items-center gap-1">
              <Move className="w-3 h-3 shrink-0" />
              <span>Drag to reposition · 1:1 square (max 256×256)</span>
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            aria-label="Close cropper"
            className="w-8 h-8 rounded-full bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555] flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1:1 Interactive Crop Stage (24px parent - 14px p-3.5 = 10px child) */}
        <div
          ref={stageRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onWheel={handleWheel}
          className="relative w-[260px] h-[260px] sm:w-[300px] sm:h-[300px] mx-auto overflow-hidden rounded-[10px] bg-[#141414] select-none touch-none cursor-grab active:cursor-grabbing border border-[#ececec]"
        >
          {imageUrl && (
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Avatar crop preview"
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget;
                setNaturalSize({
                  w: el.naturalWidth || el.width,
                  h: el.naturalHeight || el.height,
                });
              }}
              style={{
                width: `${dispW}px`,
                height: `${dispH}px`,
                left: `${viewportSize / 2 + offset.x - dispW / 2}px`,
                top: `${viewportSize / 2 + offset.y - dispH / 2}px`,
              }}
              className="absolute max-w-none pointer-events-none select-none"
            />
          )}

          {/* Circular Avatar Guide Mask */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.45)]"
          />

          {/* Subtle Rule-of-Thirds Grid While Dragging */}
          {dragging && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3"
            >
              {Array.from({ length: 9 }).map((_, idx) => (
                <div key={idx} className="border border-white/25" />
              ))}
            </div>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2.5 px-1">
          <button
            type="button"
            disabled={busy || zoom <= MIN_ZOOM}
            onClick={() => handleZoomChange(zoom - 0.2)}
            aria-label="Zoom out"
            className="w-8 h-8 rounded-full bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555] flex items-center justify-center transition-colors shrink-0 disabled:opacity-40"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.02}
            value={zoom}
            disabled={busy}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            aria-label="Zoom avatar"
            className="flex-1 accent-[#ff6e20] cursor-pointer"
          />
          <button
            type="button"
            disabled={busy || zoom >= MAX_ZOOM}
            onClick={() => handleZoomChange(zoom + 0.2)}
            aria-label="Zoom in"
            className="w-8 h-8 rounded-full bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555] flex items-center justify-center transition-colors shrink-0 disabled:opacity-40"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom X (Cancel) and Tick (Confirm) Icon Buttons */}
        <div className="flex items-center justify-center gap-4 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            aria-label="Cancel avatar upload"
            title="Cancel"
            className="w-12 h-12 rounded-full bg-[#f7f7f7] hover:bg-[#fff0f0] border border-[#ececec] hover:border-[#e5322d]/40 text-[#555555] hover:text-[#e5322d] flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" strokeWidth={2.4} />
          </button>
          <button
            type="button"
            disabled={busy || !naturalSize}
            onClick={() => void handleConfirm()}
            aria-label="Confirm and upload avatar"
            title="Save avatar"
            className="w-12 h-12 rounded-full bg-[#ff6e20] hover:bg-[#e85d12] text-white shadow-[0_6px_18px_rgba(255,110,32,0.32)] flex items-center justify-center transition-colors disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" strokeWidth={2.6} />
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
