import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  ApiError,
  authApi,
  cartApi,
  catalogApi,
  checkoutApi,
  customerApi,
  getAuthToken,
  getCachedUser,
  orderApi,
  setAuthToken,
  setCachedUser,
  toFriendlyErrorMessage,
  wishlistApi,
} from '../services/api';
import { DEFAULT_KHR_RATE } from '../utils/currency';
import {
  clearOfflineQueue,
  registerSyncToastHandler,
  runOptimisticMutation,
  subscribeSyncReconcile,
} from '../utils/optimisticSync';
import type {
  Address,
  AppliedCoupon,
  CartItem,
  CartStoreGroup,
  CartSummary,
  Category,
  ChatMessageMetadata,
  OrderRecord,
  PlatformSettings,
  Product,
  Promotion,
  Province,
  ReviewItem,
  Store,
  SupportTicket,
  UserNotificationItem,
  UserProfile,
} from '../types/marketplace';

interface NotificationPrefs {
  orderUpdates: boolean;
  flashSales: boolean;
  priceDrops: boolean;
  khqrVouchers: boolean;
  smsAlerts: boolean;
}

interface PrivacyPrefs {
  personalizedRecs: boolean;
  shareReviewsPublicly: boolean;
  browsingHistory: boolean;
}

export interface LoginChallenge {
  requires_verification: true;
  challenge_token: string;
  channel: 'email' | 'phone';
  masked_target: string;
  available_channels: ('email' | 'phone')[];
  expires_in_seconds: number;
}

export type LoginResult =
  | LoginChallenge
  | {
      requires_verification: false;
      user: UserProfile;
    };

interface StoreContextValue {
  bootstrapping: boolean;
  settings: PlatformSettings;
  khrRate: number;

  // Public Catalog
  categories: Category[];
  stores: Store[];
  products: Product[];
  promotions: Promotion[];
  provinces: Province[];
  refreshCatalog: () => Promise<void>;

  // Auth & Profile
  isSignedIn: boolean;
  user: UserProfile | null;
  login: (identifier: string, password: string) => Promise<LoginResult>;
  verifyLoginOtp: (
    challengeToken: string,
    code: string,
  ) => Promise<UserProfile>;
  resendLoginOtp: (
    challengeToken: string,
    channel?: 'email' | 'phone',
  ) => Promise<LoginChallenge>;
  register: (payload: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    password_confirmation: string;
    role?: 'customer' | 'store_owner';
    store_name?: string;
    store_description?: string;
    store_address?: string;
    province?: string;
    district?: string;
    commune?: string;
    google_maps_url?: string;
  }) => Promise<void>;
  refreshUser: () => Promise<void>;
  completeGoogleAuth: (token: string) => Promise<void>;
  signOut: (options?: { silent?: boolean }) => Promise<void>;
  updateProfile: (patch: {
    name?: string;
    phone?: string | null;
  }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  changePassword: (payload: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }) => Promise<void>;
  deactivateAccount: (code: string) => Promise<void>;
  deleteAccount: (code: string) => Promise<void>;

  // Cart & Coupons
  cart: CartSummary;
  cartCount: number;
  addToCart: (
    productId: number,
    variantId?: number | null,
    quantity?: number,
  ) => Promise<boolean>;
  updateCartQty: (cartItemId: number, quantity: number) => Promise<void>;
  removeFromCart: (cartItemId: number) => Promise<void>;
  removeMultipleFromCart: (cartItemIds: number[]) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  appliedCoupon: AppliedCoupon | null;
  couponDiscount: number;
  applyCoupon: (
    code: string,
    overrideTotals?: {
      totalAmount: number;
      storeSubtotals: Record<number, number>;
    },
  ) => Promise<{ ok: boolean; message: string }>;
  removeCoupon: () => void;

  // Wishlist, Following & Recently Viewed
  wishlist: Product[];
  wishlistIds: number[];
  toggleWishlist: (productId: number) => Promise<void>;
  followedStores: Store[];
  followedStoreIds: number[];
  refreshFollowing: () => Promise<void>;
  toggleFollowStore: (
    storeId: number,
  ) => Promise<{ is_following: boolean; followers_count: number } | null>;
  recentlyViewedIds: number[];
  trackProductView: (productId: number) => void;

  // Orders & Checkout
  orders: OrderRecord[];
  refreshOrders: () => Promise<void>;
  submitCheckout: (payload: {
    shipping_address: {
      full_name: string;
      phone: string;
      address_line_1: string;
      address_line_2?: string | null;
      province: string;
      district?: string | null;
      commune?: string | null;
      postal_code?: string | null;
    };
    payment_method: 'bakong_khqr' | 'cod';
    shipping_methods?: Record<number, number>;
    notes?: string;
    coupon_code?: string | null;
    cart_item_ids?: number[];
    buy_now_item?: {
      product_id: number;
      variant_id?: number | null;
      quantity: number;
    };
  }) => Promise<OrderRecord>;
  cancelOrder: (
    orderId: number,
    reason: string,
    restoreToCart?: boolean,
  ) => Promise<void>;

  // Addresses, Reviews & Tickets
  addresses: Address[];
  addAddress: (addr: Omit<Address, 'id'>) => Promise<Address>;
  updateAddress: (id: number, addr: Omit<Address, 'id'>) => Promise<Address>;
  setDefaultAddress: (id: number) => Promise<void>;
  deleteAddress: (id: number) => Promise<void>;

  reviews: ReviewItem[];
  refreshReviews: () => Promise<void>;
  addReview: (payload: {
    product_id: number;
    order_item_id?: number | null;
    rating: number;
    title?: string;
    comment: string;
  }) => Promise<void>;
  deleteReview: (reviewId: number) => Promise<void>;

  tickets: SupportTicket[];
  refreshTickets: () => Promise<void>;
  createTicket: (payload: {
    subject?: string;
    message?: string;
    attachments?: string[];
    priority?: 'low' | 'medium' | 'high';
    store_id?: number | null;
    order_id?: number | null;
  }) => Promise<SupportTicket>;
  replyTicket: (
    ticketId: number,
    message: string,
    attachments?: string[],
    metadata?: ChatMessageMetadata | null,
  ) => Promise<void>;

  // Live In-App Notifications
  notifications: UserNotificationItem[];
  unreadNotificationsCount: number;
  refreshNotifications: (silent?: boolean) => Promise<void>;
  markNotificationRead: (id: number) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  deleteNotification: (ids: number | number[]) => Promise<void>;
  clearAllNotifications: () => Promise<void>;

  // Preferences (persisted in localStorage)
  notifPrefs: NotificationPrefs;
  updateNotifPrefs: (patch: Partial<NotificationPrefs>) => void;
  privacyPrefs: PrivacyPrefs;
  updatePrivacyPrefs: (patch: Partial<PrivacyPrefs>) => void;

  toast: string | null;
  showToast: (msg: string) => void;
}

const EMPTY_CART: CartSummary = {
  cart_id: null,
  total_items: 0,
  total_amount: 0,
  stores: [],
};

const StoreContext = createContext<StoreContextValue | null>(null);

let consumedGoogleOAuthToken = false;

function consumeUrlAuthToken(): boolean {
  if (consumedGoogleOAuthToken) return true;
  try {
    const url = new URL(window.location.href);
    const token =
      url.searchParams.get('auth_token') ||
      (url.pathname === '/auth/google/callback'
        ? url.searchParams.get('token')
        : null);
    if (!token) return false;
    consumedGoogleOAuthToken = true;
    setAuthToken(token);
    url.searchParams.delete('auth_token');
    url.searchParams.delete('token');
    const cleanPath =
      url.pathname === '/auth/google/callback' ? '/' : url.pathname || '/';
    const cleanQuery = url.searchParams.toString();
    window.history.replaceState(
      {},
      '',
      cleanQuery ? `${cleanPath}?${cleanQuery}` : cleanPath,
    );
    return true;
  } catch {
    return false;
  }
}

function loadJsonPref<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [settings, setSettings] = useState<PlatformSettings>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);

  const [fromGoogleOAuth] = useState(() => consumeUrlAuthToken());
  const [user, setUser] = useState<UserProfile | null>(() => getCachedUser());
  const [cart, setCart] = useState<CartSummary>(EMPTY_CART);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(
    null,
  );
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [followedStores, setFollowedStores] = useState<Store[]>([]);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<number[]>(() => {
    try {
      const raw = window.localStorage.getItem('kova_recently_viewed');
      return raw ? (JSON.parse(raw) as number[]) : [];
    } catch {
      return [];
    }
  });

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(() =>
    loadJsonPref('kova_notif_prefs', {
      orderUpdates: true,
      flashSales: true,
      priceDrops: true,
      khqrVouchers: true,
      smsAlerts: false,
    }),
  );

  const [privacyPrefs, setPrivacyPrefs] = useState<PrivacyPrefs>(() =>
    loadJsonPref('kova_privacy_prefs', {
      personalizedRecs: true,
      shareReviewsPublicly: true,
      browsingHistory: true,
    }),
  );

  const [toast, setToast] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<UserNotificationItem[]>(
    [],
  );
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const lastSeenNotifIdRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    if (!msg || !msg.trim()) return;
    const friendly = toFriendlyErrorMessage(msg, 0);
    setToast(friendly);
    window.setTimeout(() => {
      setToast((prev) => (prev === friendly ? null : prev));
    }, 3800);
  }, []);

  useEffect(() => registerSyncToastHandler(showToast), [showToast]);

  const refreshNotifications = useCallback(
    async (silent = false) => {
      if (!getAuthToken()) {
        setNotifications([]);
        setUnreadNotificationsCount(0);
        lastSeenNotifIdRef.current = null;
        return;
      }
      try {
        const res = await customerApi.getNotifications(30);
        setNotifications(res.notifications);
        setUnreadNotificationsCount(res.unread_count);

        const newest = res.notifications[0];
        if (newest) {
          if (
            lastSeenNotifIdRef.current !== null &&
            newest.id > lastSeenNotifIdRef.current &&
            !newest.read_at &&
            silent
          ) {
            showToast(
              newest.body
                ? `${newest.title}: ${newest.body}`
                : newest.title,
            );
          }
          lastSeenNotifIdRef.current = Math.max(
            lastSeenNotifIdRef.current ?? 0,
            newest.id,
          );
        } else if (lastSeenNotifIdRef.current === null) {
          lastSeenNotifIdRef.current = 0;
        }
      } catch {
        // Keep existing notifications on transient errors
      }
    },
    [showToast],
  );

  const markNotificationRead = useCallback(
    async (id: number) => {
      const prevNotifications = notifications;
      const prevUnread = unreadNotificationsCount;
      void runOptimisticMutation({
        label: 'Mark notification read',
        applyOptimistic: () => {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === id && !n.read_at
                ? { ...n, read_at: new Date().toISOString() }
                : n,
            ),
          );
          setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
        },
        commit: () => customerApi.markNotificationRead(id),
        rollback: () => {
          setNotifications(prevNotifications);
          setUnreadNotificationsCount(prevUnread);
        },
        offlineRequest: {
          path: `/notifications/${id}/read`,
          method: 'POST',
          dedupeKey: `notif-read-${id}`,
        },
      });
    },
    [notifications, unreadNotificationsCount],
  );

  const markAllNotificationsRead = useCallback(async () => {
    const prevNotifications = notifications;
    const prevUnread = unreadNotificationsCount;
    void runOptimisticMutation({
      label: 'Mark all notifications read',
      applyOptimistic: () => {
        setNotifications((prev) =>
          prev.map((n) =>
            n.read_at ? n : { ...n, read_at: new Date().toISOString() },
          ),
        );
        setUnreadNotificationsCount(0);
      },
      commit: () => customerApi.markAllNotificationsRead(),
      rollback: () => {
        setNotifications(prevNotifications);
        setUnreadNotificationsCount(prevUnread);
      },
      offlineRequest: {
        path: '/notifications/read-all',
        method: 'POST',
        dedupeKey: 'notif-read-all',
      },
    });
  }, [notifications, unreadNotificationsCount]);

  const deleteNotification = useCallback(
    async (ids: number | number[]) => {
      const idList = Array.isArray(ids) ? ids : [ids];
      if (idList.length === 0) return;
      const idSet = new Set(idList);
      const prevNotifications = notifications;
      const prevUnread = unreadNotificationsCount;
      void runOptimisticMutation({
        label: 'Delete notification',
        applyOptimistic: () => {
          setNotifications((prev) => {
            const next = prev.filter((n) => !idSet.has(n.id));
            setUnreadNotificationsCount(next.filter((n) => !n.read_at).length);
            return next;
          });
        },
        commit: () =>
          Promise.all(idList.map((id) => customerApi.deleteNotification(id))),
        rollback: () => {
          setNotifications(prevNotifications);
          setUnreadNotificationsCount(prevUnread);
          void refreshNotifications(false);
        },
        offlineRequest:
          idList.length === 1
            ? {
                path: `/notifications/${idList[0]}`,
                method: 'DELETE',
              }
            : undefined,
      });
    },
    [notifications, unreadNotificationsCount, refreshNotifications],
  );

  const clearAllNotifications = useCallback(async () => {
    const prevNotifications = notifications;
    const prevUnread = unreadNotificationsCount;
    void runOptimisticMutation({
      label: 'Clear notifications',
      applyOptimistic: () => {
        setNotifications([]);
        setUnreadNotificationsCount(0);
      },
      commit: () => customerApi.clearAllNotifications(),
      rollback: () => {
        setNotifications(prevNotifications);
        setUnreadNotificationsCount(prevUnread);
        void refreshNotifications(false);
      },
      offlineRequest: {
        path: '/notifications',
        method: 'DELETE',
        dedupeKey: 'notif-clear-all',
      },
    });
  }, [notifications, unreadNotificationsCount, refreshNotifications]);

  const refreshCatalog = useCallback(async () => {
    const [
      settingsRes,
      catRes,
      storeRes,
      prodRes,
      promoRes,
      provRes,
    ] = await Promise.allSettled([
      catalogApi.getSettings(),
      catalogApi.getCategories(),
      catalogApi.getStores({ per_page: 50 }),
      catalogApi.getProducts({ per_page: 50 }),
      catalogApi.getPromotions(),
      catalogApi.getProvinces(),
    ]);

    if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value.data);
    if (catRes.status === 'fulfilled')
      setCategories(Array.isArray(catRes.value.data) ? catRes.value.data : []);
    if (storeRes.status === 'fulfilled') setStores(storeRes.value);
    if (prodRes.status === 'fulfilled') setProducts(prodRes.value.products);
    if (promoRes.status === 'fulfilled') setPromotions(promoRes.value);
    if (provRes.status === 'fulfilled')
      setProvinces(Array.isArray(provRes.value.data) ? provRes.value.data : []);
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      const summary = await cartApi.getCart();
      setCart(summary);
    } catch {
      setCart(EMPTY_CART);
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    if (!getAuthToken()) return;
    try {
      const list = await orderApi.getOrders(30);
      setOrders(list);
    } catch {
      setOrders([]);
    }
  }, []);

  const refreshReviews = useCallback(async () => {
    if (!getAuthToken()) return;
    try {
      const list = await customerApi.getMyReviews();
      setReviews(list);
    } catch {
      setReviews([]);
    }
  }, []);

  const refreshTickets = useCallback(async () => {
    if (!getAuthToken()) return;
    try {
      const list = await customerApi.getTickets();
      setTickets(list);
    } catch {
      setTickets([]);
    }
  }, []);

  const refreshFollowing = useCallback(async () => {
    if (!getAuthToken()) return;
    try {
      const list = await customerApi.getFollowingStores();
      setFollowedStores(list);
    } catch {
      setFollowedStores([]);
    }
  }, []);

  const loadAuthenticatedData = useCallback(async () => {
    const [wishRes, ordRes, addrRes, revRes, tckRes, followRes] =
      await Promise.allSettled([
        wishlistApi.getWishlist(),
        orderApi.getOrders(30),
        customerApi.getAddresses(),
        customerApi.getMyReviews(),
        customerApi.getTickets(),
        customerApi.getFollowingStores(),
      ]);
    if (wishRes.status === 'fulfilled') setWishlist(wishRes.value);
    if (ordRes.status === 'fulfilled') setOrders(ordRes.value);
    if (addrRes.status === 'fulfilled') setAddresses(addrRes.value);
    if (revRes.status === 'fulfilled') setReviews(revRes.value);
    if (tckRes.status === 'fulfilled') setTickets(tckRes.value);
    if (followRes.status === 'fulfilled') setFollowedStores(followRes.value);
  }, []);

  useEffect(() => {
    setCachedUser(user);
  }, [user]);

  // Initial fetch & live polling for real-time message notifications (Customer, Seller & Root Admin)
  useEffect(() => {
    if (!user) {
      lastSeenNotifIdRef.current = null;
      return;
    }
    const initTimer = window.setTimeout(() => {
      void refreshNotifications(false);
    }, 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshNotifications(true);
      }
    }, 8000);
    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(interval);
    };
  }, [user, refreshNotifications]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'kova_auth_token' && !e.newValue) {
        setUser(null);
        setWishlist([]);
        setOrders([]);
        setAddresses([]);
        setReviews([]);
        setTickets([]);
      } else if (e.key === 'kova_auth_user') {
        setUser(getCachedUser());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const location = useLocation();
  const isAuthRoute =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/reset-password';

  const catalogBootedRef = useRef(false);
  const sessionBootedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const token = getAuthToken();

      // Keep auth screens lean: do not fetch marketplace catalog, cart, or extra data while on /login or /register
      if (isAuthRoute) {
        if (token && !sessionBootedRef.current) {
          try {
            const meRes = await authApi.me();
            if (mounted) {
              setUser(meRes.data);
              sessionBootedRef.current = true;
            }
          } catch (err) {
            if (
              err instanceof ApiError &&
              (err.status === 401 || err.status === 403)
            ) {
              setAuthToken(null);
              if (mounted) setUser(null);
            }
          }
        }
        if (mounted) setBootstrapping(false);
        return;
      }

      const tasks: Promise<void>[] = [];

      if (!catalogBootedRef.current) {
        tasks.push(
          refreshCatalog().then(() => {
            if (mounted) catalogBootedRef.current = true;
          }),
        );
      }

      if (!sessionBootedRef.current) {
        const restoreSession = async () => {
          if (!token) {
            await refreshCart();
            if (mounted) sessionBootedRef.current = true;
            return;
          }
          try {
            const meRes = await authApi.me();
            if (mounted) {
              setUser(meRes.data);
              if (fromGoogleOAuth) {
                try {
                  const syncedCart = await cartApi.syncGuestCart();
                  if (mounted) setCart(syncedCart);
                } catch {
                  await refreshCart();
                }
                await loadAuthenticatedData();
                if (mounted) {
                  sessionBootedRef.current = true;
                  showToast(`Signed in with Google as ${meRes.data.name}`);
                }
              } else {
                await Promise.all([refreshCart(), loadAuthenticatedData()]);
                if (mounted) sessionBootedRef.current = true;
              }
            }
          } catch (err) {
            // Only clear persistent session when token is explicitly rejected (401/403).
            // Keep saved token intact on transient network/server errors.
            if (
              err instanceof ApiError &&
              (err.status === 401 || err.status === 403)
            ) {
              setAuthToken(null);
              if (mounted) {
                setUser(null);
                await refreshCart();
                sessionBootedRef.current = true;
              }
            }
          }
        };
        tasks.push(restoreSession());
      }

      if (tasks.length > 0) {
        await Promise.all(tasks);
      }

      if (mounted) setBootstrapping(false);
    };
    void init();
    return () => {
      mounted = false;
    };
  }, [
    isAuthRoute,
    refreshCatalog,
    refreshCart,
    loadAuthenticatedData,
    showToast,
    fromGoogleOAuth,
  ]);

  const afterAuthSuccess = useCallback(
    async (authedUser: UserProfile, token: string, message: string) => {
      setAuthToken(token);
      setUser(authedUser);
      sessionBootedRef.current = true;
      try {
        const syncedCart = await cartApi.syncGuestCart();
        setCart(syncedCart);
      } catch {
        await refreshCart();
      }
      await loadAuthenticatedData();
      showToast(message);
    },
    [refreshCart, loadAuthenticatedData, showToast],
  );

  const login: StoreContextValue['login'] = async (identifier, password) => {
    const res = await authApi.login({ identifier, password });
    if ('requires_verification' in res.data && res.data.requires_verification) {
      return res.data;
    }
    const authData = res.data as { user: UserProfile; token: string };
    await afterAuthSuccess(
      authData.user,
      authData.token,
      `Welcome back, ${authData.user.name}`,
    );
    return { requires_verification: false, user: authData.user };
  };

  const verifyLoginOtp: StoreContextValue['verifyLoginOtp'] = async (
    challengeToken,
    code,
  ) => {
    const res = await authApi.verifyLoginOtp({
      challenge_token: challengeToken,
      code,
    });
    const welcomeMsg =
      res.message && res.message !== 'Login successful.'
        ? res.message
        : `Welcome back, ${res.data.user.name}`;
    await afterAuthSuccess(res.data.user, res.data.token, welcomeMsg);
    return res.data.user;
  };

  const resendLoginOtp: StoreContextValue['resendLoginOtp'] = async (
    challengeToken,
    channel,
  ) => {
    const res = await authApi.resendLoginOtp({
      challenge_token: challengeToken,
      channel,
    });
    showToast(res.message || 'Verification code sent.');
    return res.data;
  };

  const register: StoreContextValue['register'] = async (payload) => {
    const res = await authApi.register({
      ...payload,
      role: payload.role || 'customer',
    });
    await afterAuthSuccess(
      res.data.user,
      res.data.token,
      payload.role === 'store_owner'
        ? `Seller account created! Store "${payload.store_name}" submitted for review.`
        : `Welcome to Kova, ${res.data.user.name}`,
    );
  };

  const refreshUser = useCallback(async () => {
    if (!getAuthToken()) return;
    try {
      const meRes = await authApi.me();
      setUser(meRes.data);
    } catch {
      // ignore
    }
  }, []);

  // Automatically check approval status for customers with a pending store application
  // so they switch smoothly to Seller Center as soon as Admin approves.
  const hasPendingStore = user?.store?.status === 'pending';
  useEffect(() => {
    if (!hasPendingStore) return;
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshUser();
      }
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshUser();
      }
    }, 15000);
    return () => {
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
      window.clearInterval(interval);
    };
  }, [hasPendingStore, refreshUser]);

  const completeGoogleAuth = useCallback(
    async (token: string) => {
      setAuthToken(token);
      const meRes = await authApi.me();
      await afterAuthSuccess(
        meRes.data,
        token,
        `Signed in with Google as ${meRes.data.name}`,
      );
    },
    [afterAuthSuccess],
  );

  const signOut = async (options?: { silent?: boolean }) => {
    try {
      if (getAuthToken()) {
        await authApi.logout();
      }
    } catch {
      // ignore network error on logout
    }
    setAuthToken(null);
    clearOfflineQueue();
    setUser(null);
    setWishlist([]);
    setFollowedStores([]);
    setOrders([]);
    setAddresses([]);
    setReviews([]);
    setTickets([]);
    setAppliedCoupon(null);
    await refreshCart();
    if (!options?.silent) {
      showToast('Signed out.');
    }
  };

  const recalculateCart = (
    groups: CartStoreGroup[],
    cartId: number | null,
  ): CartSummary => {
    const cleaned = groups
      .map((g) => {
        const nextItems = g.items.filter((i) => i.quantity > 0);
        const storeSubtotal = nextItems.reduce(
          (sum, i) => sum + Number(i.subtotal || i.unit_price * i.quantity),
          0,
        );
        return {
          ...g,
          items: nextItems,
          store_subtotal: Number(storeSubtotal.toFixed(2)),
          all_free_shipping:
            nextItems.length > 0 &&
            nextItems.every((i) => Boolean(i.free_shipping)),
        };
      })
      .filter((g) => g.items.length > 0);

    const totalItems = cleaned.reduce(
      (sum, g) => sum + g.items.reduce((s, i) => s + i.quantity, 0),
      0,
    );
    const totalAmount = cleaned.reduce((sum, g) => sum + g.store_subtotal, 0);
    return {
      cart_id: cartId,
      total_items: totalItems,
      total_amount: Number(totalAmount.toFixed(2)),
      stores: cleaned,
    };
  };

  // Automatically reconcile global state whenever queued offline mutations finish syncing
  useEffect(() => {
    return subscribeSyncReconcile(() => {
      void refreshCart();
      if (getAuthToken()) {
        void refreshUser();
        void refreshFollowing();
        void refreshNotifications(false);
        void customerApi
          .getAddresses()
          .then(setAddresses)
          .catch(() => {});
        void wishlistApi
          .getWishlist()
          .then(setWishlist)
          .catch(() => {});
      }
    });
  }, [refreshCart, refreshUser, refreshFollowing, refreshNotifications]);

  const updateProfile: StoreContextValue['updateProfile'] = async (patch) => {
    const prevUser = user;
    showToast('Profile updated.');
    void runOptimisticMutation({
      label: 'Update profile',
      applyOptimistic: () => {
        setUser((prev) => (prev ? { ...prev, ...patch } : prev));
      },
      commit: () => customerApi.updateProfile(patch),
      onSuccess: (res) => {
        setUser((prev) => (prev ? { ...prev, ...res.data } : res.data));
      },
      rollback: () => {
        setUser(prevUser);
      },
      offlineRequest: {
        path: '/customer/profile',
        method: 'PUT',
        body: patch,
        dedupeKey: 'customer-profile-update',
      },
      onToast: showToast,
      errorToast: (err) =>
        err instanceof ApiError ? err.message : 'Unable to update profile.',
    });
  };

  const uploadAvatar = async (file: File) => {
    const prevAvatar = user?.avatar ?? null;
    const localPreviewUrl = URL.createObjectURL(file);
    showToast('Updating avatar...');
    void runOptimisticMutation({
      label: 'Upload avatar',
      applyOptimistic: () => {
        setUser((prev) => (prev ? { ...prev, avatar: localPreviewUrl } : prev));
      },
      commit: () => customerApi.uploadAvatar(file),
      onSuccess: (res) => {
        URL.revokeObjectURL(localPreviewUrl);
        setUser((prev) =>
          prev ? { ...prev, avatar: res.data.avatar_url } : prev,
        );
      },
      rollback: () => {
        URL.revokeObjectURL(localPreviewUrl);
        setUser((prev) => (prev ? { ...prev, avatar: prevAvatar } : prev));
      },
      onToast: showToast,
      successToast: 'Image uploaded successfully.',
      errorToast: (err) =>
        err instanceof ApiError
          ? err.message
          : 'Image upload failed. Please try again.',
    });
  };

  const changePassword: StoreContextValue['changePassword'] = async (
    payload,
  ) => {
    await customerApi.changePassword(payload);
    showToast('Password updated.');
  };

  const deactivateAccount = async (code: string) => {
    const res = await customerApi.deactivateAccount(code);
    setAuthToken(null);
    clearOfflineQueue();
    setUser(null);
    setCart(EMPTY_CART);
    setWishlist([]);
    setFollowedStores([]);
    setOrders([]);
    setAddresses([]);
    setReviews([]);
    setTickets([]);
    setAppliedCoupon(null);
    showToast(
      res.message ||
        'Your account has been deactivated. Sign back in anytime to reactivate.',
    );
  };

  const deleteAccount = async (code: string) => {
    const res = await customerApi.deleteAccount(code);
    setAuthToken(null);
    clearOfflineQueue();
    setUser(null);
    setCart(EMPTY_CART);
    setWishlist([]);
    setFollowedStores([]);
    setOrders([]);
    setAddresses([]);
    setReviews([]);
    setTickets([]);
    setAppliedCoupon(null);
    showToast(
      res.message ||
        'Your account is scheduled for permanent deletion in 30 days. Sign back in within 30 days to cancel.',
    );
  };

  const addToCart = async (
    productId: number,
    variantId?: number | null,
    quantity = 1,
  ): Promise<boolean> => {
    const prevCart = cart;
    const normalizedVariantId = variantId ?? null;
    const catalogProduct = products.find((p) => p.id === productId) ?? null;

    showToast('Added to cart.');
    void runOptimisticMutation({
      label: 'Add to cart',
      applyOptimistic: () => {
        setCart((curr) => {
          let matched = false;
          const updatedStores = curr.stores.map((group) => ({
            ...group,
            items: group.items.map((item) => {
              if (
                item.product_id === productId &&
                (item.variant_id ?? null) === normalizedVariantId
              ) {
                matched = true;
                const nextQty = item.quantity + quantity;
                return {
                  ...item,
                  quantity: nextQty,
                  subtotal: Number((item.unit_price * nextQty).toFixed(2)),
                };
              }
              return item;
            }),
          }));

          if (matched) {
            return recalculateCart(updatedStores, curr.cart_id);
          }

          if (!catalogProduct) {
            return {
              ...curr,
              total_items: curr.total_items + quantity,
            };
          }

          const variant = normalizedVariantId
            ? catalogProduct.variants.find((v) => v.id === normalizedVariantId)
            : null;
          const unitPrice = Number(variant?.price ?? catalogProduct.price);
          const optimisticItem: CartItem = {
            id: -Date.now(),
            product_id: catalogProduct.id,
            product_name: catalogProduct.name,
            product_slug: catalogProduct.slug,
            product_image: catalogProduct.image,
            variant_id: normalizedVariantId,
            variant_name: variant?.name ?? null,
            unit_price: unitPrice,
            quantity,
            subtotal: Number((unitPrice * quantity).toFixed(2)),
            stock_available:
              variant?.stock_quantity ?? catalogProduct.stock_quantity,
            free_shipping: catalogProduct.free_shipping,
          };

          const existingGroupIdx = updatedStores.findIndex(
            (g) => g.store.id === catalogProduct.store_id,
          );
          if (existingGroupIdx >= 0) {
            updatedStores[existingGroupIdx] = {
              ...updatedStores[existingGroupIdx],
              items: [...updatedStores[existingGroupIdx].items, optimisticItem],
            };
          } else {
            updatedStores.push({
              store: {
                id: catalogProduct.store_id,
                name: catalogProduct.store_name,
                slug: catalogProduct.store_slug,
                logo: catalogProduct.store_logo,
              },
              items: [optimisticItem],
              store_subtotal: optimisticItem.subtotal,
              all_free_shipping: Boolean(catalogProduct.free_shipping),
            });
          }

          return recalculateCart(updatedStores, curr.cart_id);
        });
      },
      commit: () =>
        cartApi.addItem({
          product_id: productId,
          variant_id: normalizedVariantId,
          quantity,
        }),
      onSuccess: (updated) => {
        setCart(updated);
      },
      rollback: () => {
        setCart(prevCart);
      },
      offlineRequest: {
        path: '/cart',
        method: 'POST',
        body: {
          product_id: productId,
          variant_id: normalizedVariantId,
          quantity,
        },
      },
      onReconcileAfterOffline: () => {
        void refreshCart();
      },
      onToast: showToast,
      errorToast: (err) =>
        err instanceof ApiError ? err.message : 'Unable to add item to cart.',
    });
    return true;
  };

  const updateCartQty = async (cartItemId: number, quantity: number) => {
    const prevCart = cart;
    void runOptimisticMutation({
      label: 'Update cart quantity',
      applyOptimistic: () => {
        setCart((curr) => {
          const nextStores = curr.stores.map((group) => ({
            ...group,
            items: group.items.map((item) =>
              item.id === cartItemId
                ? {
                    ...item,
                    quantity,
                    subtotal: Number((item.unit_price * quantity).toFixed(2)),
                  }
                : item,
            ),
          }));
          return recalculateCart(nextStores, curr.cart_id);
        });
      },
      commit: () => cartApi.updateItem(cartItemId, quantity),
      onSuccess: (updated) => {
        setCart(updated);
      },
      rollback: () => {
        setCart(prevCart);
      },
      offlineRequest:
        cartItemId > 0
          ? {
              path: `/cart/${cartItemId}`,
              method: 'PUT',
              body: { quantity },
              dedupeKey: `cart-qty-${cartItemId}`,
            }
          : undefined,
      onReconcileAfterOffline: () => {
        void refreshCart();
      },
      onToast: showToast,
      errorToast: (err) =>
        err instanceof ApiError ? err.message : 'Unable to update quantity.',
    });
  };

  const removeFromCart = async (cartItemId: number) => {
    const prevCart = cart;
    showToast('Item removed from cart.');
    void runOptimisticMutation({
      label: 'Remove cart item',
      applyOptimistic: () => {
        setCart((curr) => {
          const nextStores = curr.stores.map((group) => ({
            ...group,
            items: group.items.filter((item) => item.id !== cartItemId),
          }));
          return recalculateCart(nextStores, curr.cart_id);
        });
      },
      commit: () => cartApi.removeItem(cartItemId),
      onSuccess: (updated) => {
        setCart(updated);
      },
      rollback: () => {
        setCart(prevCart);
      },
      offlineRequest:
        cartItemId > 0
          ? {
              path: `/cart/${cartItemId}`,
              method: 'DELETE',
            }
          : undefined,
      onReconcileAfterOffline: () => {
        void refreshCart();
      },
      onToast: showToast,
      errorToast: (err) =>
        err instanceof ApiError ? err.message : 'Unable to remove item.',
    });
  };

  const removeMultipleFromCart = async (cartItemIds: number[]) => {
    if (cartItemIds.length === 0) return;
    const prevCart = cart;
    const idSet = new Set(cartItemIds);
    showToast(
      cartItemIds.length === 1
        ? '1 item removed from cart.'
        : `${cartItemIds.length} items removed from cart.`,
    );
    void runOptimisticMutation({
      label: 'Remove selected cart items',
      applyOptimistic: () => {
        setCart((curr) => {
          const nextStores = curr.stores.map((group) => ({
            ...group,
            items: group.items.filter((item) => !idSet.has(item.id)),
          }));
          return recalculateCart(nextStores, curr.cart_id);
        });
      },
      commit: () => cartApi.removeItems(cartItemIds),
      onSuccess: (updated) => {
        setCart(updated);
      },
      rollback: () => {
        setCart(prevCart);
      },
      offlineRequest: {
        path: '/cart/bulk-delete',
        method: 'POST',
        body: { item_ids: cartItemIds },
      },
      onReconcileAfterOffline: () => {
        void refreshCart();
      },
      onToast: showToast,
      errorToast: (err) =>
        err instanceof ApiError
          ? err.message
          : 'Unable to remove selected items.',
    });
  };

  const clearCart = async () => {
    const prevCart = cart;
    void runOptimisticMutation({
      label: 'Clear cart',
      applyOptimistic: () => {
        setCart(EMPTY_CART);
      },
      commit: () => cartApi.clearCart(),
      rollback: () => {
        setCart(prevCart);
      },
      offlineRequest: {
        path: '/cart',
        method: 'DELETE',
        dedupeKey: 'cart-clear',
      },
      onReconcileAfterOffline: () => {
        void refreshCart();
      },
      onToast: showToast,
      errorToast: (err) =>
        err instanceof ApiError ? err.message : 'Unable to clear cart.',
    });
  };

  const applyCoupon: StoreContextValue['applyCoupon'] = async (
    code,
    overrideTotals,
  ) => {
    try {
      let totalAmount: number | undefined;
      let storeSubtotals: Record<number, number> | undefined;

      if (overrideTotals) {
        totalAmount = overrideTotals.totalAmount;
        storeSubtotals = overrideTotals.storeSubtotals;
      } else if (cart.stores.length > 0) {
        const subMap: Record<number, number> = {};
        cart.stores.forEach((g) => {
          subMap[g.store.id] = g.store_subtotal;
        });
        totalAmount = cart.total_amount;
        storeSubtotals = subMap;
      }

      const res = await catalogApi.validateCoupon(
        code,
        totalAmount,
        storeSubtotals,
      );
      setAppliedCoupon(res.data);
      showToast(res.message || `Voucher ${res.data.code} applied.`);
      return { ok: true, message: res.message || 'Voucher applied.' };
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Invalid voucher code.';
      showToast(msg);
      return { ok: false, message: msg };
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    showToast('Voucher removed.');
  };

  const couponEligibleSubtotal = (() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.store_id) {
      const targetGroup = cart.stores.find(
        (g) => g.store.id === appliedCoupon.store_id,
      );
      return targetGroup ? Number(targetGroup.store_subtotal || 0) : 0;
    }
    return Number(cart.total_amount || 0);
  })();

  const isCouponEligibleForCart = (() => {
    if (!appliedCoupon) return false;
    if (appliedCoupon.store_id) {
      const targetGroup = cart.stores.find(
        (g) => g.store.id === appliedCoupon.store_id,
      );
      if (!targetGroup) return false;
      if (
        appliedCoupon.min_order_amount &&
        targetGroup.store_subtotal < appliedCoupon.min_order_amount
      ) {
        return false;
      }
      return true;
    }
    if (cart.stores.length === 0) return false;
    if (
      appliedCoupon.min_order_amount &&
      cart.total_amount < appliedCoupon.min_order_amount
    ) {
      return false;
    }
    return true;
  })();

  const couponDiscount = (() => {
    if (!appliedCoupon || !isCouponEligibleForCart) return 0;
    if (appliedCoupon.discount_type === 'free_shipping') return 0;
    let d = 0;
    if (appliedCoupon.discount_type === 'percentage') {
      d = (couponEligibleSubtotal * appliedCoupon.discount_value) / 100;
    } else if (appliedCoupon.discount_type === 'fixed_amount') {
      d = appliedCoupon.discount_value;
    }
    if (
      appliedCoupon.max_discount_amount &&
      appliedCoupon.max_discount_amount > 0
    ) {
      d = Math.min(d, appliedCoupon.max_discount_amount);
    }
    return Math.min(d, couponEligibleSubtotal);
  })();

  const toggleFollowStore = async (storeId: number) => {
    if (!user) {
      showToast('Please sign in to follow stores.');
      return null;
    }
    const currentlyFollowing = followedStores.some((s) => s.id === storeId);
    const nextFollowing = !currentlyFollowing;
    const prevStores = stores;
    const prevFollowed = followedStores;
    const targetStore =
      stores.find((s) => s.id === storeId) ||
      followedStores.find((s) => s.id === storeId);
    const currentCount = Number(targetStore?.followers_count ?? 0);
    const optimisticCount = Math.max(0, currentCount + (nextFollowing ? 1 : -1));

    showToast(nextFollowing ? 'Store followed.' : 'Store unfollowed.');
    void runOptimisticMutation({
      label: nextFollowing ? 'Follow store' : 'Unfollow store',
      applyOptimistic: () => {
        setStores((prev) =>
          prev.map((s) =>
            s.id === storeId
              ? {
                  ...s,
                  is_following: nextFollowing,
                  followers_count: optimisticCount,
                }
              : s,
          ),
        );
        setFollowedStores((prev) => {
          if (!nextFollowing) {
            return prev.filter((s) => s.id !== storeId);
          }
          if (prev.some((s) => s.id === storeId)) {
            return prev.map((s) =>
              s.id === storeId
                ? {
                    ...s,
                    is_following: true,
                    followers_count: optimisticCount,
                  }
                : s,
            );
          }
          return targetStore
            ? [
                {
                  ...targetStore,
                  is_following: true,
                  followers_count: optimisticCount,
                },
                ...prev,
              ]
            : prev;
        });
      },
      commit: () =>
        nextFollowing
          ? customerApi.followStore(storeId)
          : customerApi.unfollowStore(storeId),
      onSuccess: (res) => {
        const { is_following, followers_count } = res.data;
        setStores((prev) =>
          prev.map((s) =>
            s.id === storeId ? { ...s, is_following, followers_count } : s,
          ),
        );
        void customerApi
          .getFollowingStores()
          .then((fresh) => {
            setFollowedStores(fresh);
          })
          .catch(() => {
            if (!is_following) {
              setFollowedStores((prev) => prev.filter((s) => s.id !== storeId));
            }
          });
      },
      rollback: () => {
        setStores(prevStores);
        setFollowedStores(prevFollowed);
      },
      offlineRequest: {
        path: `/stores/${storeId}/follow`,
        method: nextFollowing ? 'POST' : 'DELETE',
        dedupeKey: `follow-store-${storeId}`,
      },
      onReconcileAfterOffline: () => {
        void refreshFollowing();
      },
      onToast: showToast,
      errorToast: (err) =>
        err instanceof ApiError
          ? err.message
          : 'Unable to update follow status.',
    });

    return { is_following: nextFollowing, followers_count: optimisticCount };
  };

  const toggleWishlist = async (productId: number) => {
    if (!user) {
      showToast('Please sign in to save items to your wishlist.');
      return;
    }
    const prevWishlist = wishlist;
    const isCurrentlySaved = wishlist.some((p) => p.id === productId);
    const nextSaved = !isCurrentlySaved;
    const catalogProduct = products.find((p) => p.id === productId) ?? null;

    showToast(nextSaved ? 'Saved to wishlist.' : 'Removed from wishlist.');
    void runOptimisticMutation({
      label: nextSaved ? 'Save to wishlist' : 'Remove from wishlist',
      applyOptimistic: () => {
        setWishlist((prev) => {
          if (!nextSaved) {
            return prev.filter((p) => p.id !== productId);
          }
          if (prev.some((p) => p.id === productId)) return prev;
          return catalogProduct ? [catalogProduct, ...prev] : prev;
        });
      },
      commit: () => wishlistApi.toggle(productId),
      onSuccess: () => {
        void wishlistApi
          .getWishlist()
          .then(setWishlist)
          .catch(() => {});
      },
      rollback: () => {
        setWishlist(prevWishlist);
      },
      offlineRequest: {
        path: '/wishlist/toggle',
        method: 'POST',
        body: { product_id: productId },
      },
      onReconcileAfterOffline: () => {
        void wishlistApi
          .getWishlist()
          .then(setWishlist)
          .catch(() => {});
      },
      onToast: showToast,
      errorToast: (err) =>
        err instanceof ApiError ? err.message : 'Unable to update wishlist.',
    });
  };

  const trackProductView = useCallback((productId: number) => {
    setRecentlyViewedIds((prev) => {
      const next = [productId, ...prev.filter((id) => id !== productId)].slice(
        0,
        16,
      );
      window.localStorage.setItem('kova_recently_viewed', JSON.stringify(next));
      return next;
    });
  }, []);

  const addAddress = async (addr: Omit<Address, 'id'>): Promise<Address> => {
    const prevAddresses = addresses;
    const tempAddress: Address = {
      ...addr,
      id: -Date.now(),
    };
    showToast('Address saved.');
    void runOptimisticMutation({
      label: 'Save address',
      applyOptimistic: () => {
        setAddresses((prev) => {
          const base = addr.is_default
            ? prev.map((a) => ({ ...a, is_default: false }))
            : prev;
          return [tempAddress, ...base];
        });
      },
      commit: () => customerApi.createAddress(addr),
      onSuccess: () => {
        void customerApi
          .getAddresses()
          .then(setAddresses)
          .catch(() => {});
      },
      rollback: () => {
        setAddresses(prevAddresses);
      },
      offlineRequest: {
        path: '/customer/addresses',
        method: 'POST',
        body: addr,
      },
      onReconcileAfterOffline: () => {
        void customerApi
          .getAddresses()
          .then(setAddresses)
          .catch(() => {});
      },
      onToast: showToast,
      errorToast: (err) =>
        err instanceof ApiError
          ? err.message
          : 'We could not save this address right now.',
    });
    return tempAddress;
  };

  const updateAddress = async (
    id: number,
    addr: Omit<Address, 'id'>,
  ): Promise<Address> => {
    const prevAddresses = addresses;
    const optimistic: Address = { ...addr, id };
    showToast('Address updated.');
    void runOptimisticMutation({
      label: 'Update address',
      applyOptimistic: () => {
        setAddresses((prev) =>
          prev.map((a) => {
            if (a.id === id) return optimistic;
            return addr.is_default ? { ...a, is_default: false } : a;
          }),
        );
      },
      commit: () => customerApi.updateAddress(id, addr),
      onSuccess: () => {
        void customerApi
          .getAddresses()
          .then(setAddresses)
          .catch(() => {});
      },
      rollback: () => {
        setAddresses(prevAddresses);
      },
      offlineRequest:
        id > 0
          ? {
              path: `/customer/addresses/${id}`,
              method: 'PUT',
              body: addr,
              dedupeKey: `address-update-${id}`,
            }
          : undefined,
      onReconcileAfterOffline: () => {
        void customerApi
          .getAddresses()
          .then(setAddresses)
          .catch(() => {});
      },
      onToast: showToast,
      errorToast: (err) =>
        err instanceof ApiError
          ? err.message
          : 'We could not update this address right now.',
    });
    return optimistic;
  };

  const setDefaultAddress = async (id: number) => {
    const prevAddresses = addresses;
    showToast('Default address updated.');
    void runOptimisticMutation({
      label: 'Set default address',
      applyOptimistic: () => {
        setAddresses((prev) =>
          prev.map((a) => ({ ...a, is_default: a.id === id })),
        );
      },
      commit: () => customerApi.setDefaultAddress(id),
      onSuccess: () => {
        void customerApi
          .getAddresses()
          .then(setAddresses)
          .catch(() => {});
      },
      rollback: () => {
        setAddresses(prevAddresses);
      },
      offlineRequest:
        id > 0
          ? {
              path: `/customer/addresses/${id}/default`,
              method: 'PATCH',
              dedupeKey: 'address-default',
            }
          : undefined,
      onReconcileAfterOffline: () => {
        void customerApi
          .getAddresses()
          .then(setAddresses)
          .catch(() => {});
      },
      onToast: showToast,
      errorToast: (err) =>
        err instanceof ApiError
          ? err.message
          : 'Unable to update default address.',
    });
  };

  const deleteAddress = async (id: number) => {
    const prevAddresses = addresses;
    showToast('Address removed.');
    void runOptimisticMutation({
      label: 'Delete address',
      applyOptimistic: () => {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
      },
      commit: () => customerApi.deleteAddress(id),
      rollback: () => {
        setAddresses(prevAddresses);
      },
      offlineRequest:
        id > 0
          ? {
              path: `/customer/addresses/${id}`,
              method: 'DELETE',
            }
          : undefined,
      onReconcileAfterOffline: () => {
        void customerApi
          .getAddresses()
          .then(setAddresses)
          .catch(() => {});
      },
      onToast: showToast,
      errorToast: (err) =>
        err instanceof ApiError ? err.message : 'Unable to remove address.',
    });
  };

  const submitCheckout: StoreContextValue['submitCheckout'] = async (
    payload,
  ) => {
    const resolvedCouponCode =
      payload.coupon_code !== undefined
        ? payload.coupon_code
        : appliedCoupon && isCouponEligibleForCart
          ? appliedCoupon.code
          : null;

    const order = await checkoutApi.checkout({
      ...payload,
      coupon_code: resolvedCouponCode,
    });
    // Keep cart intact for Bakong KHQR until payment actually completes;
    // for non-KHQR selective/buy-now checkouts refresh cart so unselected items remain.
    if (payload.payment_method !== 'bakong_khqr') {
      if (payload.buy_now_item || payload.cart_item_ids) {
        await refreshCart();
      } else {
        setCart(EMPTY_CART);
      }
      setAppliedCoupon(null);
    }
    if (order.id > 0) {
      await refreshOrders();
    }
    return order;
  };

  const cancelOrder = async (
    orderId: number,
    reason: string,
    restoreToCart = false,
  ) => {
    const res = await orderApi.cancelOrder(orderId, reason, restoreToCart);
    if (restoreToCart) {
      if (res.data?.cart) {
        setCart(res.data.cart);
      } else {
        await refreshCart();
      }
      await refreshOrders();
      showToast(
        'Payment cancelled. Your items have been moved back to your cart.',
      );
      return;
    }
    await refreshOrders();
    showToast('Order cancelled.');
  };

  const addReview: StoreContextValue['addReview'] = async (payload) => {
    await customerApi.createReview(payload);
    await refreshReviews();
    showToast('Review published.');
  };

  const deleteReview: StoreContextValue['deleteReview'] = async (reviewId) => {
    const prevReviews = reviews;
    showToast('Review deleted.');
    void runOptimisticMutation({
      label: 'Delete review',
      applyOptimistic: () => {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      },
      commit: () => customerApi.deleteReview(reviewId),
      rollback: () => {
        setReviews(prevReviews);
      },
      offlineRequest: {
        path: `/reviews/${reviewId}`,
        method: 'DELETE',
      },
      onToast: showToast,
      errorToast: (err) =>
        err instanceof ApiError ? err.message : 'Unable to delete review.',
    });
  };

  const createTicket: StoreContextValue['createTicket'] = async (payload) => {
    const created = await customerApi.createTicket(payload);
    await refreshTickets();
    showToast('Message sent.');
    return created;
  };

  const replyTicket = async (
    ticketId: number,
    message: string,
    attachments?: string[],
    metadata?: ChatMessageMetadata | null,
  ) => {
    await customerApi.replyTicket(ticketId, message, attachments, metadata);
    await refreshTickets();
    showToast('Reply sent.');
  };

  const updateNotifPrefs = (patch: Partial<NotificationPrefs>) => {
    setNotifPrefs((prev) => {
      const next = { ...prev, ...patch };
      window.localStorage.setItem('kova_notif_prefs', JSON.stringify(next));
      return next;
    });
    showToast('Notification preferences updated.');
  };

  const updatePrivacyPrefs = (patch: Partial<PrivacyPrefs>) => {
    setPrivacyPrefs((prev) => {
      const next = { ...prev, ...patch };
      window.localStorage.setItem('kova_privacy_prefs', JSON.stringify(next));
      return next;
    });
    showToast('Privacy settings updated.');
  };

  const khrRate =
    Number(settings.khr_exchange_rate ?? settings.exchange_rate_khr) ||
    DEFAULT_KHR_RATE;

  return (
    <StoreContext.Provider
      value={{
        bootstrapping,
        settings,
        khrRate,
        categories,
        stores,
        products,
        promotions,
        provinces,
        refreshCatalog,
        isSignedIn: Boolean(user),
        user,
        login,
        verifyLoginOtp,
        resendLoginOtp,
        register,
        refreshUser,
        completeGoogleAuth,
        signOut,
        updateProfile,
        uploadAvatar,
        changePassword,
        deactivateAccount,
        deleteAccount,
        cart,
        cartCount: cart.total_items,
        addToCart,
        updateCartQty,
        removeFromCart,
        removeMultipleFromCart,
        clearCart,
        refreshCart,
        appliedCoupon,
        couponDiscount,
        applyCoupon,
        removeCoupon,
        wishlist,
        wishlistIds: wishlist.map((p) => p.id),
        toggleWishlist,
        followedStores,
        followedStoreIds: followedStores.map((s) => s.id),
        refreshFollowing,
        toggleFollowStore,
        recentlyViewedIds,
        trackProductView,
        orders,
        refreshOrders,
        submitCheckout,
        cancelOrder,
        addresses,
        addAddress,
        updateAddress,
        setDefaultAddress,
        deleteAddress,
        reviews,
        refreshReviews,
        addReview,
        deleteReview,
        tickets,
        refreshTickets,
        createTicket,
        replyTicket,
        notifications: user ? notifications : [],
        unreadNotificationsCount: user ? unreadNotificationsCount : 0,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        deleteNotification,
        clearAllNotifications,
        notifPrefs,
        updateNotifPrefs,
        privacyPrefs,
        updatePrivacyPrefs,
        toast,
        showToast,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
