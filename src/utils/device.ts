import { useEffect, useState } from 'react';

const MOBILE_OR_TABLET_UA_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|PlayBook|Silk|Kindle/i;

/**
 * Returns true strictly on mobile phones and tablets (including iPadOS in desktop UA mode
 * and responsive mobile/tablet viewports <= 1024px). Returns false on desktop computers.
 */
export function isMobileOrTabletDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent || '';
  if (MOBILE_OR_TABLET_UA_PATTERN.test(ua)) {
    return true;
  }

  // iPadOS 13+ Safari identifies as Macintosh but exposes multi-touch points
  const isIpadOs =
    navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
  if (isIpadOs) {
    return true;
  }

  // Coarse pointer touchscreen devices (phones / tablets)
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches &&
    (navigator.maxTouchPoints ?? 0) > 0
  ) {
    return true;
  }

  // Standard mobile & tablet viewport width ceiling (<= 1024px)
  return window.innerWidth <= 1024;
}

export function getMobilePlatform(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  const isIpadOs =
    navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;

  if (/iPhone|iPad|iPod/i.test(ua) || isIpadOs) {
    return 'ios';
  }
  if (/Android/i.test(ua)) {
    return 'android';
  }
  return 'other';
}

/**
 * Reactive hook that resolves true only on mobile and tablet devices.
 */
export function useIsMobileOrTablet(): boolean {
  const [isMobileOrTablet, setIsMobileOrTablet] = useState<boolean>(() =>
    isMobileOrTabletDevice(),
  );

  useEffect(() => {
    const update = () => setIsMobileOrTablet(isMobileOrTabletDevice());
    update();

    const widthQuery = window.matchMedia('(max-width: 1024px)');
    const pointerQuery = window.matchMedia('(pointer: coarse)');

    window.addEventListener('resize', update);
    widthQuery.addEventListener?.('change', update);
    pointerQuery.addEventListener?.('change', update);

    return () => {
      window.removeEventListener('resize', update);
      widthQuery.removeEventListener?.('change', update);
      pointerQuery.removeEventListener?.('change', update);
    };
  }, []);

  return isMobileOrTablet;
}
