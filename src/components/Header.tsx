import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { getAuthToken } from '../services/api';
import { FigmaIcon } from './FigmaIcon';
import { KovaLogo } from './KovaLogo';
import { ProfilePillSkeleton } from './Skeleton';
import { VerifiedBadge } from './VerifiedBadge';

export function Header() {
  const {
    bootstrapping,
    isSignedIn,
    user,
    products,
    cartCount,
    wishlistIds,
    signOut,
  } = useStore();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const matchedProducts = query.trim()
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.brand_name.toLowerCase().includes(query.toLowerCase()) ||
            p.category_name.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 5)
    : [];

  const handleSearch = (term?: string) => {
    const value = (term ?? query).trim();
    setShowSuggestions(false);
    if (value) {
      setQuery(value);
      navigate(`/products?q=${encodeURIComponent(value)}`);
    } else {
      navigate('/products');
    }
  };

  const initials = (user?.name || 'U')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-[12px] border-b border-[#dfdfe7]">
      <div className="kova-container px-4 lg:px-5 py-2.5 flex flex-col gap-3">
        {/* Top Row */}
        <div className="flex items-center justify-between gap-4">
          <KovaLogo linkState={{ allowStorefront: true }} />

          {/* Search Bar */}
          <div ref={searchRef} className="relative flex-1 max-w-[640px]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }}
              className="flex items-center h-[42px] rounded-full border border-[#ff6e20] bg-white pl-4 pr-[3px] focus-within:ring-2 focus-within:ring-[#ff6e20]/20"
            >
              <input
                type="text"
                value={query}
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                placeholder="Search products, brands, or stores..."
                className="flex-1 bg-transparent text-[14px] text-black placeholder:text-[#ababab] tracking-[-0.28px] outline-none min-w-0"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 text-[#979797] hover:text-black mr-1"
                  aria-label="Clear search"
                >
                  <FigmaIcon name="x" className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                aria-label="Search"
                className="h-[36px] w-[76px] rounded-full bg-[#ff6e20] hover:bg-[#e85d12] transition-colors flex items-center justify-center shrink-0 text-white"
              >
                <FigmaIcon name="search" className="w-4 h-4 text-white" />
              </button>
            </form>

            {/* Live Search Suggestions Dropdown */}
            {showSuggestions && query.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-[48px] bg-white border border-[#ececec] rounded-[20px] shadow-xl p-4 z-50">
                {matchedProducts.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[12px] text-[#767676] px-2">
                      <span>Matching products</span>
                      <button
                        type="button"
                        onClick={() => handleSearch()}
                        className="text-[#ff6e20] font-semibold hover:underline"
                      >
                        View all results
                      </button>
                    </div>
                    {matchedProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setShowSuggestions(false);
                          navigate(`/product/${p.slug}`);
                        }}
                        className="flex items-center gap-3 p-2 rounded-[14px] hover:bg-[#f7f7f7] text-left transition-colors"
                      >
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-10 h-10 rounded-[10px] object-cover shrink-0 border border-[#ececec]"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-[10px] bg-[#f7f7f7] border border-[#ececec] shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13.5px] font-medium text-black truncate">
                            {p.name}
                          </p>
                          <p className="text-[11.5px] text-[#767676] truncate">
                            {p.store_name}
                          </p>
                        </div>
                        <span className="text-[14px] font-bold text-[#ff6e20] shrink-0">
                          ${p.price.toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-[#767676] px-2 py-1">
                    Press Enter to search “{query}”
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right Icons & Profile / Guest Auth */}
          <div className="flex items-center gap-5 lg:gap-[26px] shrink-0">
            <div className="flex items-center gap-5 lg:gap-[26px]">
              <Link
                to="/wishlist"
                className="relative inline-flex items-center justify-center text-black hover:text-[#ff6e20] transition-colors"
                aria-label="Wishlist"
              >
                <FigmaIcon name="heart" className="w-6 h-6" />
                {!bootstrapping && isSignedIn && wishlistIds.length > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6e20] text-white text-[11px] leading-none flex items-center justify-center font-medium">
                    {wishlistIds.length}
                  </span>
                )}
              </Link>

              <Link
                to="/notifications"
                className="relative inline-flex items-center justify-center text-black hover:text-[#ff6e20] transition-colors"
                aria-label="Notifications"
              >
                <FigmaIcon name="bell" className="w-[23px] h-[23px]" />
              </Link>

              <Link
                to="/cart"
                className="relative inline-flex items-center justify-center text-black hover:text-[#ff6e20] transition-colors"
                aria-label="Shopping cart"
              >
                <FigmaIcon name="shopping-cart" className="w-6 h-6" />
                {!bootstrapping && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6e20] text-white text-[11px] leading-none flex items-center justify-center font-medium">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>

            <div className="hidden sm:block h-[32px] w-[1px] bg-[#ececec]" />

            {bootstrapping && (isSignedIn || Boolean(getAuthToken())) ? (
              <ProfilePillSkeleton />
            ) : isSignedIn && user ? (
              <div ref={profileRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowProfileMenu((v) => !v)}
                  className="bg-[#ffefe6] hover:bg-[#ffdfcd] transition-colors h-[46px] pl-[5px] pr-[5px] rounded-full flex items-center justify-between gap-3 w-[196px]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-[36px] h-[36px] rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <span className="w-[36px] h-[36px] rounded-full bg-[#ff6e20] text-white text-[12px] font-bold flex items-center justify-center shrink-0">
                        {initials}
                      </span>
                    )}
                    <div className="text-left leading-tight truncate">
                      <p className="text-[14px] text-black tracking-[-0.28px] font-medium truncate">
                        {user.name}
                      </p>
                      <p className="text-[12px] text-[#ff6e20] tracking-[-0.24px]">
                        Active
                      </p>
                    </div>
                  </div>
                  <span className="bg-[#ff6e20] h-[36px] w-[46px] rounded-full flex items-center justify-center shrink-0 text-white">
                    <FigmaIcon name="upload" className="w-4 h-4 rotate-90" />
                  </span>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 top-[54px] w-[290px] bg-white border border-[#ececec] rounded-[20px] shadow-xl p-5 z-50 flex flex-col gap-2">
                    <div className="pb-1">
                      <p className="text-[17px] font-semibold text-black flex items-center gap-1.5">
                        <span className="truncate">{user.name}</span>
                        {user.email_verified_at && <VerifiedBadge size="sm" />}
                      </p>
                      <p className="text-[12px] text-[#767676] truncate">
                        {user.email}
                      </p>
                    </div>
                    {(user.roles?.includes('admin') ||
                      user.roles?.includes('root_admin')) && (
                      <Link
                        to="/admin"
                        onClick={() => setShowProfileMenu(false)}
                        className="w-full px-3.5 py-2.5 rounded-[14px] bg-black hover:bg-black/85 text-[13.5px] font-semibold text-white transition-colors"
                      >
                        Root Admin Dashboard
                      </Link>
                    )}
                    {(user.roles?.includes('store_owner') || user.store) && (
                      <Link
                        to="/seller"
                        onClick={() => setShowProfileMenu(false)}
                        className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#ffefe6] hover:bg-[#ffdfcd] text-[13.5px] font-semibold text-[#ff6e20] transition-colors"
                      >
                        Store Owner Dashboard
                      </Link>
                    )}
                    {[
                      { label: 'Account settings', to: '/account/profile' },
                      { label: 'Order history', to: '/account/orders' },
                      { label: 'Wishlist', to: '/wishlist' },
                      { label: 'Notifications', to: '/notifications' },
                      { label: 'Address book', to: '/account/addresses' },
                      { label: 'Account security', to: '/account/security' },
                      { label: 'Help center', to: '/help' },
                    ].map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setShowProfileMenu(false)}
                        className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[13.5px] text-black transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        void signOut().then(() => navigate('/login'));
                      }}
                      className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#f7f7f7] hover:bg-[#fdecec] hover:text-[#e5322d] text-left text-[13.5px] text-black transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link
                  to="/login"
                  className="px-[20px] py-[10px] rounded-full bg-[#ffefe6] hover:bg-[#ffdfcd] text-[#ff6e20] text-[13.5px] font-semibold transition-colors whitespace-nowrap"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="px-[20px] py-[10px] rounded-full bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13.5px] font-semibold transition-colors whitespace-nowrap"
                >
                  Create account
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Nav Row */}
        <nav className="flex items-center justify-between gap-4 text-[14px] tracking-[-0.28px] overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-6 lg:gap-[30px] shrink-0">
            <Link
              to="/products"
              className="inline-flex items-center gap-1.5 text-black hover:text-[#ff6e20] transition-colors whitespace-nowrap"
            >
              <FigmaIcon name="menu" className="w-4 h-4" />
              <span>All category</span>
            </Link>
            <Link
              to="/stores"
              className="inline-flex items-center gap-1.5 text-black hover:text-[#ff6e20] transition-colors whitespace-nowrap"
            >
              <VerifiedBadge size="sm" label="Verified store" />
              <span>Verified store</span>
            </Link>
            <Link
              to="/promotion"
              className="inline-flex items-center gap-1.5 text-black hover:text-[#ff6e20] transition-colors whitespace-nowrap"
            >
              <FigmaIcon name="zap" className="w-4 h-4" />
              <span>Promotion</span>
            </Link>
            <Link
              to="/free-delivery"
              className="inline-flex items-center gap-1.5 text-black hover:text-[#ff6e20] transition-colors whitespace-nowrap"
            >
              <FigmaIcon name="truck" className="w-4 h-4" />
              <span>Free delivery</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-6 lg:gap-[30px] shrink-0">
            <Link
              to="/about"
              className="text-black hover:text-[#ff6e20] transition-colors whitespace-nowrap"
            >
              About Kova
            </Link>
            <Link
              to="/help"
              className="text-black hover:text-[#ff6e20] transition-colors whitespace-nowrap"
            >
              Help
            </Link>
            <Link
              to="/help#faq"
              className="text-black hover:text-[#ff6e20] transition-colors whitespace-nowrap"
            >
              FAQ
            </Link>
            <Link
              to={
                user && (user.roles?.includes('store_owner') || user.store)
                  ? '/seller'
                  : '/become-a-seller'
              }
              className="text-black hover:text-[#ff6e20] transition-colors whitespace-nowrap"
            >
              {user && (user.roles?.includes('store_owner') || user.store)
                ? 'Seller Center'
                : 'Become a Seller'}
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
