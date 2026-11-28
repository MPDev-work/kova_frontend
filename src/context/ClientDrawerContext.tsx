import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CartDrawer } from '../components/CartDrawer';
import { CheckoutDrawer } from '../components/CheckoutDrawer';
import { MessagesDrawer } from '../components/MessagesDrawer';
import { NotificationModal } from '../components/NotificationModal';
import { WishlistDrawer } from '../components/WishlistDrawer';
import type { MessengerStartRequest } from '../components/MessengerWorkspace';

export type ClientDrawerType =
  | 'wishlist'
  | 'cart'
  | 'messages'
  | 'checkout'
  | 'notifications'
  | null;

export interface OpenMessagesOptions {
  chatId?: number | null;
  storeId?: number | null;
  orderId?: number | null;
  target?: 'support';
  toggle?: boolean;
}

interface ClientDrawerContextValue {
  activeDrawer: ClientDrawerType;
  openWishlist: (options?: { toggle?: boolean }) => void;
  openCart: (options?: { toggle?: boolean }) => void;
  openCheckout: (options?: { mode?: 'cart' | 'buy_now' }) => void;
  openMessages: (options?: OpenMessagesOptions) => void;
  openNotifications: (options?: { toggle?: boolean }) => void;
  closeDrawer: () => void;
}

const ClientDrawerContext = createContext<ClientDrawerContextValue | null>(
  null,
);

const DESKTOP_BREAKPOINT_QUERY = '(min-width: 768px)';

function isDesktopViewport(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia(DESKTOP_BREAKPOINT_QUERY).matches;
}

export function ClientDrawerProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeDrawer, setActiveDrawer] = useState<ClientDrawerType>(null);
  const [checkoutNonce, setCheckoutNonce] = useState(0);
  const [messageChatId, setMessageChatId] = useState<number | null>(null);
  const [messageStartRequest, setMessageStartRequest] =
    useState<MessengerStartRequest | null>(null);
  const startNonceRef = useRef(0);
  const prevPathRef = useRef(location.pathname);

  const closeDrawer = useCallback(() => {
    setActiveDrawer(null);
  }, []);

  // Close drawer smoothly whenever the user navigates to another route
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      const t = window.setTimeout(() => {
        setActiveDrawer(null);
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, [location.pathname]);

  // Keep mobile responsive experience untouched if viewport shrinks below md
  // (keep 'notifications' open since NotificationModal adapts into a mobile centered modal)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(DESKTOP_BREAKPOINT_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        setActiveDrawer((prev) =>
          prev === 'notifications' ? prev : null,
        );
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const openWishlist = useCallback(
    (options?: { toggle?: boolean }) => {
      if (!isDesktopViewport()) {
        navigate('/wishlist');
        return;
      }
      setActiveDrawer((prev) =>
        options?.toggle && prev === 'wishlist' ? null : 'wishlist',
      );
    },
    [navigate],
  );

  const openCart = useCallback(
    (options?: { toggle?: boolean }) => {
      if (!isDesktopViewport()) {
        navigate('/cart');
        return;
      }
      setActiveDrawer((prev) =>
        options?.toggle && prev === 'cart' ? null : 'cart',
      );
    },
    [navigate],
  );

  const openCheckout = useCallback(
    (options?: { mode?: 'cart' | 'buy_now' }) => {
      if (!isDesktopViewport()) {
        navigate(
          options?.mode === 'buy_now' ? '/checkout?mode=buy_now' : '/checkout',
        );
        return;
      }
      setCheckoutNonce((n) => n + 1);
      setActiveDrawer('checkout');
    },
    [navigate],
  );

  const openMessages = useCallback(
    (options?: OpenMessagesOptions) => {
      const hasStartTarget =
        Boolean(options?.storeId) || options?.target === 'support';

      if (!isDesktopViewport()) {
        if (hasStartTarget) {
          const params = new URLSearchParams();
          if (options?.storeId) params.set('storeId', String(options.storeId));
          if (options?.orderId) params.set('orderId', String(options.orderId));
          if (options?.target === 'support') params.set('target', 'support');
          navigate(`/help/contact?${params.toString()}`);
        } else if (options?.chatId) {
          navigate(`/help/tickets?chat=${options.chatId}`);
        } else {
          navigate('/help/tickets');
        }
        return;
      }

      if (
        options?.toggle &&
        !hasStartTarget &&
        !options?.chatId &&
        activeDrawer === 'messages'
      ) {
        setActiveDrawer(null);
        return;
      }

      if (hasStartTarget) {
        startNonceRef.current += 1;
        setMessageChatId(null);
        setMessageStartRequest({
          storeId: options?.storeId ?? null,
          orderId: options?.orderId ?? null,
          target: options?.target,
          nonce: startNonceRef.current,
        });
      } else {
        setMessageStartRequest(null);
        setMessageChatId(options?.chatId ?? null);
      }

      setActiveDrawer('messages');
    },
    [navigate, activeDrawer],
  );

  const openNotifications = useCallback(
    (options?: { toggle?: boolean }) => {
      setActiveDrawer((prev) =>
        options?.toggle && prev === 'notifications' ? null : 'notifications',
      );
    },
    [],
  );

  return (
    <ClientDrawerContext.Provider
      value={{
        activeDrawer,
        openWishlist,
        openCart,
        openCheckout,
        openMessages,
        openNotifications,
        closeDrawer,
      }}
    >
      {children}

      <WishlistDrawer
        open={activeDrawer === 'wishlist'}
        onClose={closeDrawer}
        onOpenCart={() => openCart()}
      />

      <CartDrawer
        open={activeDrawer === 'cart'}
        onClose={closeDrawer}
        onOpenWishlist={() => openWishlist()}
        onProceedToCheckout={() => openCheckout({ mode: 'cart' })}
      />

      <CheckoutDrawer
        open={activeDrawer === 'checkout'}
        openNonce={checkoutNonce}
        onClose={closeDrawer}
        onBackToCart={() => openCart()}
      />

      <MessagesDrawer
        open={activeDrawer === 'messages'}
        onClose={closeDrawer}
        initialChatId={messageChatId}
        startRequest={messageStartRequest}
      />

      <NotificationModal
        open={activeDrawer === 'notifications'}
        onClose={closeDrawer}
      />
    </ClientDrawerContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useClientDrawer(): ClientDrawerContextValue {
  const ctx = useContext(ClientDrawerContext);
  if (!ctx) {
    throw new Error(
      'useClientDrawer must be used inside <ClientDrawerProvider>',
    );
  }
  return ctx;
}
