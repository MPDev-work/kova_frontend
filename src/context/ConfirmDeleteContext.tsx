import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, Trash2, X } from 'lucide-react';
import { useStore } from './StoreContext';
import { ApiError } from '../services/api';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';

export interface ConfirmDeleteRequest {
  title: string;
  description?: string;
  itemLabel?: string;
  confirmLabel?: string;
  undoDelayMs?: number;
  onOptimisticRemove?: () => void;
  onUndo?: () => void;
  onCommit: () => Promise<void> | void;
}

interface PendingDeletion {
  id: number;
  label: string;
  durationMs: number;
  startedAt: number;
  expiresAt: number;
  onUndo?: () => void;
  onCommit: () => Promise<void> | void;
}

interface ConfirmDeleteContextValue {
  confirmDelete: (request: ConfirmDeleteRequest) => void;
}

const ConfirmDeleteContext = createContext<ConfirmDeleteContextValue | null>(
  null,
);

const DEFAULT_UNDO_DELAY_MS = 5000;

export function ConfirmDeleteProvider({ children }: { children: ReactNode }) {
  const { showToast } = useStore();
  const [modalRequest, setModalRequest] = useState<ConfirmDeleteRequest | null>(
    null,
  );
  const [pendingList, setPendingList] = useState<PendingDeletion[]>([]);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const nextIdRef = useRef(1);
  const timersRef = useRef<Map<number, number>>(new Map());
  const pendingMapRef = useRef<Map<number, PendingDeletion>>(new Map());

  useBodyScrollLock(Boolean(modalRequest));

  // Close confirmation modal on Escape
  useEffect(() => {
    if (!modalRequest) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalRequest(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalRequest]);

  // Smooth tick for countdown numbers and shrinking progress bar while any deletion is pending
  useEffect(() => {
    if (pendingList.length === 0) return;
    const interval = window.setInterval(() => {
      setNowTs(Date.now());
    }, 100);
    return () => window.clearInterval(interval);
  }, [pendingList.length]);

  // Clear timers on provider unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
      timers.clear();
    };
  }, []);

  const confirmDelete = useCallback((request: ConfirmDeleteRequest) => {
    setModalRequest(request);
  }, []);

  const handleConfirmModal = useCallback(() => {
    if (!modalRequest) return;
    const req = modalRequest;
    setModalRequest(null);

    const id = nextIdRef.current++;
    const durationMs = req.undoDelayMs ?? DEFAULT_UNDO_DELAY_MS;
    const startedAt = Date.now();
    const expiresAt = startedAt + durationMs;
    const label = req.itemLabel?.trim() || req.title.replace(/\?$/, '');

    try {
      req.onOptimisticRemove?.();
    } catch {
      /* non-blocking */
    }

    const entry: PendingDeletion = {
      id,
      label,
      durationMs,
      startedAt,
      expiresAt,
      onUndo: req.onUndo,
      onCommit: req.onCommit,
    };

    pendingMapRef.current.set(id, entry);
    setNowTs(startedAt);
    setPendingList((prev) => [entry, ...prev]);

    const timerId = window.setTimeout(async () => {
      timersRef.current.delete(id);
      const current = pendingMapRef.current.get(id);
      if (!current) return;
      pendingMapRef.current.delete(id);
      setPendingList((prev) => prev.filter((item) => item.id !== id));

      try {
        await current.onCommit();
      } catch (err) {
        try {
          current.onUndo?.();
        } catch {
          /* ignore */
        }
        showToast(
          err instanceof ApiError
            ? err.message
            : `Unable to delete "${current.label}".`,
        );
      }
    }, durationMs);

    timersRef.current.set(id, timerId);
  }, [modalRequest, showToast]);

  const handleUndo = useCallback(
    (id: number) => {
      const timerId = timersRef.current.get(id);
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
        timersRef.current.delete(id);
      }
      const entry = pendingMapRef.current.get(id);
      pendingMapRef.current.delete(id);
      setPendingList((prev) => prev.filter((item) => item.id !== id));

      if (entry) {
        try {
          entry.onUndo?.();
        } catch {
          /* ignore */
        }
        showToast('Deletion cancelled.');
      }
    },
    [showToast],
  );

  return (
    <ConfirmDeleteContext.Provider value={{ confirmDelete }}>
      {children}

      {/* Verification Confirmation Modal */}
      {modalRequest &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kova-confirm-delete-title"
          >
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
              onClick={() => setModalRequest(null)}
            />
            <div className="relative z-10 w-full max-w-[420px] bg-white border border-[#ececec] rounded-[22px] shadow-2xl overflow-hidden flex flex-col">
              <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-[#fdecec] text-[#e5322d] flex items-center justify-center shrink-0 mt-0.5">
                    <Trash2 className="w-4.5 h-4.5" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      id="kova-confirm-delete-title"
                      className="text-[16.5px] font-bold text-black leading-snug"
                    >
                      {modalRequest.title}
                    </h2>
                    <p className="text-[13px] text-[#767676] mt-1.5 leading-relaxed">
                      {modalRequest.description ||
                        'Are you sure you want to delete this item?'}
                    </p>
                    <p className="text-[11.5px] text-[#8a8a8a] mt-2">
                      After clicking Delete, you will still have 5 seconds to
                      undo.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalRequest(null)}
                  aria-label="Close"
                  className="w-8 h-8 rounded-full bg-[#f7f7f7] hover:bg-[#eeeeee] flex items-center justify-center text-[#767676] hover:text-black transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-4 bg-[#fafafa] border-t border-[#ececec] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalRequest(null)}
                  className="bg-white border border-[#ececec] hover:border-[#cccccc] text-black text-[13px] font-semibold px-4.5 py-2 rounded-full transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmModal}
                  className="inline-flex items-center gap-1.5 bg-[#e5322d] hover:bg-[#c8231e] text-white text-[13px] font-semibold px-5 py-2 rounded-full transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{modalRequest.confirmLabel || 'Delete'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Bottom 5-Second Undo Snackbar Queue */}
      {pendingList.length > 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[95] flex flex-col items-center gap-2.5 w-[calc(100vw-2rem)] max-w-[460px] pointer-events-none">
            {pendingList.map((item) => {
              const remainingMs = Math.max(0, item.expiresAt - nowTs);
              const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
              const progressPct = Math.max(
                0,
                Math.min(100, (remainingMs / item.durationMs) * 100),
              );

              return (
                <div
                  key={item.id}
                  role="status"
                  aria-live="polite"
                  className="kova-toast-in pointer-events-auto w-full bg-[#171717] text-[#EDEDED] border border-[#2E2E2E] rounded-[16px] shadow-[0_14px_34px_rgba(0,0,0,0.42)] overflow-hidden"
                >
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-[#e5484d]/20 text-[#e5484d] flex items-center justify-center shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                      <p className="text-[13px] font-medium text-[#EDEDED] truncate">
                        Deleting{' '}
                        <span className="font-semibold text-white">
                          &ldquo;{item.label}&rdquo;
                        </span>{' '}
                        in{' '}
                        <span className="font-bold text-[#ff6e20] tabular-nums">
                          {remainingSec}s
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUndo(item.id)}
                      className="inline-flex items-center gap-1.5 bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12px] font-bold px-3.5 py-1.5 rounded-full transition-colors shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Undo</span>
                    </button>
                  </div>
                  <div className="h-[3px] w-full bg-white/10">
                    <div
                      className="h-full bg-[#ff6e20] transition-[width] duration-100 ease-linear"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ConfirmDeleteContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirmDelete(): ConfirmDeleteContextValue {
  const ctx = useContext(ConfirmDeleteContext);
  if (!ctx) {
    throw new Error(
      'useConfirmDelete must be used inside <ConfirmDeleteProvider>',
    );
  }
  return ctx;
}
