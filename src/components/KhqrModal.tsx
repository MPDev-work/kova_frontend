import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ApiError, checkoutApi } from '../services/api';
import type { ChildOrderRecord } from '../types/marketplace';

interface KhqrModalProps {
  open: boolean;
  storeOrders: ChildOrderRecord[];
  onClose: () => void;
  onAllPaid: () => void;
}

export function KhqrModal({
  open,
  storeOrders,
  onClose,
  onAllPaid,
}: KhqrModalProps) {
  const payableOrders = storeOrders.filter((o) => Boolean(o.khqr?.khqr_payload));
  if (!open || payableOrders.length === 0) return null;

  return (
    <KhqrModalContent
      key={payableOrders.map((o) => o.khqr?.bill_number).join('-')}
      payableOrders={payableOrders}
      onClose={onClose}
      onAllPaid={onAllPaid}
    />
  );
}

function KhqrModalContent({
  payableOrders,
  onClose,
  onAllPaid,
}: {
  payableOrders: ChildOrderRecord[];
  onClose: () => void;
  onAllPaid: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paidMap, setPaidMap] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<string>(
    'Waiting for payment...',
  );
  const [statusTone, setStatusTone] = useState<'pending' | 'paid' | 'error'>(
    'pending',
  );
  const [nowTs, setNowTs] = useState(() => Date.now());

  const inFlightRef = useRef(false);
  const completedRef = useRef(false);

  const currentOrder = payableOrders[activeIndex] || payableOrders[0];
  const khqr = currentOrder.khqr!;
  const currency =
    (khqr.currency || 'USD').toUpperCase() === 'KHR' ? 'KHR' : 'USD';
  const merchantName = (
    currentOrder.store?.name || 'KOVA MERCHANT'
  ).toUpperCase();

  useEffect(() => {
    const tick = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const checkStatus = useCallback(async () => {
    if (
      !khqr.bill_number ||
      paidMap[khqr.bill_number] ||
      inFlightRef.current ||
      completedRef.current
    ) {
      return;
    }

    inFlightRef.current = true;
    try {
      const res = await checkoutApi.checkBakongStatus(khqr.bill_number);
      if (res.data.payment_status === 'successful') {
        const nextPaid = { ...paidMap, [khqr.bill_number]: true };
        setPaidMap(nextPaid);
        setStatusTone('paid');
        setStatusMessage('Payment confirmed! Updating your order...');

        const allDone = payableOrders.every(
          (o) => nextPaid[o.khqr!.bill_number],
        );
        if (allDone) {
          completedRef.current = true;
          window.setTimeout(() => onAllPaid(), 900);
        } else if (activeIndex + 1 < payableOrders.length) {
          window.setTimeout(() => {
            setStatusTone('pending');
            setStatusMessage('Waiting for payment...');
            setActiveIndex((idx) => idx + 1);
          }, 800);
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) {
        setStatusTone('error');
        setStatusMessage('QR code expired. Please checkout again.');
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [khqr.bill_number, paidMap, payableOrders, activeIndex, onAllPaid]);

  // Automatic live polling every 2.5 seconds + immediate check on focus
  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void checkStatus();
    }, 1500);
    const poll = window.setInterval(() => {
      void checkStatus();
    }, 2500);
    const onFocus = () => {
      void checkStatus();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(poll);
      window.removeEventListener('focus', onFocus);
    };
  }, [checkStatus]);

  const qrMatrix = useMemo(() => {
    const qr = QRCode.create(khqr.khqr_payload, { errorCorrectionLevel: 'H' });
    const size = qr.modules.size;
    const data = qr.modules.data;
    const cells: { x: number; y: number }[] = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (data[y * size + x]) {
          cells.push({ x, y });
        }
      }
    }
    return { size, cells };
  }, [khqr.khqr_payload]);

  const expiresMs = khqr.expires_at ? new Date(khqr.expires_at).getTime() : 0;
  const secondsLeft =
    expiresMs > 0 ? Math.max(0, Math.floor((expiresMs - nowTs) / 1000)) : 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[4px] flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[348px] flex flex-col items-center gap-3 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Multi-store package switcher ONLY if order spans multiple stores */}
        {payableOrders.length > 1 && (
          <div className="w-full bg-white rounded-[14px] p-2 flex flex-wrap gap-1.5 shadow-lg">
            {payableOrders.map((ord, idx) => {
              const isPaid = Boolean(paidMap[ord.khqr!.bill_number]);
              return (
                <button
                  key={ord.id}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`flex-1 px-3 py-1.5 rounded-full text-[11.5px] font-semibold transition-colors ${
                    idx === activeIndex
                      ? 'bg-[#E1232E] text-white'
                      : isPaid
                        ? 'bg-[#e7f6e7] text-[#029500]'
                        : 'bg-[#f7f7f7] text-[#767676]'
                  }`}
                >
                  {ord.store?.name || `Store ${idx + 1}`}{' '}
                  {isPaid ? '(Paid)' : ''}
                </button>
              );
            })}
          </div>
        )}

        {/* Official NBC Bakong KHQR Digital Card ONLY */}
        <div className="w-full bg-white rounded-[22px] shadow-[0_24px_60px_rgba(0,0,0,0.28)] overflow-hidden">
          {/* Bakong Bravery Red Header (#E1232E) + Official 45° Bottom-Right White Notch */}
          <div className="relative bg-[#E1232E] h-[64px] flex items-center justify-center select-none">
            <svg
              width="104"
              height="24"
              viewBox="0 0 130 30"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="KHQR"
            >
              <path
                d="M12 4H18.5V13.4L27.2 4H35.2L24.5 14.9L36 26H27.7L18.5 16.6V26H12V4Z"
                fill="#FFFFFF"
              />
              <path
                d="M40 4H46.5V12.2H57.5V4H64V26H57.5V17.6H46.5V26H40V4Z"
                fill="#FFFFFF"
              />
              <path
                d="M82.5 3.6C89.8 3.6 95.3 8.4 95.3 15C95.3 18.2 94 21 91.9 23L96.2 27.1L91.7 30L87.5 25.9C86 26.3 84.3 26.5 82.5 26.5C75.2 26.5 69.7 21.6 69.7 15C69.7 8.4 75.2 3.6 82.5 3.6ZM82.5 9.2C78.7 9.2 76.2 11.6 76.2 15C76.2 18.4 78.7 20.9 82.5 20.9C86.3 20.9 88.8 18.4 88.8 15C88.8 11.6 86.3 9.2 82.5 9.2Z"
                fill="#FFFFFF"
              />
              <path
                d="M100.5 4H113.5C119.3 4 122.8 6.9 122.8 11.4C122.8 14.5 121 16.9 118 17.9L123.8 26H116.4L111.4 18.7H107V26H100.5V4ZM107 9.2V13.9H112.9C115.1 13.9 116.3 13 116.3 11.5C116.3 10.1 115.1 9.2 112.9 9.2H107Z"
                fill="#FFFFFF"
              />
            </svg>
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              className="absolute bottom-0 right-0 pointer-events-none"
              aria-hidden="true"
            >
              <polygon points="28,0 28,28 0,28" fill="#FFFFFF" />
            </svg>
          </div>

          {/* Merchant Name & Dynamic Amount */}
          <div className="px-7 pt-5 pb-4 text-left">
            <p className="text-[13.5px] font-medium text-black tracking-[0.02em] uppercase truncate">
              {merchantName}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[30px] font-bold text-black leading-none tabular-nums tracking-[-0.02em]">
                {currency === 'USD'
                  ? Number(khqr.amount).toFixed(2)
                  : Math.round(Number(khqr.amount)).toLocaleString('en-US')}
              </span>
              <span className="text-[14px] font-medium text-black">
                {currency}
              </span>
            </div>
            <p className="text-[11.5px] text-[#767676] mt-1 tabular-nums">
              Bill {khqr.bill_number}
            </p>
          </div>

          {/* Official Dashed Divider */}
          <div className="w-full border-t-[1.5px] border-dashed border-[#D6D6D6]" />

          {/* Real Backend-Generated Bakong KHQR Matrix + Official Center Emblem */}
          <div className="px-7 pt-6 pb-6 flex flex-col items-center">
            <div className="relative w-[228px] h-[228px] bg-white flex items-center justify-center">
              <svg
                viewBox={`0 0 ${qrMatrix.size} ${qrMatrix.size}`}
                className="w-full h-full"
                shapeRendering="crispEdges"
                role="img"
                aria-label={`KHQR payment code for ${merchantName}`}
              >
                <rect
                  width={qrMatrix.size}
                  height={qrMatrix.size}
                  fill="#FFFFFF"
                />
                {qrMatrix.cells.map((c) => (
                  <rect
                    key={`${c.x}-${c.y}`}
                    x={c.x}
                    y={c.y}
                    width={1}
                    height={1}
                    fill="#000000"
                  />
                ))}
              </svg>

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[46px] h-[46px] rounded-full bg-white flex items-center justify-center shadow-[0_0_0_2px_#FFFFFF]">
                  <div className="w-[38px] h-[38px] rounded-full bg-black flex items-center justify-center text-white font-bold">
                    <span className="text-[20px] leading-none">
                      {currency === 'USD' ? '$' : '៛'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between w-full text-[12px]">
              <span
                className={`truncate pr-2 font-medium ${
                  statusTone === 'paid'
                    ? 'text-[#029500] font-semibold'
                    : statusTone === 'error'
                      ? 'text-[#E1232E] font-semibold'
                      : 'text-[#767676]'
                }`}
              >
                {statusMessage}
              </span>
              {expiresMs > 0 && statusTone !== 'paid' && (
                <span className="font-semibold text-[#E1232E] tabular-nums shrink-0">
                  {mm}:{ss}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#767676] text-center mt-2 leading-[1.45]">
              Scan with Bakong, ABA Mobile, ACLEDA, Wing, or any KHQR banking
              app
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
