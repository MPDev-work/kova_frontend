import { useEffect } from 'react';

let activeLockCount = 0;
let previousBodyOverflow = '';
let previousBodyPaddingRight = '';
let previousHtmlOverflow = '';

/**
 * Reference-counted scroll lock that prevents background page scrolling
 * while one or more modals are open (including stacked modals) and compensates
 * for scrollbar width to prevent horizontal layout shift.
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;

    if (activeLockCount === 0) {
      const body = document.body;
      const html = document.documentElement;
      const scrollbarWidth = window.innerWidth - html.clientWidth;

      previousBodyOverflow =
        body.style.overflow === 'hidden' ? '' : body.style.overflow;
      previousBodyPaddingRight = body.style.paddingRight;
      previousHtmlOverflow =
        html.style.overflow === 'hidden' ? '' : html.style.overflow;

      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    activeLockCount += 1;

    return () => {
      activeLockCount = Math.max(0, activeLockCount - 1);
      if (activeLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
        document.body.style.paddingRight = previousBodyPaddingRight;
        document.documentElement.style.overflow = previousHtmlOverflow;
      }
    };
  }, [locked]);
}
