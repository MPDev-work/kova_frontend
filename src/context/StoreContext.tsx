import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
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
  Brand,
  CartSummary,
  Category,
  OrderRecord,
  PlatformSettings,
  Product,
  Promotion,
  Province,
  ReviewItem,
  Store,
  SupportTicket,
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

interface StoreContextValue {
  bootstrapping: boolean;
  settings: PlatformSettings;
  khrRate: number;

  // Public Catalog
  categories: Category[];
  brands: Brand[];
  stores: Store[];
  products: Product[];
  promotions: Promotion[];
  provinces: Province[];
  refreshCatalog: () => Promise<void>;

  // Auth & Profile
  isSignedIn: boolean;
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<UserProfile>;
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
  }) => Promise<void>;
  refreshUser: () => Promise<void>;
  completeGoogleAuth: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: { name?: string; phone?: string | null }) => Promise<void>;
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
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  appliedCoupon: AppliedCoupon | null;
  couponDiscount: number;
  applyCoupon: (code: string) => Promise<{ ok: boolean; message: string }>;
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
  }) => Promise<OrderRecord>;
  cancelOrder: (orderId: number, reason: string) => Promise<void>;

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
    rating: number;
    title?: string;
    comment: string;
  }) => Promise<void>;

  tickets: SupportTicket[];
  refreshTickets: () => Promise<void>;
  createTicket: (payload: {
    subject: string;
    message: string;
    priority?: 'low' | 'medium' | 'high';
  }) => Promise<SupportTicket>;
  replyTicket: (ticketId: number, message: string) => Promise<void>;

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
  const [brands, setBrands] = useState<Brand[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);

  const [fromGoogleOAuth] = useState(() => consumeUrlAuthToken());
  const [user, setUser] = useState<UserProfile | null>(() => getCachedUser());
  const [cart, setCart] = useState<CartSummary>(EMPTY_CART);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
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

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3400);
  }, []);

  const refreshCatalog = useCallback(async () => {
    const [
      settingsRes,
      catRes,
      brandRes,
      storeRes,
      prodRes,
      promoRes,
      provRes,
    ] = await Promise.allSettled([
      catalogApi.getSettings(),
      catalogApi.getCategories(),
      catalogApi.getBrands(),
      catalogApi.getStores({ per_page: 50 }),
      catalogApi.getProducts({ per_page: 50 }),
      catalogApi.getPromotions(),
      catalogApi.getProvinces(),
    ]);

    if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value.data);
    if (catRes.status === 'fulfilled')
      setCategories(
        Array.isArray(catRes.value.data) ? catRes.value.data : [],
      );
    if (brandRes.status === 'fulfilled')
      setBrands(Array.isArray(brandRes.value.data) ? brandRes.value.data : []);
    if (storeRes.status === 'fulfilled') setStores(storeRes.value);
    if (prodRes.status === 'fulfilled') setProducts(prodRes.value.products);
    if (promoRes.status === 'fulfilled') setPromotions(promoRes.value);
    if (provRes.status === 'fulfilled')
      setProvinces(
        Array.isArray(provRes.value.data) ? provRes.value.data : [],
      );
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

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const token = getAuthToken();

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
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            setAuthToken(null);
            if (mounted) {
              setUser(null);
              await refreshCart();
            }
          }
        }
      };

      await Promise.all([refreshCatalog(), restoreSession()]);

      if (mounted) setBootstrapping(false);
    };
    void init();
    return () => {
      mounted = false;
    };
  }, [refreshCatalog, refreshCart, loadAuthenticatedData, showToast, fromGoogleOAuth]);

  const afterAuthSuccess = useCallback(
    async (authedUser: UserProfile, token: string, message: string) => {
      setAuthToken(token);
      setUser(authedUser);
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

  const login = async (email: string, password: string): Promise<UserProfile> => {
    const res = await authApi.login({ email, password });
    await afterAuthSuccess(
      res.data.user,
      res.data.token,
      `Welcome back, ${res.data.user.name}`,
    );
    return res.data.user;
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
    setUser((prev) =>
      prev ? { ...prev, avatar: res.data.avatar_url } : prev,
    );
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

  const clearCart = async () => {
    await cartApi.clearCart();
    setCart(EMPTY_CART);
  };

  const applyCoupon = async (
    code: string,
  ): Promise<{ ok: boolean; message: string }> => {
    try {
      const res = await catalogApi.validateCoupon(code, cart.total_amount);
      setAppliedCoupon(res.data);
      showToast(res.message || `Voucher ${res.data.code} applied.`);
      return { ok: true, message: res.message || 'Voucher applied.' };
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Invalid voucher code.';
      return { ok: false, message: msg };
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    showToast('Voucher removed.');
  };

  const couponDiscount = (() => {
    if (!appliedCoupon) return 0;
    let d = 0;
    if (appliedCoupon.discount_type === 'percentage') {
      d = (cart.total_amount * appliedCoupon.discount_value) / 100;
    } else if (appliedCoupon.discount_type === 'fixed_amount') {
      d = appliedCoupon.discount_value;
    }
    if (
      appliedCoupon.max_discount_amount &&
      appliedCoupon.max_discount_amount > 0
    ) {
      d = Math.min(d, appliedCoupon.max_discount_amount);
    }
    return Math.min(d, cart.total_amount);
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
    const order = await checkoutApi.checkout({
      ...payload,
      coupon_code: appliedCoupon?.code || null,
    });
    setCart(EMPTY_CART);
    setAppliedCoupon(null);
    await refreshOrders();
    return order;
  };

  const cancelOrder = async (orderId: number, reason: string) => {
    await orderApi.cancelOrder(orderId, reason);
    await refreshOrders();
    showToast('Order cancelled.');
  };

  const addReview: StoreContextValue['addReview'] = async (payload) => {
    await customerApi.createReview(payload);
    await refreshReviews();
    showToast('Review published.');
  };

  const createTicket: StoreContextValue['createTicket'] = async (payload) => {
    const created = await customerApi.createTicket(payload);
    await refreshTickets();
    showToast(`Support ticket ${created.ticket_number} created.`);
    return created;
  };

  const replyTicket = async (ticketId: number, message: string) => {
    await customerApi.replyTicket(ticketId, message);
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
        brands,
        stores,
        products,
        promotions,
        provinces,
        refreshCatalog,
        isSignedIn: Boolean(user),
        user,
        login,
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
        tickets,
        refreshTickets,
        createTicket,
        replyTicket,
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
