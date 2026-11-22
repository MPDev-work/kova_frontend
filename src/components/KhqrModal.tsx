import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import QRCode from 'qrcode';
import { ApiError, checkoutApi } from '../services/api';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import type { ChildOrderRecord } from '../types/marketplace';

const SUCCESS_SPARKS = [
  { angle: '0deg', color: '#029500', size: 7 },
  { angle: '45deg', color: '#ff6e20', size: 6 },
  { angle: '90deg', color: '#22c55e', size: 7 },
  { angle: '135deg', color: '#fbbf24', size: 6 },
  { angle: '180deg', color: '#029500', size: 7 },
  { angle: '225deg', color: '#ff6e20', size: 6 },
  { angle: '270deg', color: '#22c55e', size: 7 },
  { angle: '315deg', color: '#fbbf24', size: 6 },
];

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
  const [cancelling, setCancelling] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const inFlightRef = useRef(false);
  const completedRef = useRef(false);
  const timeoutHandledRef = useRef(false);
  const timedOutOrderRef = useRef<string | undefined>(undefined);

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && allowBackdropClose && statusTone !== 'paid' && !cancelling) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, allowBackdropClose, statusTone, cancelling]);

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
          const nextPaid = { ...paidMap, [khqr.bill_number]: true };
          setPaidMap(nextPaid);
          setStatusTone('paid');
          setStatusMessage('Payment confirmed!');

          const allDone = payableOrders.every(
            (o) => nextPaid[o.khqr!.bill_number],
          );
          if (allDone) {
            completedRef.current = true;
            setAllCompleted(true);
            window.setTimeout(() => onAllPaid(confirmedOrderNumber), 2250);
          } else if (activeIndex + 1 < payableOrders.length) {
            window.setTimeout(() => {
              setStatusTone('pending');
              setStatusMessage('');
              setActiveIndex((idx) => idx + 1);
            }, 1600);
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
      paidMap,
      payableOrders,
      activeIndex,
      onAllPaid,
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

  const isCompactState = statusTone === 'paid' || statusTone === 'timeout';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[4px] flex items-center justify-center p-4 overflow-y-auto"
      onClick={() => {
        if (allowBackdropClose && statusTone !== 'paid' && !cancelling) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full ${
          isCompactState ? 'max-w-[460px]' : 'max-w-[700px]'
        } bg-white rounded-[24px] shadow-[0_24px_64px_rgba(0,0,0,0.22)] px-6 py-7 sm:px-10 sm:py-9 my-auto transition-[max-width] duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        {statusTone === 'paid' ? (
          <div className="py-6 sm:py-8 flex flex-col items-center justify-center text-center">
            {/* Animated Success Icon: Expanding Pulse Rings + Spark Burst + Pop Circle + Drawn Checkmark */}
            <div className="relative w-[104px] h-[104px] flex items-center justify-center">
              <span
                className="khqr-success-ring absolute inset-0 rounded-full bg-[#029500]/18 pointer-events-none"
                aria-hidden="true"
              />
              <span
                className="khqr-success-ring-delay absolute inset-0 rounded-full border-2 border-[#029500]/30 pointer-events-none"
                aria-hidden="true"
              />

              {SUCCESS_SPARKS.map((spark) => (
                <span
                  key={spark.angle}
                  className="khqr-success-spark absolute rounded-full pointer-events-none"
                  style={
                    {
                      width: `${spark.size}px`,
                      height: `${spark.size}px`,
                      backgroundColor: spark.color,
                      '--spark-angle': spark.angle,
                    } as CSSProperties
                  }
                  aria-hidden="true"
                />
              ))}

              <div className="khqr-success-circle relative w-[84px] h-[84px] rounded-full bg-[#029500] shadow-[0_12px_28px_rgba(2,149,0,0.28)] flex items-center justify-center">
                <svg
                  width="42"
                  height="42"
                  viewBox="0 0 42 42"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M11 21.8L17.8 28.6L31.5 14.5"
                    stroke="#FFFFFF"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="khqr-success-check"
                  />
                </svg>
              </div>
            </div>

            <h3
              className="khqr-fade-up mt-7 text-[24px] sm:text-[26px] font-bold text-[#111111] tracking-[-0.02em]"
              style={{ animationDelay: '0.28s' }}
            >
              Payment Complete
            </h3>

            <div
              className="khqr-fade-up mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#e7f6e7] text-[#029500] text-[14.5px] font-semibold tabular-nums"
              style={{ animationDelay: '0.38s' }}
            >
              <span>
                {currencySymbol} {formattedAmount}
              </span>
              <span className="opacity-45">·</span>
              <span className="max-w-[180px] truncate">{merchantName}</span>
            </div>

            <p
              className="khqr-fade-up mt-3.5 text-[13.5px] text-[#767676] leading-[1.5] max-w-[300px]"
              style={{ animationDelay: '0.46s' }}
            >
              {allCompleted
                ? 'Your order has been confirmed. Redirecting to your orders...'
                : 'Payment confirmed! Opening the next store KHQR...'}
            </p>

            {/* Smooth Redirect Progress Bar */}
            <div
              className="khqr-fade-up mt-7 w-full max-w-[220px] h-[4px] rounded-full bg-[#ececec] overflow-hidden"
              style={{ animationDelay: '0.52s' }}
            >
              <div className="khqr-redirect-bar h-full w-full rounded-full bg-[#029500]" />
            </div>
          </div>
        ) : statusTone === 'timeout' ? (
          <div className="py-6 sm:py-8 flex flex-col items-center justify-center text-center">
            <div className="w-[76px] h-[76px] rounded-full bg-[#ffefe6] flex items-center justify-center">
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="#ff6e20"
                  strokeWidth="2.2"
                />
                <path
                  d="M12 7.5V12.5L15 14.5"
                  stroke="#ff6e20"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
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
                <div className="w-[260px] h-[377px] sm:w-[290px] sm:h-[420.5px] bg-white rounded-[20px] shadow-[0_0_16px_rgba(0,0,0,0.10)] overflow-hidden flex flex-col">
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
