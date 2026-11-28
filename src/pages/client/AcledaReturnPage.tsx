import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ACLEDA_PENDING_TX_STORAGE_KEY,
  AcledaBankIcon,
} from '../../components/PayWithAcledaButton';
import { FigmaIcon } from '../../components/FigmaIcon';
import { useStore } from '../../context/StoreContext';
import { ApiError, checkoutApi } from '../../services/api';
import { clearCheckoutSelection } from '../../utils/checkoutSelection';
import type { AcledaPaymentData } from '../../types/marketplace';

const MAX_AUTO_POLLS = 15;
const POLL_INTERVAL_MS = 3000;

export function AcledaReturnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshCart, refreshOrders, removeCoupon, showToast } = useStore();

  const transactionId = (() => {
    const fromQuery = searchParams.get('transaction_id')?.trim();
    if (fromQuery) return fromQuery;
    try {
      const raw = window.sessionStorage.getItem(ACLEDA_PENDING_TX_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { transaction_id?: string };
        return parsed.transaction_id || '';
      }
    } catch {
      // Ignore storage parsing errors
    }
    return '';
  })();

  const [state, setState] = useState<
    'verifying' | 'paid' | 'failed' | 'pending_timeout'
  >(transactionId ? 'verifying' : 'failed');
  const [payment, setPayment] = useState<AcledaPaymentData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>(
    transactionId
      ? ''
      : 'No ACLEDA Bank transaction reference was found for this return link.',
  );
  const [checkingManual, setCheckingManual] = useState(false);

  const pollCountRef = useRef(0);
  const inFlightRef = useRef(false);
  const finalizedRef = useRef(false);

  const verifyWithBackend = useCallback(
    async (isManual = false) => {
      if (!transactionId || inFlightRef.current || finalizedRef.current) {
        return;
      }

      inFlightRef.current = true;

      try {
        // Always verify via authoritative backend endpoint — never trust URL query params
        const res = await checkoutApi.checkAcledaStatus(transactionId);
        const data = res.data;
        setPayment(data);

        if (data.status === 'successful') {
          finalizedRef.current = true;
          window.sessionStorage.removeItem(ACLEDA_PENDING_TX_STORAGE_KEY);
          clearCheckoutSelection();
          removeCoupon();
          setState('paid');
          showToast('ACLEDA Bank payment confirmed! Your order is now processing.');
          void Promise.all([refreshCart(), refreshOrders()]);
          return;
        }

        if (data.status === 'failed' || data.status === 'expired') {
          finalizedRef.current = true;
          window.sessionStorage.removeItem(ACLEDA_PENDING_TX_STORAGE_KEY);
          setErrorMessage(
            data.failure_reason ||
              (data.status === 'expired'
                ? 'Your ACLEDA payment session timed out before confirmation.'
                : 'ACLEDA Bank reported that this payment was not completed.'),
          );
          setState('failed');
          return;
        }

        pollCountRef.current += 1;
        if (!isManual && pollCountRef.current >= MAX_AUTO_POLLS) {
          setState('pending_timeout');
        }
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : 'Unable to verify your ACLEDA Bank payment right now.';
        setErrorMessage(msg);
        if (isManual || pollCountRef.current >= MAX_AUTO_POLLS) {
          setState('failed');
        }
      } finally {
        inFlightRef.current = false;
        setCheckingManual(false);
      }
    },
    [transactionId, refreshCart, refreshOrders, removeCoupon, showToast],
  );

  useEffect(() => {
    if (!transactionId) return;
    const initialTimer = window.setTimeout(() => {
      void verifyWithBackend(false);
    }, 0);

    const timer = window.setInterval(() => {
      if (!finalizedRef.current && pollCountRef.current < MAX_AUTO_POLLS) {
        void verifyWithBackend(false);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [transactionId, verifyWithBackend]);

  const handleManualRecheck = () => {
    pollCountRef.current = 0;
    setCheckingManual(true);
    setState('verifying');
    void verifyWithBackend(true);
  };

  const targetOrderNumber =
    payment?.parent_order_number || payment?.order_number || null;

  return (
    <div className="kova-container px-2.5 sm:px-4 py-10 sm:py-16">
      <div className="max-w-[500px] mx-auto bg-white border border-[#ececec] rounded-[24px] p-5 sm:p-7 shadow-[0_14px_40px_rgba(0,0,0,0.06)] flex flex-col items-center text-center">
        {state === 'verifying' && (
          <>
            <div className="relative w-16 h-16 flex items-center justify-center">
              <span
                className="absolute inset-0 rounded-full border-[3px] border-[#ff6e20]/20 border-t-[#ff6e20] animate-spin"
                aria-hidden="true"
              />
              <AcledaBankIcon className="w-11 h-11" />
            </div>
            <span className="mt-4 px-3.5 py-1 rounded-full bg-[#ffefe6] text-[#ff6e20] text-[12px] font-semibold">
              ACLEDA Bank Verification
            </span>
            <h1 className="mt-3 text-[22px] font-bold text-[#111111]">
              Confirming Your Payment
            </h1>
            <p className="mt-2 text-[13.5px] text-[#767676] leading-relaxed max-w-[360px]">
              We&apos;re verifying your transaction directly with ACLEDA Bank.
              Please keep this page open for a moment.
            </p>
            {transactionId && (
              <p className="mt-4 text-[12px] font-mono text-[#8a8a8a] bg-[#f7f7f7] px-3.5 py-1.5 rounded-full">
                Ref: {transactionId}
              </p>
            )}
          </>
        )}

        {state === 'paid' && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#e7f6e7] flex items-center justify-center text-[#029500]">
              <FigmaIcon name="check" className="w-8 h-8" />
            </div>
            <span className="mt-4 px-3.5 py-1 rounded-full bg-[#e7f6e7] text-[#029500] text-[12px] font-semibold">
              Payment Successful
            </span>
            <h1 className="mt-3 text-[24px] font-bold text-[#111111]">
              Thank You for Your Order!
            </h1>
            <p className="mt-2 text-[13.5px] text-[#767676] leading-relaxed">
              Your ACLEDA Bank payment has been officially verified and your
              order is now being processed.
            </p>

            {payment && (
              <div className="mt-5 w-full rounded-[14px] bg-[#f7f7f7] border border-[#ececec] p-3.5 flex flex-col gap-2 text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#767676]">Amount Paid</span>
                  <span className="font-bold text-[#111111] tabular-nums">
                    {payment.currency === 'KHR'
                      ? `៛${Math.round(payment.amount).toLocaleString('en-US')}`
                      : `$${Number(payment.amount).toFixed(2)}`}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#767676]">Transaction ID</span>
                  <span className="font-mono text-[12px] text-[#333333] truncate max-w-[220px]">
                    {payment.transaction_id}
                  </span>
                </div>
                {targetOrderNumber && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#767676]">Order Number</span>
                    <span className="font-semibold text-[#ff6e20]">
                      #{targetOrderNumber}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 w-full flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    targetOrderNumber
                      ? `/account/orders?order=${encodeURIComponent(targetOrderNumber)}`
                      : '/account/orders',
                  )
                }
                className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[14px] font-semibold px-6 py-3 rounded-full transition-colors cursor-pointer"
              >
                View My Orders
              </button>
              <Link
                to="/products"
                className="bg-white border border-[#ececec] hover:border-black text-black text-[14px] font-semibold px-6 py-3 rounded-full transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          </>
        )}

        {state === 'pending_timeout' && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#ffefe6] flex items-center justify-center text-[#ff6e20]">
              <FigmaIcon name="clock" className="w-8 h-8" />
            </div>
            <span className="mt-4 px-3.5 py-1 rounded-full bg-[#ffefe6] text-[#ff6e20] text-[12px] font-semibold">
              Confirmation Pending
            </span>
            <h1 className="mt-3 text-[22px] font-bold text-[#111111]">
              Still Waiting for Bank Confirmation
            </h1>
            <p className="mt-2 text-[13.5px] text-[#767676] leading-relaxed">
              If you completed the transfer in ACLEDA Mobile, tap below to
              re-check the verified payment status with the server.
            </p>
            <div className="mt-6 w-full flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                type="button"
                disabled={checkingManual}
                onClick={handleManualRecheck}
                className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[14px] font-semibold px-6 py-3 rounded-full transition-colors cursor-pointer"
              >
                {checkingManual ? 'Checking...' : 'Check Status Again'}
              </button>
              <Link
                to="/account/orders"
                className="bg-white border border-[#ececec] hover:border-black text-black text-[14px] font-semibold px-6 py-3 rounded-full transition-colors"
              >
                Go to Orders
              </Link>
            </div>
          </>
        )}

        {state === 'failed' && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#fdecec] flex items-center justify-center text-[#e5322d]">
              <FigmaIcon name="x" className="w-8 h-8" />
            </div>
            <span className="mt-4 px-3.5 py-1 rounded-full bg-[#fdecec] text-[#e5322d] text-[12px] font-semibold">
              Payment Failed
            </span>
            <h1 className="mt-3 text-[22px] font-bold text-[#111111]">
              Payment Could Not Be Verified
            </h1>
            <p className="mt-2 text-[13.5px] text-[#767676] leading-relaxed">
              {errorMessage ||
                'Your ACLEDA Bank payment was cancelled or failed. No order has been marked as paid.'}
            </p>
            <div className="mt-6 w-full flex flex-col sm:flex-row gap-2.5 justify-center">
              <Link
                to="/checkout"
                className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[14px] font-semibold px-6 py-3 rounded-full transition-colors"
              >
                Return to Checkout
              </Link>
              <Link
                to="/account/orders"
                className="bg-white border border-[#ececec] hover:border-black text-black text-[14px] font-semibold px-6 py-3 rounded-full transition-colors"
              >
                View My Orders
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
