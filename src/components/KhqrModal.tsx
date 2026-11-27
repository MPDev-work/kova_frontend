import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { FigmaIcon } from './FigmaIcon';
import { ApiError, checkoutApi } from '../services/api';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import type { ChildOrderRecord } from '../types/marketplace';

interface PaidReceiptDetails {
  amount: number;
  currency: 'USD' | 'KHR';
  verifiedAt: string;
  hash: string | null;
  billNumber: string;
  transactionReference: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  merchantName: string;
  payerName: string | null;
  orderNumber: string | null;
  parentOrderNumber: string | null;
}

const BAKONG_BANK_NAMES: Record<string, string> = {
  aclb: 'ACLEDA',
  abaa: 'ABA Bank',
  bkrt: 'Bakong',
  wing: 'Wing Bank',
  cadi: 'Canadia Bank',
  ftbb: 'FTB Bank',
  sath: 'Sathapana Bank',
  vatt: 'Vattanac Bank',
  pras: 'KB PRASAC',
  amkt: 'AMK',
  chip: 'Chip Mong Bank',
  ppcb: 'PPCBank',
  jtrb: 'J Trust Royal',
  prin: 'Prince Bank',
  cpbp: 'Cambodia Post Bank',
  phib: 'Phillip Bank',
  mayb: 'Maybank',
  hlbb: 'Hong Leong Bank',
  mbcb: 'MB Bank',
  shbk: 'Shinhan Bank',
  woor: 'Woori Bank',
  lolc: 'LOLC',
  trmc: 'TrueMoney',
  lyhr: 'Ly Hour PayPro',
};

function parseBakongAccountDisplay(accountId?: string | null): {
  handle: string | null;
  bank: string | null;
} {
  if (!accountId || !accountId.trim()) return { handle: null, bank: null };
  const trimmed = accountId.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex === -1) {
    return { handle: trimmed, bank: null };
  }
  const suffix = trimmed.slice(atIndex + 1).toLowerCase();
  const bank = BAKONG_BANK_NAMES[suffix] ?? suffix.toUpperCase();
  return {
    handle: trimmed,
    bank,
  };
}

function formatBakongReceiptDateTime(iso?: string | null): string {
  const dt = iso ? new Date(iso) : new Date();
  const safe = Number.isNaN(dt.getTime()) ? new Date() : dt;
  const day = String(safe.getDate()).padStart(2, '0');
  const month = safe.toLocaleString('en-US', { month: 'short' });
  const year = safe.getFullYear();
  const hours = String(safe.getHours()).padStart(2, '0');
  const mins = String(safe.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} - ${hours}:${mins}`;
}

function formatReceiptAmount(amount: number, currency: 'USD' | 'KHR'): string {
  if (currency === 'KHR') {
    return Math.round(amount).toLocaleString('en-US');
  }
  const fixed = amount.toFixed(2);
  // Keep 2 decimals unless trailing zero after non-zero tenth or clean amount? Keep standard 2 decimals e.g. 2.50 / 0.01
  return Number(fixed).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface KhqrModalProps {
  open: boolean;
  storeOrders: ChildOrderRecord[];
  onClose: () => void;
  onCancel?: () => Promise<void> | void;
  onTimeout?: (orderNumber?: string) => void;
  onAllPaid: (orderNumber?: string) => void;
  allowBackdropClose?: boolean;
}

export function KhqrModal({
  open,
  storeOrders,
  onClose,
  onCancel,
  onTimeout,
  onAllPaid,
  allowBackdropClose = true,
}: KhqrModalProps) {
  const payableOrders = storeOrders.filter((o) => Boolean(o.khqr?.khqr_payload));
  const isVisible = open && payableOrders.length > 0;
  useBodyScrollLock(isVisible);
  if (!isVisible) return null;

  return (
    <KhqrModalContent
      key={payableOrders
        .map((o) => `${o.khqr?.bill_number ?? ''}-${o.khqr?.expires_at ?? ''}`)
        .join('|')}
      payableOrders={payableOrders}
      onClose={onClose}
      onCancel={onCancel}
      onTimeout={onTimeout}
      onAllPaid={onAllPaid}
      allowBackdropClose={allowBackdropClose}
    />
  );
}

function KhqrModalContent({
  payableOrders,
  onClose,
  onCancel,
  onTimeout,
  onAllPaid,
  allowBackdropClose,
}: {
  payableOrders: ChildOrderRecord[];
  onClose: () => void;
  onCancel?: () => Promise<void> | void;
  onTimeout?: (orderNumber?: string) => void;
  onAllPaid: (orderNumber?: string) => void;
  allowBackdropClose: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paidMap, setPaidMap] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusTone, setStatusTone] = useState<
    'pending' | 'paid' | 'timeout' | 'error'
  >('pending');
  const [allCompleted, setAllCompleted] = useState(false);
  const [paidReceipt, setPaidReceipt] = useState<PaidReceiptDetails | null>(
    null,
  );
  const [copiedOrderId, setCopiedOrderId] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const inFlightRef = useRef(false);
  const completedRef = useRef(false);
  const timeoutHandledRef = useRef(false);
  const timedOutOrderRef = useRef<string | undefined>(undefined);
  const confirmedOrderRef = useRef<string | undefined>(undefined);

  const currentOrder = payableOrders[activeIndex] || payableOrders[0];
  const khqr = currentOrder.khqr!;
  const currency =
    (khqr.currency || 'USD').toUpperCase() === 'KHR' ? 'KHR' : 'USD';
  const currencySymbol = currency === 'KHR' ? '៛' : '$';
  const merchantName = (currentOrder.store?.name || 'Kova Merchant').trim();

  const formattedAmount = useMemo(() => {
    const numeric = Number(khqr.amount || 0);
    if (currency === 'KHR') {
      return Math.round(numeric).toLocaleString('en-US');
    }
    return numeric.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [khqr.amount, currency]);

  const expiresMs = khqr.expires_at ? new Date(khqr.expires_at).getTime() : 0;
  const secondsLeft =
    expiresMs > 0 ? Math.max(0, Math.floor((expiresMs - nowTs) / 1000)) : 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  useEffect(() => {
    const tick = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const handleCancelClick = useCallback(async () => {
    if (cancelling || statusTone === 'paid') return;
    if (onCancel) {
      setCancelling(true);
      try {
        await onCancel();
      } finally {
        setCancelling(false);
      }
    } else {
      onClose();
    }
  }, [cancelling, statusTone, onCancel, onClose]);

  const handleContinueAfterPaid = useCallback(() => {
    if (allCompleted) {
      onAllPaid(confirmedOrderRef.current);
      return;
    }
    if (activeIndex + 1 < payableOrders.length) {
      setStatusTone('pending');
      setStatusMessage('');
      setPaidReceipt(null);
      setCopiedOrderId(false);
      setActiveIndex((idx) => idx + 1);
    } else {
      onAllPaid(confirmedOrderRef.current);
    }
  }, [allCompleted, activeIndex, payableOrders.length, onAllPaid]);

  // Auto-navigate 3 seconds after payment succeeds
  useEffect(() => {
    if (statusTone !== 'paid') return;
    const timer = window.setTimeout(() => {
      handleContinueAfterPaid();
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [statusTone, handleContinueAfterPaid]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || cancelling) return;
      if (statusTone === 'paid') {
        handleContinueAfterPaid();
      } else if (allowBackdropClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    onClose,
    allowBackdropClose,
    statusTone,
    cancelling,
    handleContinueAfterPaid,
  ]);

  const triggerTimeoutState = useCallback(
    (timedOutOrderNumber?: string) => {
      if (timeoutHandledRef.current || completedRef.current) return;
      timeoutHandledRef.current = true;
      timedOutOrderRef.current = timedOutOrderNumber;
      setStatusTone('timeout');
      setStatusMessage(
        'Payment timed out. Your order has been saved as Awaiting Payment.',
      );
      if (onTimeout) {
        window.setTimeout(() => onTimeout(timedOutOrderNumber), 2000);
      }
    },
    [onTimeout],
  );

  const checkStatus = useCallback(
    async (isFinalTimeoutCheck = false) => {
      if (
        !khqr.bill_number ||
        paidMap[khqr.bill_number] ||
        inFlightRef.current ||
        completedRef.current ||
        cancelling ||
        timeoutHandledRef.current
      ) {
        return;
      }

      inFlightRef.current = true;
      try {
        const res = await checkoutApi.checkBakongStatus(khqr.bill_number);
        if (res.data.payment_status === 'successful') {
          const confirmedOrderNumber =
            res.data.parent_order_number || res.data.order_number;
          confirmedOrderRef.current = confirmedOrderNumber;
          const nextPaid = { ...paidMap, [khqr.bill_number]: true };
          setPaidMap(nextPaid);
          setCopiedOrderId(false);
          setPaidReceipt({
            amount: Number(res.data.amount ?? khqr.amount ?? 0),
            currency:
              (res.data.currency || khqr.currency || 'USD').toUpperCase() ===
              'KHR'
                ? 'KHR'
                : 'USD',
            verifiedAt: res.data.verified_at || new Date().toISOString(),
            hash: res.data.hash ?? null,
            billNumber: res.data.bill_number || khqr.bill_number,
            transactionReference: res.data.transaction_reference ?? null,
            fromAccountId: res.data.from_account_id ?? null,
            toAccountId: res.data.to_account_id ?? null,
            merchantName: (res.data.merchant_name || merchantName).trim(),
            payerName: res.data.payer_name ?? null,
            orderNumber: res.data.order_number || currentOrder.order_number || null,
            parentOrderNumber: res.data.parent_order_number ?? null,
          });
          setStatusTone('paid');
          setStatusMessage('Payment confirmed!');

          const allDone = payableOrders.every(
            (o) => nextPaid[o.khqr!.bill_number],
          );
          if (allDone) {
            completedRef.current = true;
            setAllCompleted(true);
          }
          return;
        }

        if (isFinalTimeoutCheck) {
          triggerTimeoutState();
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 410) {
          const errPayload = err.errors as
            | Record<string, unknown>
            | undefined;
          const timedOutOrderNumber =
            typeof errPayload?.parent_order_number === 'string'
              ? errPayload.parent_order_number
              : typeof errPayload?.order_number === 'string'
                ? errPayload.order_number
                : undefined;
          triggerTimeoutState(timedOutOrderNumber);
        } else if (isFinalTimeoutCheck) {
          triggerTimeoutState();
        }
      } finally {
        inFlightRef.current = false;
      }
    },
    [
      khqr.bill_number,
      khqr.amount,
      khqr.currency,
      currentOrder.order_number,
      merchantName,
      paidMap,
      payableOrders,
      cancelling,
      triggerTimeoutState,
    ],
  );

  // Trigger final live verification as soon as countdown reaches 00:00, then transition to Awaiting Payment if still unpaid
  useEffect(() => {
    if (
      expiresMs > 0 &&
      secondsLeft === 0 &&
      statusTone === 'pending' &&
      !timeoutHandledRef.current &&
      !completedRef.current
    ) {
      void checkStatus(true);
    }
  }, [expiresMs, secondsLeft, statusTone, checkStatus]);

  // Quota-friendly automatic polling: wait 5s after QR opens, then poll every 6s
  // while visible (and check immediately when user returns from their bank app).
  useEffect(() => {
    if (statusTone !== 'pending') return;
    let stopped = false;

    const triggerCheck = () => {
      if (stopped || document.hidden) return;
      void checkStatus(false);
    };

    const initialTimer = window.setTimeout(triggerCheck, 5000);
    const poll = window.setInterval(triggerCheck, 6000);
    const onFocus = () => {
      if (!stopped) void checkStatus(false);
    };
    const onVisibility = () => {
      if (!stopped && !document.hidden) void checkStatus(false);
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkStatus, statusTone]);

  // Build a single unified SVG path with Error Correction Level 'M' so there are
  // zero sub-pixel hairline gaps between modules and optimal scanability for all bank apps.
  const qrMatrix = useMemo(() => {
    const qr = QRCode.create(khqr.khqr_payload, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const data = qr.modules.data;
    const segments: string[] = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (data[y * size + x]) {
          segments.push(`M${x} ${y}h1v1H${x}z`);
        }
      }
    }
    return { size, pathData: segments.join('') };
  }, [khqr.khqr_payload]);

  const isPaidState = statusTone === 'paid';
  const isTimeoutState = statusTone === 'timeout';

  const handleCopyOrderId = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedOrderId(true);
      window.setTimeout(() => setCopiedOrderId(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  if (isPaidState) {
    const receiptCurrency = paidReceipt?.currency ?? currency;
    const receiptSymbol = receiptCurrency === 'KHR' ? '៛' : '$';
    const receiptAmount = formatReceiptAmount(
      paidReceipt?.amount ?? Number(khqr.amount || 0),
      receiptCurrency,
    );
    const receiptMerchant = paidReceipt?.merchantName || merchantName;
    const rawOrderId =
      paidReceipt?.parentOrderNumber ||
      paidReceipt?.orderNumber ||
      paidReceipt?.billNumber ||
      khqr.bill_number;
    const displayOrderId = rawOrderId.startsWith('#')
      ? rawOrderId
      : `#${rawOrderId}`;
    const dateTimeText = formatBakongReceiptDateTime(paidReceipt?.verifiedAt);
    const fromInfo = parseBakongAccountDisplay(paidReceipt?.fromAccountId);

    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[4px] overflow-y-auto flex flex-col px-3.5 sm:px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="relative w-full max-w-[364px] sm:max-w-[392px] mx-auto my-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.32)]">
          {/* Main White Bakong Slip Card */}
          <div className="bg-white rounded-t-[22px] sm:rounded-t-[24px] overflow-hidden">
            {/* Top Looping Success Tick Badge + Amount + Merchant */}
            <div className="px-4 sm:px-6 pt-6 sm:pt-8 pb-5 sm:pb-6 flex flex-col items-center text-center">
              <div className="relative w-20 h-20 sm:w-[92px] sm:h-[92px] flex items-center justify-center">
                <span
                  className="khqr-success-ring absolute inset-1.5 rounded-full bg-[#389B3C]/20 pointer-events-none"
                  aria-hidden="true"
                />
                <span
                  className="khqr-success-ring-delay absolute inset-1.5 rounded-full border-2 border-[#389B3C]/30 pointer-events-none"
                  aria-hidden="true"
                />
                <div className="khqr-success-circle relative w-16 h-16 sm:w-[74px] sm:h-[74px] rounded-full bg-[#389B3C] ring-[3px] ring-[#E8F5E9] flex items-center justify-center">
                  <svg
                    viewBox="0 0 42 42"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-8 h-8 sm:w-[38px] sm:h-[38px]"
                    aria-hidden="true"
                  >
                    <path
                      d="M10.5 21.8L17.6 28.8L31.8 14.2"
                      stroke="#FFFFFF"
                      strokeWidth="4.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="khqr-success-check"
                    />
                  </svg>
                </div>
              </div>

              <p className="khqr-fade-up mt-2.5 sm:mt-3 text-[28px] sm:text-[34px] font-extrabold text-[#111111] leading-tight tracking-[-0.025em] tabular-nums">
                -{receiptSymbol} {receiptAmount}
              </p>

              <p className="khqr-fade-up mt-1 text-[13.5px] sm:text-[14.5px] text-[#767676] font-medium max-w-full truncate">
                To{' '}
                <span className="font-bold text-[#555555] uppercase">
                  {receiptMerchant}
                </span>
              </p>
            </div>

            {/* Ticket Side Cutouts + Dashed Perforation Line */}
            <div className="relative flex items-center">
              <span
                aria-hidden="true"
                className="w-4 h-7 rounded-r-full bg-black/55 -ml-2 shrink-0"
              />
              <div className="flex-1 border-t-[1.5px] border-dashed border-[#D8D8D8]" />
              <span
                aria-hidden="true"
                className="w-4 h-7 rounded-l-full bg-black/55 -mr-2 shrink-0"
              />
            </div>

            {/* Structured Bakong Transaction Details */}
            <div className="px-4 sm:px-6 pt-2 pb-4 sm:pb-5 text-[12px] sm:text-[13px] leading-[1.45]">
              {/* Order ID */}
              <div className="flex items-center gap-2 sm:gap-2.5 py-2.5 sm:py-3 border-b border-[#EFEFEF]">
                <span className="w-[96px] sm:w-[114px] shrink-0 font-bold text-[#171717] whitespace-nowrap">
                  Order ID
                </span>
                <span className="shrink-0 text-[#767676] font-semibold">:</span>
                <div className="flex-1 flex items-center justify-between gap-1.5 min-w-0">
                  <span
                    className="font-mono text-[11.5px] sm:text-[12.5px] text-[#555555] truncate"
                    title={displayOrderId}
                  >
                    {displayOrderId}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyOrderId(displayOrderId)}
                    aria-label="Copy order ID"
                    title={copiedOrderId ? 'Copied!' : 'Copy order ID'}
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                      copiedOrderId
                        ? 'bg-[#e7f6e7] text-[#389B3C]'
                        : 'hover:bg-[#f4f4f4] text-[#171717]'
                    }`}
                  >
                    <FigmaIcon
                      name={copiedOrderId ? 'check' : 'copy'}
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                    />
                  </button>
                </div>
              </div>

              {/* Date And Time */}
              <div className="flex items-center gap-2 sm:gap-2.5 py-2.5 sm:py-3 border-b border-[#EFEFEF]">
                <span className="w-[96px] sm:w-[114px] shrink-0 font-bold text-[#171717] whitespace-nowrap">
                  Date And Time
                </span>
                <span className="shrink-0 text-[#767676] font-semibold">:</span>
                <span className="flex-1 min-w-0 text-[#555555] tabular-nums truncate">
                  {dateTimeText}
                </span>
              </div>

              {/* From */}
              <div className="flex items-start gap-2 sm:gap-2.5 py-2.5 sm:py-3 border-b border-[#EFEFEF]">
                <span className="w-[96px] sm:w-[114px] shrink-0 font-bold text-[#171717] whitespace-nowrap">
                  From
                </span>
                <span className="shrink-0 text-[#767676] font-semibold">:</span>
                <div className="flex-1 flex flex-col text-[#555555] min-w-0">
                  {paidReceipt?.payerName && (
                    <span className="truncate">{paidReceipt.payerName}</span>
                  )}
                  {fromInfo.handle && (
                    <span className="break-all">{fromInfo.handle}</span>
                  )}
                  <span className="text-[#666666]">
                    {fromInfo.bank || 'Bakong KHQR'}
                  </span>
                </div>
              </div>

              {/* 3-Second Auto-Navigate Progress Bar (Primary Color) */}
              <div className="pt-3.5 sm:pt-4 flex flex-col items-center gap-2 text-center">
                <p className="text-[12px] sm:text-[12.5px] text-[#767676]">
                  {allCompleted
                    ? 'Redirecting to your orders...'
                    : 'Opening the next store KHQR...'}
                </p>
                <div className="w-48 sm:w-56 h-1 rounded-full bg-[#ececec] overflow-hidden">
                  <div className="khqr-redirect-bar block h-full w-full rounded-full bg-[#ff6e20]" />
                </div>
              </div>
            </div>

            {/* Bottom Bakong / KHQR Branded Strip */}
            <div className="bg-[#F2F3F5] px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-center">
              <img
                src="/assets/KHQR - asset/KHQR Logo red.svg"
                alt="Bakong KHQR"
                className="h-[22px] sm:h-[26px] w-auto select-none pointer-events-none"
                draggable={false}
              />
            </div>
          </div>

          {/* Authentic Serrated Zigzag Bottom Edge */}
          <svg
            viewBox="0 0 360 12"
            preserveAspectRatio="none"
            className="w-full h-[10px] sm:h-[11px] block -mt-px"
            aria-hidden="true"
          >
            <polygon
              fill="#F2F3F5"
              points="0,0 360,0 360,2 351,12 342,2 333,12 324,2 315,12 306,2 297,12 288,2 279,12 270,2 261,12 252,2 243,12 234,2 225,12 216,2 207,12 198,2 189,12 180,2 171,12 162,2 153,12 144,2 135,12 126,2 117,12 108,2 99,12 90,2 81,12 72,2 63,12 54,2 45,12 36,2 27,12 18,2 9,12 0,2"
            />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[4px] overflow-y-auto flex flex-col px-3.5 sm:px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={() => {
        if (allowBackdropClose && !cancelling) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full ${
          isTimeoutState ? 'max-w-[460px]' : 'max-w-[700px]'
        } bg-white rounded-[22px] sm:rounded-[24px] shadow-[0_24px_64px_rgba(0,0,0,0.22)] px-5 py-6 sm:px-10 sm:py-9 mx-auto my-auto transition-[max-width] duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        {isTimeoutState ? (
          <div className="py-6 sm:py-8 flex flex-col items-center justify-center text-center">
            <div className="w-[76px] h-[76px] rounded-full bg-[#ffefe6] flex items-center justify-center">
              <FigmaIcon name="clock" className="w-8 h-8 text-[#ff6e20]" />
            </div>

            <span className="mt-5 px-3.5 py-1 rounded-full bg-[#ffefe6] text-[#ff6e20] text-[12px] font-semibold">
              Awaiting Payment
            </span>

            <h3 className="mt-3 text-[22px] font-bold text-[#111111] tracking-[-0.015em]">
              Payment Timed Out
            </h3>

            <p className="mt-2.5 text-[13.5px] text-[#767676] leading-[1.55] max-w-[320px]">
              {statusMessage ||
                'Your order is saved as Awaiting Payment. You can resume KHQR payment anytime from your orders.'}
            </p>

            <button
              type="button"
              onClick={() =>
                onTimeout ? onTimeout(timedOutOrderRef.current) : onClose()
              }
              className="mt-6 px-8 py-2.5 rounded-full bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13.5px] font-semibold transition-colors cursor-pointer"
            >
              View Order
            </button>
          </div>
        ) : (
          <>
            {/* Multi-store switcher ONLY when checkout includes multiple stores */}
            {payableOrders.length > 1 && (
              <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
                {payableOrders.map((ord, idx) => {
                  const isPaid = Boolean(paidMap[ord.khqr!.bill_number]);
                  return (
                    <button
                      key={ord.id}
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      className={`px-4 py-1.5 rounded-full text-[12px] font-semibold transition-colors cursor-pointer ${
                        idx === activeIndex
                          ? 'bg-[#E1232E] text-white'
                          : isPaid
                            ? 'bg-[#e7f6e7] text-[#029500]'
                            : 'bg-[#f4f4f4] text-[#666666] hover:bg-[#ebebeb]'
                      }`}
                    >
                      {ord.store?.name || `Store ${idx + 1}`}{' '}
                      {isPaid ? '(Paid)' : ''}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-10">
              {/* Left Column: KHQR Logo, Merchant Info, Amount, Status & Single Cancel Button */}
              <div className="flex-1 flex flex-col items-center justify-center text-center w-full">
                <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-[#8E8E93] mb-3">
                  Pay with Bakong
                </p>

                <img
                  src="/assets/KHQR - asset/KHQR Logo red.svg"
                  alt="KHQR"
                  className="h-[34px] sm:h-[38px] w-auto select-none pointer-events-none"
                  draggable={false}
                />

                <p className="mt-5 text-[20px] sm:text-[22px] font-medium text-[#111111] leading-snug max-w-[260px] truncate">
                  {merchantName}
                </p>

                <p className="mt-1.5 text-[28px] sm:text-[32px] font-normal text-[#8E8E93] leading-none tabular-nums tracking-[-0.01em]">
                  <span className="mr-1.5">{currencySymbol}</span>
                  {formattedAmount}
                </p>

                <div className="mt-4 min-h-[20px] flex items-center justify-center">
                  {statusTone === 'error' ? (
                    <span className="text-[13px] font-semibold text-[#E1232E]">
                      {statusMessage}
                    </span>
                  ) : expiresMs > 0 ? (
                    <span className="text-[12.5px] text-[#8E8E93] tabular-nums">
                      Valid for{' '}
                      <strong className="font-semibold text-[#111111]">
                        {mm}:{ss}
                      </strong>
                    </span>
                  ) : null}
                </div>

                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => void handleCancelClick()}
                  className="mt-6 px-9 py-2.5 rounded-full border border-[#E2E2E2] bg-white hover:bg-[#F7F7F7] active:bg-[#EFEFEF] disabled:opacity-60 text-[13.5px] font-medium text-[#333333] transition-colors cursor-pointer"
                >
                  {cancelling ? 'Cancelling...' : 'Cancel'}
                </button>
              </div>

              {/* Right Column: Official NBC KHQR Card (Strict 20:29 Ratio & Guidelines) + Helper Text */}
              <div className="flex flex-col items-center shrink-0">
                {/*
                  Official NBC KHQR Appearance Guidelines:
                  - Ratio: 20:29 (260x377 mobile, 290x420.5 desktop)
                  - Shadow: x:0, y:0, blur:16, #000000 at 10% opacity
                  - Header: 12% of card height
                  - QR Left-Right Margin: 10% of card height (= 14.5% of card width)
                  - QR Top-Bottom Margin: 8% of card height (= 11.6% of card width)
                */}
                <div className="w-[260px] h-[377px] sm:w-[290px] sm:h-[420.5px] bg-white shadow-[0_0_16px_rgba(0,0,0,0.10)] overflow-hidden flex flex-col rounded-[24px]">
                  {/* Header: exact 12% of card height */}
                  <div className="relative bg-[#E1232E] h-[12%] shrink-0 flex items-center justify-center select-none">
                    <img
                      src="/assets/KHQR - asset/KHQR Logo.svg"
                      alt="KHQR"
                      className="h-[34%] w-auto select-none pointer-events-none"
                      draggable={false}
                    />
                    {/* Official 45° Right-Side Red Diagonal Overhang */}
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      className="absolute right-0 -bottom-[23.5px] pointer-events-none"
                      aria-hidden="true"
                    >
                      <polygon points="0,0 24,0 24,24" fill="#E1232E" />
                    </svg>
                  </div>

                  {/* Merchant Name & Amount aligned with QR left margin (14.5% of card width = 10% of height) */}
                  <div className="flex-1 min-h-0 px-[14.5%] flex flex-col justify-center text-left">
                    <p className="text-[12px] sm:text-[13px] font-medium text-[#111111] leading-snug truncate">
                      {merchantName}
                    </p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-[23px] sm:text-[26px] font-bold text-black leading-none tracking-[-0.02em] tabular-nums">
                        {formattedAmount}
                      </span>
                      <span className="text-[12px] sm:text-[13px] font-normal text-[#111111]">
                        {currency}
                      </span>
                    </div>
                  </div>

                  {/* Perforated Dashed Divider */}
                  <svg
                    className="w-full h-[1.5px] shrink-0 block"
                    viewBox="0 0 290 2"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <line
                      x1="0"
                      y1="1"
                      x2="290"
                      y2="1"
                      stroke="#000000"
                      strokeOpacity="0.35"
                      strokeWidth="1.2"
                      strokeDasharray="6 6"
                    />
                  </svg>

                  {/* QR Section: Left-Right Margin = 10% of H (14.5% of W), Top-Bottom Margin = 8% of H (11.6% of W) */}
                  <div className="shrink-0 px-[14.5%] py-[11.6%] flex items-center justify-center">
                    <div className="relative w-full aspect-square bg-white flex items-center justify-center">
                      <svg
                        viewBox={`0 0 ${qrMatrix.size} ${qrMatrix.size}`}
                        className="w-full h-full block"
                        shapeRendering="crispEdges"
                        role="img"
                        aria-label={`KHQR payment code for ${merchantName}`}
                      >
                        <rect
                          width={qrMatrix.size}
                          height={qrMatrix.size}
                          fill="#FFFFFF"
                        />
                        <path d={qrMatrix.pathData} fill="#000000" />
                      </svg>

                      {/* Official Center Currency Emblem */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-[34px] h-[34px] sm:w-[38px] sm:h-[38px] rounded-full bg-white p-[3px] flex items-center justify-center">
                          <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-white">
                            <span className="text-[16px] sm:text-[18px] font-bold leading-none select-none">
                              {currencySymbol}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-[13px] leading-[1.45] text-[#8E8E93] text-center max-w-[260px]">
                  Scan with Bakong or any KHQR supported banking app
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
