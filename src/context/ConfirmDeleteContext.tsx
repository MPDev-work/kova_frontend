import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { FigmaIcon } from '../components/FigmaIcon';
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

interface ConfirmDeleteContextValue {
  confirmDelete: (request: ConfirmDeleteRequest) => void;
}

const ConfirmDeleteContext = createContext<ConfirmDeleteContextValue | null>(
  null,
);

export function ConfirmDeleteProvider({ children }: { children: ReactNode }) {
  const { showToast } = useStore();
  const [modalRequest, setModalRequest] = useState<ConfirmDeleteRequest | null>(
    null,
  );

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

  const confirmDelete = useCallback((request: ConfirmDeleteRequest) => {
    setModalRequest(request);
  }, []);

  const handleConfirmModal = useCallback(async () => {
    if (!modalRequest) return;
    const req = modalRequest;
    setModalRequest(null);

    const label = req.itemLabel?.trim() || req.title.replace(/\?$/, '');

    try {
      req.onOptimisticRemove?.();
    } catch {
      /* non-blocking */
    }

    try {
      await req.onCommit();
    } catch (err) {
      try {
        req.onUndo?.();
      } catch {
        /* ignore */
      }
      showToast(
        err instanceof ApiError
          ? err.message
          : `Unable to delete "${label}".`,
      );
    }
  }, [modalRequest, showToast]);

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
            <div className="relative z-10 w-full max-w-[420px] bg-white border border-[#ececec] rounded-[24px] shadow-2xl overflow-hidden flex flex-col">
              <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-[#fdecec] text-[#e5322d] flex items-center justify-center shrink-0 mt-0.5">
                    <FigmaIcon name="trash" className="w-4.5 h-4.5" />
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
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalRequest(null)}
                  aria-label="Close"
                  className="w-8 h-8 rounded-full bg-[#f7f7f7] hover:bg-[#eeeeee] flex items-center justify-center text-[#767676] hover:text-black transition-colors shrink-0"
                >
                  <FigmaIcon name="x" className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-4 bg-[#fafafa] border-t border-[#ececec] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => void handleConfirmModal()}
                  className="inline-flex items-center gap-1.5 bg-[#e5322d] hover:bg-[#c8231e] text-white text-[13px] font-semibold px-5 py-2 rounded-full transition-colors cursor-pointer"
                >
                  <FigmaIcon name="trash" className="w-3.5 h-3.5" />
                  <span>{modalRequest.confirmLabel || 'Delete'}</span>
                </button>
              </div>
            </div>
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
