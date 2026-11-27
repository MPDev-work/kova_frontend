import { ApiError, apiRequest, toFriendlyErrorMessage } from '../services/api';

const OFFLINE_QUEUE_STORAGE_KEY = 'kova_offline_mutation_queue_v1';

export interface OfflineQueuedRequest {
  id: string;
  label: string;
  path: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  dedupeKey?: string;
  createdAt: number;
  attempts: number;
}

export interface SyncSnapshot {
  isOnline: boolean;
  inFlightCount: number;
  inFlightLabel: string | null;
  queuedCount: number;
  flushingQueue: boolean;
}

type SyncListener = (snapshot: SyncSnapshot) => void;
type ReconcileListener = (detail: {
  syncedCount: number;
  paths: string[];
}) => void;

const syncListeners = new Set<SyncListener>();
const reconcileListeners = new Set<ReconcileListener>();
const deferredReconcilers = new Map<string, () => void>();

let isOnlineState =
  typeof navigator !== 'undefined' ? navigator.onLine : true;
let inFlightCount = 0;
let inFlightLabels: string[] = [];
let flushingQueue = false;
let initializedListeners = false;

function readQueue(): OfflineQueuedRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineQueuedRequest[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: OfflineQueuedRequest[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(OFFLINE_QUEUE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        OFFLINE_QUEUE_STORAGE_KEY,
        JSON.stringify(items),
      );
    }
  } catch {
    // Ignore storage quota errors
  }
}

let cachedQueue: OfflineQueuedRequest[] = readQueue();

export function getSyncSnapshot(): SyncSnapshot {
  return {
    isOnline: isOnlineState,
    inFlightCount,
    inFlightLabel: inFlightLabels[inFlightLabels.length - 1] ?? null,
    queuedCount: cachedQueue.length,
    flushingQueue,
  };
}

function notifySyncListeners(): void {
  const snap = getSyncSnapshot();
  syncListeners.forEach((listener) => {
    try {
      listener(snap);
    } catch {
      // Non-blocking listener
    }
  });
}

export function subscribeSyncState(listener: SyncListener): () => void {
  ensureNetworkListeners();
  syncListeners.add(listener);
  listener(getSyncSnapshot());
  return () => {
    syncListeners.delete(listener);
  };
}

export function subscribeSyncReconcile(
  listener: ReconcileListener,
): () => void {
  ensureNetworkListeners();
  reconcileListeners.add(listener);
  return () => {
    reconcileListeners.delete(listener);
  };
}

export function isNetworkOfflineError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  if (err instanceof ApiError && err.status === 0) {
    return true;
  }
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('fetch') ||
      msg.includes('network') ||
      msg.includes('load failed')
    );
  }
  return false;
}

export function enqueueOfflineMutation(
  entry: Omit<OfflineQueuedRequest, 'id' | 'createdAt' | 'attempts'>,
  onReconcile?: () => void,
): OfflineQueuedRequest {
  const item: OfflineQueuedRequest = {
    ...entry,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
    attempts: 0,
  };

  let next = [...cachedQueue];
  if (entry.dedupeKey) {
    const existingIdx = next.findIndex((q) => q.dedupeKey === entry.dedupeKey);
    if (existingIdx >= 0) {
      next[existingIdx] = item;
    } else {
      next.push(item);
    }
  } else {
    next.push(item);
  }

  // Cap persistent queue to 50 most recent operations
  if (next.length > 50) {
    next = next.slice(-50);
  }

  cachedQueue = next;
  writeQueue(cachedQueue);
  if (onReconcile) {
    deferredReconcilers.set(item.id, onReconcile);
  }
  notifySyncListeners();
  return item;
}

let activeFlushPromise: Promise<{ synced: number; failed: number }> | null =
  null;

export async function flushOfflineQueue(
  onToast?: (msg: string) => void,
): Promise<{ synced: number; failed: number }> {
  if (activeFlushPromise) return activeFlushPromise;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }
  if (cachedQueue.length === 0) {
    return { synced: 0, failed: 0 };
  }

  activeFlushPromise = (async () => {
    flushingQueue = true;
    notifySyncListeners();

    let synced = 0;
    let failed = 0;
    const syncedPaths: string[] = [];
    const remaining: OfflineQueuedRequest[] = [];
    const snapshot = [...cachedQueue];

    for (let i = 0; i < snapshot.length; i++) {
      const item = snapshot[i];
      try {
        await apiRequest<unknown>(item.path, {
          method: item.method,
          body:
            item.body !== undefined ? JSON.stringify(item.body) : undefined,
        });
        synced += 1;
        syncedPaths.push(item.path);
        const reconciler = deferredReconcilers.get(item.id);
        if (reconciler) {
          deferredReconcilers.delete(item.id);
          try {
            reconciler();
          } catch {
            // Non-blocking reconcile
          }
        }
      } catch (err) {
        if (isNetworkOfflineError(err)) {
          // Connection dropped again: keep this and all subsequent items queued
          remaining.push({ ...item, attempts: item.attempts + 1 });
          for (let j = i + 1; j < snapshot.length; j++) {
            remaining.push(snapshot[j]);
          }
          break;
        }
        // Server rejected (4xx/5xx): retry 5xx up to 3 times, drop unrecoverable 4xx
        const status = err instanceof ApiError ? err.status : 0;
        if (status >= 500 && item.attempts < 2) {
          remaining.push({ ...item, attempts: item.attempts + 1 });
        } else {
          failed += 1;
          deferredReconcilers.delete(item.id);
          if (onToast) {
            onToast(
              err instanceof ApiError
                ? `${item.label}: ${err.message}`
                : `Could not sync "${item.label}".`,
            );
          }
        }
      }
    }

    cachedQueue = remaining;
    writeQueue(cachedQueue);
    flushingQueue = false;
    notifySyncListeners();

    if (synced > 0) {
      reconcileListeners.forEach((listener) => {
        try {
          listener({ syncedCount: synced, paths: syncedPaths });
        } catch {
          // Non-blocking
        }
      });
      if (onToast) {
        onToast(
          synced === 1
            ? 'Synced 1 offline change.'
            : `Synced ${synced} offline changes.`,
        );
      }
    }

    return { synced, failed };
  })().finally(() => {
    activeFlushPromise = null;
  });

  return activeFlushPromise;
}

export function clearOfflineQueue(): void {
  cachedQueue = [];
  deferredReconcilers.clear();
  writeQueue([]);
  notifySyncListeners();
}

function ensureNetworkListeners(): void {
  if (initializedListeners || typeof window === 'undefined') return;
  initializedListeners = true;

  const handleOnline = () => {
    isOnlineState = true;
    notifySyncListeners();
    if (cachedQueue.length > 0) {
      void flushOfflineQueue();
    }
  };

  const handleOffline = () => {
    isOnlineState = false;
    notifySyncListeners();
  };

  const handleFocus = () => {
    const nowOnline = navigator.onLine;
    if (nowOnline !== isOnlineState) {
      isOnlineState = nowOnline;
      notifySyncListeners();
    }
    if (nowOnline && cachedQueue.length > 0) {
      void flushOfflineQueue();
    }
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('focus', handleFocus);

  // Flush any persisted offline operations on initial load if already online
  if (isOnlineState && cachedQueue.length > 0) {
    window.setTimeout(() => {
      void flushOfflineQueue();
    }, 1200);
  }
}

export interface OptimisticMutationOptions<T> {
  label: string;
  /** Runs synchronously before any network request for instant UI feedback */
  applyOptimistic: () => void;
  /** Runs in the background against the server */
  commit: () => Promise<T>;
  /** Synchronizes local state with the authoritative server response */
  onSuccess?: (result: T) => void;
  /** Reverts local state when the server rejects or an unqueueable error occurs */
  rollback?: () => void;
  /** Serializable replay specification for offline queuing and automatic retry */
  offlineRequest?: {
    path: string;
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    dedupeKey?: string;
  };
  /** Optional callback to run after this queued item later finishes syncing */
  onReconcileAfterOffline?: () => void;
  onToast?: (msg: string) => void;
  successToast?: string | ((result: T) => string | null | undefined);
  errorToast?: string | ((err: unknown) => string);
  offlineToast?: string;
}

export type OptimisticMutationResult<T> =
  | { status: 'synced'; data: T }
  | { status: 'queued' }
  | { status: 'failed'; error: unknown };

/**
 * Core optimistic UI + background sync + offline queue helper.
 *
 * 1. Immediately applies the optimistic UI change (0ms).
 * 2. If offline and an `offlineRequest` is provided, persists to the offline queue
 *    and automatically retries when connectivity returns.
 * 3. Otherwise runs `commit()` in the background, tracking in-flight state subtly,
 *    reconciling with `onSuccess(result)` on completion, or rolling back cleanly
 *    with `rollback()` + a friendly toast on failure.
 */
export function runOptimisticMutation<T>(
  options: OptimisticMutationOptions<T>,
): Promise<OptimisticMutationResult<T>> {
  ensureNetworkListeners();

  try {
    options.applyOptimistic();
  } catch {
    // Keep going even if optimistic preview throws
  }

  // Fast-path when browser already knows it is offline
  if (
    typeof navigator !== 'undefined' &&
    !navigator.onLine &&
    options.offlineRequest
  ) {
    enqueueOfflineMutation(
      {
        label: options.label,
        ...options.offlineRequest,
      },
      options.onReconcileAfterOffline,
    );
    if (options.onToast) {
      options.onToast(
        options.offlineToast ||
          'Saved offline — will sync automatically when back online.',
      );
    }
    return Promise.resolve({ status: 'queued' });
  }

  inFlightCount += 1;
  inFlightLabels = [...inFlightLabels, options.label];
  notifySyncListeners();

  return options
    .commit()
    .then((result) => {
      try {
        options.onSuccess?.(result);
      } catch {
        // Non-blocking reconcile
      }
      if (options.onToast && options.successToast) {
        const msg =
          typeof options.successToast === 'function'
            ? options.successToast(result)
            : options.successToast;
        if (msg) options.onToast(msg);
      }
      return { status: 'synced' as const, data: result };
    })
    .catch((err) => {
      if (isNetworkOfflineError(err) && options.offlineRequest) {
        isOnlineState = false;
        enqueueOfflineMutation(
          {
            label: options.label,
            ...options.offlineRequest,
          },
          options.onReconcileAfterOffline,
        );
        if (options.onToast) {
          options.onToast(
            options.offlineToast ||
              'Connection lost — change queued and will sync automatically.',
          );
        }
        return { status: 'queued' as const };
      }

      try {
        options.rollback?.();
      } catch {
        // Ignore rollback errors
      }

      if (options.onToast) {
        const msg = options.errorToast
          ? typeof options.errorToast === 'function'
            ? options.errorToast(err)
            : options.errorToast
          : err instanceof ApiError
            ? err.message
            : toFriendlyErrorMessage(
                err instanceof Error ? err.message : undefined,
                0,
              );
        if (msg) options.onToast(msg);
      }
      return { status: 'failed' as const, error: err };
    })
    .finally(() => {
      inFlightCount = Math.max(0, inFlightCount - 1);
      const idx = inFlightLabels.lastIndexOf(options.label);
      if (idx >= 0) {
        inFlightLabels = [
          ...inFlightLabels.slice(0, idx),
          ...inFlightLabels.slice(idx + 1),
        ];
      }
      notifySyncListeners();
    });
}
