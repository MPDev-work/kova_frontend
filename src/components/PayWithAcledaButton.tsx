import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, checkoutApi } from '../services/api';
import { getMobilePlatform, useIsMobileOrTablet } from '../utils/device';
import type { AcledaPaymentData } from '../types/marketplace';

export const ACLEDA_PENDING_TX_STORAGE_KEY = 'kova_pending_acleda_tx';

const DEFAULT_IOS_STORE_URL =
  'https://apps.apple.com/kh/app/acleda-mobile/id1196285236';
const DEFAULT_ANDROID_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.domain.acledabankqr';

export function AcledaBankIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <img
      src="/assets/aceleda/aceleda.jpg"
      alt="ACLEDA Bank"
      className={`${className} rounded-full object-cover ring-1 ring-white/30 select-none pointer-events-none`}
      draggable={false}
    />
  );
}

export interface PreparedAcledaOrderInput {
  orderId: string;
  amount: number;
  currency: 'USD' | 'KHR';
  billNumber?: string | null;
  checkoutSessionToken?: string | null;
}

interface PayWithAcledaButtonProps {
  orderId?: string;
  amount?: number;
  currency?: 'USD' | 'KHR';
  billNumber?: string | null;
  checkoutSessionToken?: string | null;
  /**
   * Optional async hook used on CheckoutPage to create/prepare the checkout session
   * right before creating the ACLEDA deeplink payment.
   */
  onPreparePayment?: () => Promise<PreparedAcledaOrderInput | null>;
  onPaymentCreated?: (payment: AcledaPaymentData) => void;
  onPaymentVerified?: (payment: AcledaPaymentData) => void;
  onPaymentFailed?: (reason: string) => void;
  onFallbackToKhqr?: (qrString?: string | null) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  wrapperClassName?: string;
  compact?: boolean;
  showInlineFallback?: boolean;
}

export function PayWithAcledaButton({
  orderId,
  amount,
  currency = 'USD',
  billNumber,
  checkoutSessionToken,
  onPreparePayment,
  onPaymentCreated,
  onPaymentVerified,
  onPaymentFailed,
  onFallbackToKhqr,
  disabled = false,
  label = 'Pay with ACLEDA Bank',
  className = '',
  wrapperClassName = '',
  compact = false,
  showInlineFallback = true,
}: PayWithAcledaButtonProps) {
  // Strictly mobile & tablet only — never rendered on desktop devices
  const isMobileOrTablet = useIsMobileOrTablet();

  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<
    'idle' | 'launching' | 'verifying' | 'fallback' | 'paid' | 'failed'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activePayment, setActivePayment] = useState<AcledaPaymentData | null>(
    null,
  );

  // Ref lock prevents rapid double-taps before React state re-renders
  const inFlightRef = useRef(false);
  const pollingInFlightRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearFallbackTimer();
    };
  }, [clearFallbackTimer]);

  const pollPaymentStatus = useCallback(
    async (txId: string) => {
      if (!txId || pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;
      try {
        const res = await checkoutApi.checkAcledaStatus(txId);
        const status = res.data.status;

        if (status === 'successful') {
          window.sessionStorage.removeItem(ACLEDA_PENDING_TX_STORAGE_KEY);
          setActivePayment(res.data);
          setPhase('paid');
          setErrorMessage(null);
          onPaymentVerified?.(res.data);
          return;
        }

        if (status === 'failed' || status === 'expired') {
          window.sessionStorage.removeItem(ACLEDA_PENDING_TX_STORAGE_KEY);
          const reason =
            res.data.failure_reason ||
            (status === 'expired'
              ? 'ACLEDA payment session expired.'
              : 'ACLEDA payment was not completed.');
          setActivePayment(res.data);
          setPhase('failed');
          setErrorMessage(reason);
          onPaymentFailed?.(reason);
        }
      } catch {
        // Keep waiting quietly on transient mobile network switches
      } finally {
        pollingInFlightRef.current = false;
      }
    },
    [onPaymentFailed, onPaymentVerified],
  );

  // Poll backend verification automatically while awaiting return from ACLEDA Mobile
  useEffect(() => {
    if (
      !activePayment?.transaction_id ||
      (phase !== 'verifying' && phase !== 'fallback')
    ) {
      return;
    }

    let stopped = false;
    const txId = activePayment.transaction_id;

    const triggerCheck = () => {
      if (stopped || document.hidden) return;
      void pollPaymentStatus(txId);
    };

    const interval = window.setInterval(triggerCheck, 4000);
    const onFocus = () => {
      if (!stopped) void pollPaymentStatus(txId);
    };
    const onVisibility = () => {
      if (!stopped && !document.hidden) void pollPaymentStatus(txId);
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [activePayment?.transaction_id, phase, pollPaymentStatus]);

  const launchDeeplinkWithFallback = useCallback(
    (payment: AcledaPaymentData) => {
      clearFallbackTimer();
      setPhase('launching');

      let appOpened = false;

      const markAppOpened = () => {
        if (appOpened) return;
        appOpened = true;
        clearFallbackTimer();
        setPhase('verifying');
        cleanupListeners();
      };

      const onVisibilityChange = () => {
        if (document.hidden) {
          markAppOpened();
        }
      };

      const onPageHide = () => {
        markAppOpened();
      };

      const onBlur = () => {
        markAppOpened();
      };

      const cleanupListeners = () => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('pagehide', onPageHide);
        window.removeEventListener('blur', onBlur);
      };

      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('pagehide', onPageHide);
      window.addEventListener('blur', onBlur);

      // Persist pending transaction ID in case mobile OS reloads the browser on return
      try {
        window.sessionStorage.setItem(
          ACLEDA_PENDING_TX_STORAGE_KEY,
          JSON.stringify({
            transaction_id: payment.transaction_id,
            order_id: payment.order_id,
            bill_number: payment.bill_number ?? null,
            created_at: Date.now(),
          }),
        );
      } catch {
        // Ignore storage quota errors in private browsing
      }

      // Immediately trigger ACLEDA Mobile deeplink
      window.location.href = payment.deeplink;

      // 2-second fallback: if page is still visible, ACLEDA Mobile isn't installed or didn't open
      fallbackTimerRef.current = window.setTimeout(() => {
        cleanupListeners();
        if (!appOpened && !document.hidden) {
          setPhase('fallback');
          onFallbackToKhqr?.(payment.qr_string ?? null);
        }
      }, 2000);
    },
    [clearFallbackTimer, onFallbackToKhqr],
  );

  const handleClick = async () => {
    if (disabled || loading || inFlightRef.current || !isMobileOrTablet) {
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setErrorMessage(null);

    try {
      let targetOrderId = orderId;
      let targetAmount = amount;
      let targetCurrency: 'USD' | 'KHR' = currency;
      let targetBillNumber = billNumber;
      let targetSessionToken = checkoutSessionToken;

      if (onPreparePayment) {
        const prepared = await onPreparePayment();
        if (!prepared) {
          return;
        }
        targetOrderId = prepared.orderId;
        targetAmount = prepared.amount;
        targetCurrency = prepared.currency;
        targetBillNumber = prepared.billNumber ?? null;
        targetSessionToken = prepared.checkoutSessionToken ?? null;
      }

      if (!targetOrderId || !targetAmount || targetAmount <= 0) {
        setErrorMessage('Unable to start ACLEDA payment for this order.');
        setPhase('failed');
        return;
      }

      const returnUrl = `${window.location.origin}/checkout/acleda-return`;

      const res = await checkoutApi.createAcledaPayment({
        order_id: targetOrderId,
        amount: targetAmount,
        currency: targetCurrency,
        bill_number: targetBillNumber || undefined,
        checkout_session_token: targetSessionToken || undefined,
        return_url: returnUrl,
      });

      setActivePayment(res.data);
      onPaymentCreated?.(res.data);
      launchDeeplinkWithFallback(res.data);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Unable to open ACLEDA Bank right now. Please scan the KHQR code instead.';
      setErrorMessage(msg);
      setPhase('failed');
      onPaymentFailed?.(msg);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  if (!isMobileOrTablet) {
    return null;
  }

  const platform = getMobilePlatform();
  const iosUrl = activePayment?.store_links?.ios || DEFAULT_IOS_STORE_URL;
  const androidUrl =
    activePayment?.store_links?.android || DEFAULT_ANDROID_STORE_URL;
  const preferredStoreUrl = platform === 'ios' ? iosUrl : androidUrl;
  const preferredStoreLabel =
    platform === 'ios'
      ? 'Download on App Store'
      : platform === 'android'
        ? 'Get it on Google Play'
        : 'Download ACLEDA Mobile';

  return (
    <div className={`w-full flex flex-col gap-2.5 ${wrapperClassName}`}>
      <button
        type="button"
        disabled={disabled || loading || phase === 'launching'}
        onClick={() => void handleClick()}
        className={`relative w-full inline-flex items-center justify-center rounded-full bg-[#ff6e20] hover:bg-[#e85d12] active:bg-[#d9530c] disabled:opacity-60 text-white font-semibold whitespace-nowrap transition-colors cursor-pointer ${
          compact
            ? 'min-h-[44px] py-2.5 pl-11 pr-5 text-[13.5px]'
            : 'min-h-[46px] py-3 pl-12 pr-5 text-[14px]'
        } ${className}`}
      >
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center">
          {loading || phase === 'launching' ? (
            <span
              className="w-7 h-7 rounded-full border-2 border-white/35 border-t-white animate-spin"
              aria-hidden="true"
            />
          ) : (
            <AcledaBankIcon className="w-8 h-8" />
          )}
        </span>
        <span>
          {loading
            ? 'Preparing ACLEDA Bank...'
            : phase === 'launching'
              ? 'Opening ACLEDA Mobile...'
              : label}
        </span>
      </button>

      {showInlineFallback && phase === 'fallback' && activePayment && (
        <div className="rounded-[14px] bg-[#ffefe6] border border-[#ff6e20]/25 px-3.5 py-3 text-left flex flex-col gap-2">
          <p className="text-[12.5px] font-semibold text-[#111111]">
            ACLEDA Mobile didn&apos;t open automatically
          </p>
          <p className="text-[11.5px] text-[#666666] leading-relaxed">
            If the ACLEDA Mobile app isn&apos;t installed on this device, you
            can install it below or scan the KHQR code directly.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <a
              href={preferredStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[11.5px] font-semibold px-3.5 py-1.5 transition-colors"
            >
              {preferredStoreLabel}
            </a>
            <button
              type="button"
              onClick={() => launchDeeplinkWithFallback(activePayment)}
              className="rounded-full bg-white border border-[#ff6e20]/30 text-[#ff6e20] text-[11.5px] font-semibold px-3.5 py-1.5 transition-colors cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {showInlineFallback && phase === 'failed' && errorMessage && (
        <div className="rounded-[14px] bg-[#fdecec] border border-[#e5322d]/25 px-3.5 py-2.5 text-left">
          <p className="text-[12px] font-medium text-[#e5322d]">
            {errorMessage}
          </p>
        </div>
      )}
    </div>
  );
}
