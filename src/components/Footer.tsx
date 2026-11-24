import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { FigmaIcon, type FigmaIconName } from './FigmaIcon';
import { KovaLogo } from './KovaLogo';

const PROMISES: { icon: FigmaIconName; title: string; desc: string }[] = [
  {
    icon: 'truck',
    title: 'Free delivery in Phnom Penh',
    desc: 'On orders over $25 (KHR 100,000)',
  },
  {
    icon: 'shield',
    title: 'Secure payments',
    desc: 'KHQR, Bakong, cards & cash on delivery',
  },
  {
    icon: 'rotate-ccw',
    title: '7-day easy returns',
    desc: 'Free returns on eligible items',
  },
  {
    icon: 'check-stamp',
    title: 'Verified stores only',
    desc: 'Every seller is reviewed by Kova',
  },
];

export function Footer() {
  const { settings, showToast } = useStore();
  const [email, setEmail] = useState('');

  const socialEntries = (() => {
    const raw = settings.social_links;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
      .map(([platform, url]) => {
        const trimmed = String(url).trim();
        const href = /^https?:\/\//i.test(trimmed)
          ? trimmed
          : `https://${trimmed}`;
        return {
          platform: platform.charAt(0).toUpperCase() + platform.slice(1),
          href,
        };
      });
  })();

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    showToast(`Subscribed ${email.trim()} to Kova weekly deals!`);
    setEmail('');
  };

  return (
    <footer className="w-full bg-white border-t border-[#ececec] mt-8">
      <div className="kova-container px-4 lg:px-5 pt-10 pb-7 flex flex-col gap-10">
        {/* Service Promises Pill Bar */}
        <div className="bg-[#ffefe6] rounded-[24px] px-6 lg:px-8 py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PROMISES.map((item) => (
            <div key={item.title} className="flex items-center gap-3.5">
              <div className="bg-white p-3 rounded-full shrink-0 text-[#ff6e20] flex items-center justify-center">
                <FigmaIcon name={item.icon} className="w-[22px] h-[22px]" />
              </div>
              <div className="leading-[1.4]">
                <p className="text-[15px] font-medium text-black">
                  {item.title}
                </p>
                <p className="text-[13px] text-[#767676]">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Links Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:flex lg:justify-between lg:items-start gap-8 items-start">
          {/* Brand Column */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <KovaLogo />
            <p className="text-[14px] text-[#767676] leading-[1.4] max-w-[300px]">
              Kova Global Store &amp; Logistics — shop thousands of verified
              Cambodian and global stores, delivered to your door.
            </p>
            <div className="flex items-center gap-2.5 text-[13px] text-black">
              <FigmaIcon name="phone" className="w-4 h-4 text-[#ff6e20]" />
              <span>+855 88 337 4874</span>
            </div>
            <div className="flex items-center gap-2.5 text-[13px] text-black">
              <FigmaIcon name="mail" className="w-4 h-4 text-[#ff6e20]" />
              <span>kova.support.kh@gmail.com</span>
            </div>
            <div className="max-w-[300px] flex items-center gap-2.5 text-[13px] text-black">
              <FigmaIcon name="map-pin" className="w-4 h-4 text-[#ff6e20]" />
              <span>No. 21, St. 214, Boeung Raing, Daun Penh, Phnom Penh</span>
            </div>
            {socialEntries.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {socialEntries.map((item) => (
                  <a
                    key={item.platform}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555] text-[12px] font-semibold px-3 py-1 rounded-full transition-colors"
                  >
                    {item.platform}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Shop */}
          <div className="lg:col-span-1 flex flex-col gap-3">
            <p className="text-[15px] font-semibold text-black">Shop</p>
            <Link
              to="/products"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              All products
            </Link>
            <Link
              to="/stores"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              Verified store
            </Link>
            <Link
              to="/promotion"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              Promotion
            </Link>
            <Link
              to="/free-delivery"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              Free delivery
            </Link>
            <Link
              to="/products?sort=newest"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              New arrivals
            </Link>
          </div>

          {/* Customer care */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <p className="text-[15px] font-semibold text-black">
              Customer care
            </p>
            <Link
              to="/help"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              Help center
            </Link>
            <Link
              to="/account/orders"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              Track an order
            </Link>
            <Link
              to="/help/tickets"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              Support tickets
            </Link>
            <Link
              to="/help/contact"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              Contact support
            </Link>
            <Link
              to="/help#faq"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              FAQ
            </Link>
          </div>

          {/* My Kova */}
          <div className="lg:col-span-1 flex flex-col gap-3">
            <p className="text-[15px] font-semibold text-black">My Kova</p>
            <Link
              to="/account/profile"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              Account settings
            </Link>
            <Link
              to="/account/orders"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              Order history
            </Link>
            <Link
              to="/wishlist"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              Wishlist
            </Link>
            <Link
              to="/notifications"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              Notifications
            </Link>
            <Link
              to="/account/security"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              Account security
            </Link>
          </div>

          {/* About Kova */}
          <div className="lg:col-span-1 flex flex-col gap-3">
            <p className="text-[15px] font-semibold text-black">About Kova</p>
            <Link
              to="/about"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              About us
            </Link>
            <Link
              to="/become-a-seller"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              Become a Seller
            </Link>
            <Link
              to="/about#logistics"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              Kova Logistics
            </Link>
            <Link
              to="/about#careers"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              Careers
            </Link>
            <Link
              to="/account/privacy"
              className="text-[14px] text-[#767676] hover:text-[#ff6e20]"
            >
              Privacy policy
            </Link>
          </div>

          {/* Newsletter */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <p className="text-[15px] font-semibold text-black">
              Get deals first
            </p>
            <p className="text-[14px] text-[#767676]">
              Weekly drops, flash sales and price alerts.
            </p>
            <form
              onSubmit={handleSubscribe}
              className="flex items-center gap-2 bg-white border border-[#ff6e20] rounded-full pl-4 pr-1 py-1 w-full max-w-[310px]"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                className="flex-1 text-[14px] text-black placeholder:text-[#979797] bg-transparent outline-none min-w-0"
              />
              <button
                type="submit"
                className="bg-[#ff6e20] hover:bg-[#e85d12] transition-colors text-white text-[14px] font-medium px-[18px] py-[9px] rounded-full shrink-0"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        {/* Legal & Payments */}
        <div className="border-t border-[#ececec] pt-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <p className="text-[13px] text-[#767676]">
            © 2026 Kova Global Store &amp; Logistics Co., Ltd. &nbsp;·&nbsp;
            Privacy &nbsp;·&nbsp; Terms of use
          </p>
          <div className="flex flex-col items-start lg:items-end gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-[#767676]">We accept</span>
              {['KHQR', 'Bakong', 'VISA', 'Mastercard', 'Cash on delivery'].map(
                (m) => (
                  <span
                    key={m}
                    className="bg-[#f7f7f7] text-[12px] font-medium text-black px-2.5 py-1 rounded-full"
                  >
                    {m}
                  </span>
                ),
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-[#767676]">Delivery by</span>
              {[
                'Kova Logistics',
                'J&T Express',
                'Grab Express',
                'Virak Buntham',
              ].map((c) => (
                <span
                  key={c}
                  className="bg-[#f7f7f7] text-[12px] font-medium text-black px-2.5 py-1 rounded-full"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
