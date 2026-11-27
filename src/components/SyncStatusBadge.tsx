import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ICON_STROKE_WIDTH } from './FigmaIcon';
import { useStore } from '../context/StoreContext';
import {
  flushOfflineQueue,
  getSyncSnapshot,
  subscribeSyncState,
  type SyncSnapshot,
} from '../utils/optimisticSync';

/**
 * Subtle, non-blocking sync indicator shown ONLY when:
 * - Browser is offline (with optional queued count)
 * - Offline mutations are syncing back to the server
 * - A background mutation takes >450ms (prevents flicker on fast requests)
 * - Queued mutations are waiting to retry
 */
export function SyncStatusBadge() {
  const { showToast } = useStore();
  const [snap, setSnap] = useState<SyncSnapshot>(() => getSyncSnapshot());
  const [showSavingPill, setShowSavingPill] = useState(false);

  useEffect(() => subscribeSyncState(setSnap), []);

  useEffect(() => {
    if (snap.inFlightCount <= 0) {
      const reset = window.setTimeout(() => setShowSavingPill(false), 0);
      return () => window.clearTimeout(reset);
    }
    const timer = window.setTimeout(() => setShowSavingPill(true), 450);
    return () => window.clearTimeout(timer);
  }, [snap.inFlightCount]);

  const shouldRender =
    !snap.isOnline ||
    snap.flushingQueue ||
    snap.queuedCount > 0 ||
    showSavingPill;

  if (!shouldRender) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[68px] md:bottom-6 left-3 md:left-6 z-40 pointer-events-auto"
    >
      {!snap.isOnline ? (
        <div className="kova-toast-in inline-flex items-center gap-2 bg-[#171717] text-white border border-white/15 px-3 py-1.5 rounded-full text-[12px] font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <span>
            Offline
            {snap.queuedCount > 0 ? ` · ${snap.queuedCount} queued` : ''}
          </span>
        </div>
      ) : snap.flushingQueue ? (
        <div className="kova-toast-in inline-flex items-center gap-2 bg-[#171717] text-white border border-white/15 px-3 py-1.5 rounded-full text-[12px] font-medium">
          <Loader2
            className="w-3.5 h-3.5 animate-spin text-[#ff6e20] shrink-0"
            strokeWidth={ICON_STROKE_WIDTH}
          />
          <span>
            Syncing{snap.queuedCount > 0 ? ` (${snap.queuedCount})` : '...'}
          </span>
        </div>
      ) : snap.queuedCount > 0 ? (
        <button
          type="button"
          onClick={() => void flushOfflineQueue(showToast)}
          className="kova-toast-in inline-flex items-center gap-2 bg-[#171717] hover:bg-black text-white border border-white/15 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-[#ff6e20] shrink-0" />
          <span>
            {snap.queuedCount} pending ·{' '}
            <span className="text-[#ff6e20] font-semibold">Sync now</span>
          </span>
        </button>
      ) : (
        <div className="kova-toast-in inline-flex items-center gap-2 bg-white/95 backdrop-blur-sm text-[#444444] border border-[#ececec] px-3 py-1.5 rounded-full text-[12px] font-medium">
          <Loader2
            className="w-3.5 h-3.5 animate-spin text-[#ff6e20] shrink-0"
            strokeWidth={ICON_STROKE_WIDTH}
          />
          <span>Saving...</span>
        </div>
      )}
    </div>
  );
}
