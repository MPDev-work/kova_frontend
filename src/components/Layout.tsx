import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { FloatingSideDock } from './FloatingSideDock';
import { Header } from './Header';
import { Footer } from './Footer';

export function Layout() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, search]);

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
