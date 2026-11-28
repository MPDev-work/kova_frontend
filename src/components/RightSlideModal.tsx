import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { FigmaIcon } from './FigmaIcon';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';

const EXIT_DURATION_MS = 320;

interface RightSlideModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  hideHeader?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
  panelRadiusClass?: string;
  disableSwipe?: boolean;
  bodyClassName?: string;
  ariaLabel?: string;
}

function hasHorizontalScrollableAncestor(
  target: EventTarget | null,
  boundary: HTMLElement | null,
): boolean {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== boundary) {
    const style = window.getComputedStyle(node);
    const overflowX = style.overflowX;
    if (
      (overflowX === 'auto' || overflowX === 'scroll') &&
      node.scrollWidth > node.clientWidth + 2 &&
      node.scrollLeft > 0
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

export function RightSlideModal({
  open,
  onClose,
  title,
  subtitle,
  headerLeft,
  headerRight,
  hideHeader = false,
  children,
  footer,
  widthClass = 'w-[calc(100vw-16px)] max-w-[440px]',
  panelRadiusClass = 'rounded-l-[24px] border-l border-[#ececec]',
  disableSwipe = false,
  bodyClassName = 'p-3',
  ariaLabel,
}: RightSlideModalProps) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [dragPanelWidth, setDragPanelWidth] = useState(440);
  const [isDragging, setIsDragging] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{
    x: number;
    y: number;
    time: number;
    axis: 'horizontal' | 'vertical' | null;
    blocked: boolean;
  } | null>(null);

  useBodyScrollLock(rendered);

  // Step 1: Mount immediately when opening, or trigger exit transition then unmount when closing
  useEffect(() => {
    if (open) {
      const mountTimer = window.setTimeout(() => {
        setRendered(true);
        setDragOffsetX(0);
        setIsDragging(false);
      }, 0);
      return () => {
        window.clearTimeout(mountTimer);
      };
    }

    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      setIsDragging(false);
      setDragOffsetX(0);
    }, 0);
    const unmountTimer = window.setTimeout(() => {
      setRendered(false);
    }, EXIT_DURATION_MS);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [open]);

  // Step 2: Once mounted in DOM at translate-x-full, wait two animation frames then slide in right-to-left
  useEffect(() => {
    if (!open || !rendered) return;
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setVisible(true);
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [open, rendered]);

  // Close on Escape (unless a confirm-delete or KHQR payment modal is stacked above)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (
        document.getElementById('kova-confirm-delete-title') ||
        document.querySelector('[data-khqr-modal="true"]')
      ) {
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (disableSwipe || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const blocked = hasHorizontalScrollableAncestor(
      e.target,
      panelRef.current,
    );
    if (panelRef.current?.offsetWidth) {
      setDragPanelWidth(panelRef.current.offsetWidth);
    }
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: performance.now(),
      axis: null,
      blocked,
    };
  };

  const handleTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    if (!start || start.blocked || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (start.axis === null) {
      if (Math.hypot(dx, dy) < 10) return;
      if (dx > 0 && dx > Math.abs(dy) * 1.25) {
        start.axis = 'horizontal';
        setIsDragging(true);
      } else {
        start.axis = 'vertical';
        return;
      }
    }

    if (start.axis === 'horizontal') {
      setDragOffsetX(Math.max(0, dx));
    }
  };

  const finishSwipe = () => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || start.axis !== 'horizontal') return;

    const elapsed = Math.max(1, performance.now() - start.time);
    const velocity = dragOffsetX / elapsed;
    const panelWidth = panelRef.current?.offsetWidth || 400;
    const shouldClose =
      dragOffsetX > Math.min(110, panelWidth * 0.28) ||
      (dragOffsetX > 36 && velocity > 0.45);

    setIsDragging(false);
    if (shouldClose) {
      setDragOffsetX(0);
      onClose();
    } else {
      setDragOffsetX(0);
    }
  };

  if (!rendered || typeof document === 'undefined') return null;

  const backdropOpacity = visible
    ? isDragging
      ? Math.max(0, 1 - dragOffsetX / dragPanelWidth)
      : 1
    : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex justify-end overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title || 'Panel'}
    >
      {/* Dimmed Backdrop */}
      <div
        role="presentation"
        onClick={onClose}
        style={{ opacity: backdropOpacity }}
        className={`fixed inset-0 bg-black/45 backdrop-blur-[3px] touch-none ${
          isDragging
            ? 'transition-none'
            : 'transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
        }`}
      />

      {/* Right-to-Left Sliding Panel with rounded-l-[24px] */}
      <div
        ref={panelRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={finishSwipe}
        onTouchCancel={finishSwipe}
        style={
          isDragging
            ? { transform: `translate3d(${dragOffsetX}px, 0, 0)` }
            : undefined
        }
        className={`relative z-10 h-dvh ${widthClass} bg-[#f5f5f5] ${panelRadiusClass} shadow-[-16px_0_48px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden will-change-transform ${
          isDragging
            ? 'transition-none'
            : 'transition-[transform,width,max-width,border-radius] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
        } ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {!hideHeader && (
          <div className="bg-white px-4 py-3.5 border-b border-[#ececec] flex items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {headerLeft}
              <div className="min-w-0">
                {title && (
                  <h2 className="text-[18px] font-bold text-black leading-snug truncate">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-[12px] text-[#767676] mt-0.5 truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {headerRight}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className="w-8 h-8 rounded-full bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              >
                <FigmaIcon name="x" className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div
          className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${bodyClassName}`}
        >
          {children}
        </div>

        {footer && (
          <div className="shrink-0 bg-white border-t border-[#ececec] pb-[env(safe-area-inset-bottom)]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
