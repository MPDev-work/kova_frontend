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
  wishlistApi,
} from '../services/api';
import { DEFAULT_KHR_RATE } from '../utils/currency';
import type {
  Address,
  AppliedCoupon,
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
  signOut: () => Promise<void>;
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
  deleteAccount: () => Promise<void>;

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

  // Wishlist & Recently Viewed
  wishlist: Product[];
  wishlistIds: number[];
  toggleWishlist: (productId: number) => Promise<void>;
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

function consumeUrlAuthToken(): boolean {
  try {
    const url = new URL(window.location.href);
    const token =
      url.searchParams.get('auth_token') ||
      (url.pathname === '/auth/google/callback'
        ? url.searchParams.get('token')
        : null);
    if (!token) return false;
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
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3400);
  }, []);

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

  const markNotificationRead = useCallback(async (id: number) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id && !n.read_at
          ? { ...n, read_at: new Date().toISOString() }
          : n,
      ),
    );
    setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
    try {
      await customerApi.markNotificationRead(id);
    } catch {
      // Ignore transient errors
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
    );
    setUnreadNotificationsCount(0);
    try {
      await customerApi.markAllNotificationsRead();
    } catch {
      // Ignore transient errors
    }
  }, []);

  const deleteNotification = useCallback(
    async (ids: number | number[]) => {
      const idList = Array.isArray(ids) ? ids : [ids];
      if (idList.length === 0) return;
      const idSet = new Set(idList);
      setNotifications((prev) => {
        const next = prev.filter((n) => !idSet.has(n.id));
        setUnreadNotificationsCount(next.filter((n) => !n.read_at).length);
        return next;
      });
      try {
        await Promise.all(
          idList.map((id) => customerApi.deleteNotification(id)),
        );
      } catch {
        void refreshNotifications(false);
      }
    },
    [refreshNotifications],
  );

  const clearAllNotifications = useCallback(async () => {
    setNotifications([]);
    setUnreadNotificationsCount(0);
    try {
      await customerApi.clearAllNotifications();
      showToast('All notifications cleared.');
    } catch {
      void refreshNotifications(false);
    }
  }, [refreshNotifications, showToast]);

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

  const loadAuthenticatedData = useCallback(async () => {
    const [wishRes, ordRes, addrRes, revRes, tckRes] = await Promise.allSettled(
      [
        wishlistApi.getWishlist(),
        orderApi.getOrders(30),
        customerApi.getAddresses(),
        customerApi.getMyReviews(),
        customerApi.getTickets(),
      ],
    );
    if (wishRes.status === 'fulfilled') setWishlist(wishRes.value);
    if (ordRes.status === 'fulfilled') setOrders(ordRes.value);
    if (addrRes.status === 'fulfilled') setAddresses(addrRes.value);
    if (revRes.status === 'fulfilled') setReviews(revRes.value);
    if (tckRes.status === 'fulfilled') setTickets(tckRes.value);
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
        catalogBootedRef.current = true;
        tasks.push(refreshCatalog());
      }

      if (!sessionBootedRef.current) {
        sessionBootedRef.current = true;
        const restoreSession = async () => {
          if (!token) {
            await refreshCart();
            return;
          }
          try {
            const meRes = await authApi.me();
            if (mounted) {
              setUser(meRes.data);
              if (fromGoogleOAuth) {
                try {
                  const syncedCart = await cartApi.syncGuestCart();
                  setCart(syncedCart);
                } catch {
                  await refreshCart();
                }
                await loadAuthenticatedData();
                showToast(`Signed in with Google as ${meRes.data.name}`);
              } else {
                await Promise.all([refreshCart(), loadAuthenticatedData()]);
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
    await afterAuthSuccess(
      res.data.user,
      res.data.token,
      `Welcome back, ${res.data.user.name}`,
    );
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

  const signOut = async () => {
    try {
      if (getAuthToken()) {
        await authApi.logout();
      }
    } catch {
      // ignore network error on logout
    }
    setAuthToken(null);
    setUser(null);
    setWishlist([]);
    setOrders([]);
    setAddresses([]);
    setReviews([]);
    setTickets([]);
    setAppliedCoupon(null);
    await refreshCart();
    showToast('Signed out.');
  };

  const updateProfile: StoreContextValue['updateProfile'] = async (patch) => {
    const res = await customerApi.updateProfile(patch);
    setUser((prev) => (prev ? { ...prev, ...res.data } : res.data));
    showToast('Profile updated.');
  };

  const uploadAvatar = async (file: File) => {
    const res = await customerApi.uploadAvatar(file);
    setUser((prev) => (prev ? { ...prev, avatar: res.data.avatar_url } : prev));
    showToast('Image uploaded successfully.');
  };

  const changePassword: StoreContextValue['changePassword'] = async (
    payload,
  ) => {
    await customerApi.changePassword(payload);
    showToast('Password updated.');
  };

  const deleteAccount = async () => {
    await customerApi.deleteAccount();
    setAuthToken(null);
    setUser(null);
    setCart(EMPTY_CART);
    setWishlist([]);
    setOrders([]);
    setAddresses([]);
    showToast('Your account has been deleted.');
  };

  const addToCart = async (
    productId: number,
    variantId?: number | null,
    quantity = 1,
  ): Promise<boolean> => {
    try {
      const updated = await cartApi.addItem({
        product_id: productId,
        variant_id: variantId ?? null,
        quantity,
      });
      setCart(updated);
      showToast('Added to cart.');
      return true;
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to add item to cart.',
      );
      return false;
    }
  };

  const updateCartQty = async (cartItemId: number, quantity: number) => {
    try {
      const updated = await cartApi.updateItem(cartItemId, quantity);
      setCart(updated);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to update quantity.',
      );
    }
  };

  const removeFromCart = async (cartItemId: number) => {
    try {
      const updated = await cartApi.removeItem(cartItemId);
      setCart(updated);
      showToast('Item removed from cart.');
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to remove item.',
      );
    }
  };

  const removeMultipleFromCart = async (cartItemIds: number[]) => {
    if (cartItemIds.length === 0) return;
    try {
      const updated = await cartApi.removeItems(cartItemIds);
      setCart(updated);
      showToast(
        cartItemIds.length === 1
          ? '1 item removed from cart.'
          : `${cartItemIds.length} items removed from cart.`,
      );
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to remove selected items.',
      );
    }
  };

  const clearCart = async () => {
    await cartApi.clearCart();
    setCart(EMPTY_CART);
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

  const toggleWishlist = async (productId: number) => {
    if (!user) {
      showToast('Please sign in to save items to your wishlist.');
      return;
    }
    try {
      const res = await wishlistApi.toggle(productId);
      const fresh = await wishlistApi.getWishlist();
      setWishlist(fresh);
      showToast(
        res.data.is_in_wishlist
          ? 'Saved to wishlist.'
          : 'Removed from wishlist.',
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to update wishlist.',
      );
    }
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
    const created = await customerApi.createAddress(addr);
    const all = await customerApi.getAddresses();
    setAddresses(all);
    showToast('Address saved.');
    return created;
  };

  const updateAddress = async (
    id: number,
    addr: Omit<Address, 'id'>,
  ): Promise<Address> => {
    const updated = await customerApi.updateAddress(id, addr);
    const all = await customerApi.getAddresses();
    setAddresses(all);
    showToast('Address updated.');
    return updated;
  };

  const setDefaultAddress = async (id: number) => {
    await customerApi.setDefaultAddress(id);
    const all = await customerApi.getAddresses();
    setAddresses(all);
    showToast('Default address updated.');
  };

  const deleteAddress = async (id: number) => {
    await customerApi.deleteAddress(id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    showToast('Address removed.');
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
    await customerApi.deleteReview(reviewId);
    setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    showToast('Review deleted.');
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
