import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { getUserDashboardPath } from '../utils/authRedirect';
import { FloatingSideDock } from './FloatingSideDock';
import { Header } from './Header';
import { Footer } from './Footer';

export function Layout() {
  const { isSignedIn, user } = useStore();
  const { pathname, search } = useLocation();
  const dashboardPath = isSignedIn ? getUserDashboardPath(user) : null;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, search]);

  // Never allow Root Admin or approved Store Owners to browse client storefront pages
  if (dashboardPath) {
    return <Navigate to={dashboardPath} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f5] text-black">
      <Header />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <Footer />
      <FloatingSideDock />
    </div>
  );
}
