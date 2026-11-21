import { useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { StoreProvider, useStore } from './context/StoreContext';
import { getUserDashboardPath } from './utils/authRedirect';
import { Layout } from './components/Layout';
import { CustomerSettingsLayout } from './components/CustomerSettingsLayout';
import { HomePage } from './pages/client/HomePage';
import { CatalogPage } from './pages/client/CatalogPage';
import { PromotionPage } from './pages/client/PromotionPage';
import { FreeDeliveryPage } from './pages/client/FreeDeliveryPage';
import { ProductDetailPage } from './pages/client/ProductDetailPage';
import { VerifiedStoresPage } from './pages/client/VerifiedStoresPage';
import { StorefrontPage } from './pages/client/StorefrontPage';
import { CartPage } from './pages/client/CartPage';
import { CheckoutPage } from './pages/client/CheckoutPage';
import { WishlistPage } from './pages/client/WishlistPage';
import { NotificationsPage } from './pages/client/NotificationsPage';
import {
  CancelOrderPage,
  MyOrdersPage,
  OrderDetailsPage,
} from './pages/client/OrdersPage';
import {
  AccountSecurityPage,
  AddAddressPage,
  AddressBookPage,
  ChangePasswordPage,
  DeleteAccountPage,
  EditAddressPage,
  MyProfilePage,
  MyReviewsPage,
  NotificationPrefsPage,
  PrivacySettingsPage,
  RecentlyViewedPage,
  WriteReviewPage,
} from './pages/client/AccountPages';
import {
  ContactSupportPage,
  HelpCenterPage,
  SupportTicketsPage,
  TicketDetailPage,
} from './pages/client/SupportPages';
import {
  LoginPage,
  RegisterPage,
  VerificationFlowPage,
} from './pages/client/AuthPages';
import { AboutPage } from './pages/client/AboutPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import {
  AdminOverviewPage,
  AdminStoresPage,
} from './pages/admin/AdminOverviewAndStoresPages';
import {
  AdminAuditLogsPage,
  AdminBakongPage,
  AdminCatalogPage,
  AdminDisputesPage,
  AdminSettingsPage,
  AdminUsersPage,
} from './pages/admin/AdminManagementPages';
import { SellerLayout } from './pages/seller/SellerLayout';
import {
  SellerInventoryPage,
  SellerOverviewPage,
  SellerProductFormPage,
  SellerProductsPage,
} from './pages/seller/SellerOverviewAndCatalogPages';
import {
  SellerBakongPage,
  SellerOrdersPage,
  SellerPayoutsPage,
  SellerPromotionsPage,
  SellerShippingPage,
  SellerStorefrontPage,
} from './pages/seller/SellerOperationsPages';

function LegacyOrderRedirect({ suffix = '' }: { suffix?: string }) {
  const { orderId } = useParams<{ orderId: string }>();
  return <Navigate to={`/account/orders/${orderId}${suffix}`} replace />;
}

function RoleNavigationGate() {
  const { bootstrapping, isSignedIn, user } = useStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const dashboardPath = getUserDashboardPath(user);
    const path = location.pathname;

    // Redirect authenticated users away from auth screens to their workspace
    if (path === '/login' || path === '/register') {
      navigate(dashboardPath ?? '/', { replace: true });
      return;
    }

    // Automatically route Root Admin & Store Owner from root landing page to their dashboard
    // unless they explicitly clicked the "Marketplace" storefront link.
    if (path === '/' && dashboardPath) {
      const state = location.state as { allowStorefront?: boolean } | null;
      const allowBrowse =
        Boolean(state?.allowStorefront) ||
        new URLSearchParams(location.search).has('browse');
      if (!allowBrowse) {
        navigate(dashboardPath, { replace: true });
      }
    }
  }, [
    bootstrapping,
    isSignedIn,
    user,
    location.pathname,
    location.search,
    location.state,
    navigate,
  ]);

  return null;
}

function GlobalToast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-black text-white px-5 py-3 rounded-full shadow-2xl text-[13.5px] font-medium flex items-center gap-2 border border-white/10">
      <span className="w-2 h-2 rounded-full bg-[#ff6e20]" />
      {toast}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <RoleNavigationGate />
        <Routes>
          {/* Storefront Shell */}
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<CatalogPage mode="all" />} />
            <Route path="/promotion" element={<PromotionPage />} />
            <Route path="/free-delivery" element={<FreeDeliveryPage />} />
            <Route path="/product/:slug" element={<ProductDetailPage />} />
            <Route path="/stores" element={<VerifiedStoresPage />} />
            <Route path="/store/:slug" element={<StorefrontPage />} />

            {/* Standalone Cart, Checkout, Wishlist & Notifications */}
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />

            {/* Help & Support */}
            <Route path="/help" element={<HelpCenterPage />} />
            <Route path="/help/contact" element={<ContactSupportPage />} />
            <Route path="/help/tickets" element={<SupportTicketsPage />} />
            <Route
              path="/help/tickets/:ticketId"
              element={<TicketDetailPage />}
            />

            {/* Info & Seller Application */}
            <Route path="/about" element={<AboutPage mode="about" />} />
            <Route
              path="/become-a-seller"
              element={<AboutPage mode="seller" />}
            />
          </Route>

          {/* Standalone Authentication Pages (no navbar or footer) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/forgot-password"
            element={<VerificationFlowPage mode="forgot" />}
          />
          <Route
            path="/reset-password"
            element={<VerificationFlowPage mode="reset" />}
          />

          {/* Persistent Customer Settings Workspace (only <Outlet /> swaps on navigation) */}
          <Route path="/account" element={<CustomerSettingsLayout />}>
            <Route
              index
              element={<Navigate to="/account/profile" replace />}
            />
            <Route path="profile" element={<MyProfilePage />} />
            <Route path="orders" element={<MyOrdersPage />} />
            <Route path="orders/:orderId" element={<OrderDetailsPage />} />
            <Route
              path="orders/:orderId/cancel"
              element={<CancelOrderPage />}
            />
            <Route path="addresses" element={<AddressBookPage />} />
            <Route path="addresses/new" element={<AddAddressPage />} />
            <Route
              path="addresses/:addressId/edit"
              element={<EditAddressPage />}
            />
            <Route path="recently-viewed" element={<RecentlyViewedPage />} />
            <Route path="reviews" element={<MyReviewsPage />} />
            <Route path="reviews/write" element={<WriteReviewPage />} />
            <Route
              path="notification-preferences"
              element={<NotificationPrefsPage />}
            />
            <Route path="privacy" element={<PrivacySettingsPage />} />
            <Route path="security" element={<AccountSecurityPage />} />
            <Route path="password" element={<ChangePasswordPage />} />
            <Route path="delete" element={<DeleteAccountPage />} />
          </Route>

          {/* Persistent Root Admin Dashboard (only <Outlet /> swaps) */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="stores" element={<AdminStoresPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="catalog" element={<AdminCatalogPage />} />
            <Route path="bakong" element={<AdminBakongPage />} />
            <Route path="disputes" element={<AdminDisputesPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          </Route>

          {/* Persistent Store Owner Dashboard (only <Outlet /> swaps) */}
          <Route path="/seller" element={<SellerLayout />}>
            <Route index element={<SellerOverviewPage />} />
            <Route path="products" element={<SellerProductsPage />} />
            <Route path="products/new" element={<SellerProductFormPage />} />
            <Route
              path="products/:productId/edit"
              element={<SellerProductFormPage />}
            />
            <Route path="inventory" element={<SellerInventoryPage />} />
            <Route path="orders" element={<SellerOrdersPage />} />
            <Route path="shipping" element={<SellerShippingPage />} />
            <Route path="promotions" element={<SellerPromotionsPage />} />
            <Route path="bakong" element={<SellerBakongPage />} />
            <Route path="payouts" element={<SellerPayoutsPage />} />
            <Route path="storefront" element={<SellerStorefrontPage />} />
          </Route>

          {/* Legacy Redirects */}
          <Route
            path="/account/wishlist"
            element={<Navigate to="/wishlist" replace />}
          />
          <Route
            path="/account/notifications"
            element={<Navigate to="/notifications" replace />}
          />
          <Route
            path="/orders"
            element={<Navigate to="/account/orders" replace />}
          />
          <Route path="/orders/:orderId" element={<LegacyOrderRedirect />} />
          <Route
            path="/orders/:orderId/cancel"
            element={<LegacyOrderRedirect suffix="/cancel" />}
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <GlobalToast />
      </BrowserRouter>
    </StoreProvider>
  );
}
