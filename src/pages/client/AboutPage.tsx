import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { ApiError, customerApi, toFriendlyErrorMessage } from '../../services/api';
import { CambodiaLocationSelector } from '../../components/CambodiaLocationSelector';
import { PasswordInput } from '../../components/PasswordInput';
import type { StoreApplication } from '../../types/marketplace';

export function AboutPage({ mode = 'about' }: { mode?: 'about' | 'seller' }) {
  const {
    isSignedIn,
    user,
    stores,
    products,
    provinces,
    register,
    refreshUser,
    showToast,
  } = useStore();

  const [myApp, setMyApp] = useState<StoreApplication | null>(null);
  const [loadingApp, setLoadingApp] = useState(mode === 'seller' && isSignedIn);

  // Store fields
  const [storeName, setStoreName] = useState('');
  const [storeDescription, setStoreDescription] = useState('');
  const [province, setProvince] = useState('Phnom Penh');
  const [district, setDistrict] = useState('Chamkar Mon');
  const [commune, setCommune] = useState('Tonle Basak');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [businessRegNo, setBusinessRegNo] = useState('');
  const [taxId, setTaxId] = useState('');

  // Guest seller registration fields
  const [ownerName, setOwnerName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<{
    password?: string;
    confirm?: string;
  }>({});
  const [passwordShakeKey, setPasswordShakeKey] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode !== 'seller' || !isSignedIn) return;
    let active = true;
    customerApi
      .getMyStoreApplication()
      .then((app) => {
        if (active) {
          setMyApp(app && typeof app === 'object' && 'id' in app ? app : null);
        }
      })
      .catch(() => {
        if (active) setMyApp(null);
      })
      .finally(() => {
        if (active) setLoadingApp(false);
      });
    return () => {
      active = false;
    };
  }, [mode, isSignedIn]);

  if (mode === 'seller') {
    const composedAddress = [commune, district, province]
      .filter(Boolean)
      .join(', ');

    const handleSignedInApply = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);
      try {
        const app = await customerApi.applyForStore({
          store_name: storeName.trim(),
          store_description: storeDescription.trim() || undefined,
          store_address: composedAddress,
          province: province.trim() || undefined,
          district: district.trim() || undefined,
          commune: commune.trim() || undefined,
          google_maps_url: googleMapsUrl.trim() || undefined,
          phone: phone.trim(),
          email: (email || user?.email || '').trim(),
          business_registration_number: businessRegNo.trim() || undefined,
          tax_id: taxId.trim() || undefined,
        });
        setMyApp(app);
        await refreshUser();
        showToast('Store application submitted for Root Admin review.');
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : 'We could not submit your store application right now.';
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    };

    const handleGuestSellerRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const nextErrors: { password?: string; confirm?: string } = {};
      if (password.length < 8) {
        nextErrors.password = 'Your password must be at least 8 characters.';
      }
      if (password !== passwordConfirmation) {
        nextErrors.confirm = "Your passwords don't match.";
      }
      if (Object.keys(nextErrors).length > 0) {
        setPasswordErrors(nextErrors);
        setPasswordShakeKey((k) => k + 1);
        return;
      }
      setPasswordErrors({});
      setSubmitting(true);
      try {
        await register({
          name: ownerName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          password_confirmation: passwordConfirmation,
          role: 'store_owner',
          store_name: storeName.trim(),
          store_description: storeDescription.trim() || undefined,
          store_address: composedAddress,
          province: province.trim() || undefined,
          district: district.trim() || undefined,
          commune: commune.trim() || undefined,
          google_maps_url: googleMapsUrl.trim() || undefined,
        });
        const app = await customerApi.getMyStoreApplication();
        setMyApp(app && typeof app === 'object' && 'id' in app ? app : null);
      } catch (err) {
        if (err instanceof ApiError && err.errors?.password?.[0]) {
          setPasswordErrors({
            password: toFriendlyErrorMessage(err.errors.password[0], err.status),
          });
          setPasswordShakeKey((k) => k + 1);
          return;
        }
        const msg =
          err instanceof ApiError
            ? err.message
            : 'We could not register your seller account right now.';
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="kova-container px-4 lg:px-6 pt-6 pb-12 flex flex-col gap-6">
        <div className="kova-gradient rounded-[24px] p-8 sm:p-10 text-white flex flex-col gap-4">
          <span className="self-start bg-white/20 px-3.5 py-1 rounded-full text-[12px] font-bold">
            KOVA SELLER APPLICATION
          </span>
          <h1 className="text-[32px] sm:text-[36px] font-bold leading-tight max-w-[700px]">
            Open your verified storefront on Kova Cambodia.
          </h1>
          <p className="text-[15px] text-[#fff0e6] max-w-[620px]">
            Connect your Bakong merchant account, manage product inventory via
            Cloudinary, and ship to all 25 provinces.
          </p>
        </div>

        {loadingApp ? (
          <div className="bg-white border border-[#ececec] rounded-[20px] p-8 text-[14px] text-[#767676]">
            Checking your store application status...
          </div>
        ) : myApp && myApp.status !== 'rejected' ? (
          <div className="bg-white border border-[#ececec] rounded-[20px] p-7 flex flex-col gap-3 max-w-[680px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[20px] font-semibold text-black">
                {myApp.store_name}
              </h2>
              <span
                className={`text-[12px] font-semibold px-3.5 py-1 rounded-full capitalize ${
                  myApp.status === 'approved'
                    ? 'bg-[#e7f6e7] text-[#029500]'
                    : 'bg-[#ffefe6] text-[#ff6e20]'
                }`}
              >
                Status: {myApp.status}
              </span>
            </div>
            {myApp.store_description && (
              <p className="text-[14px] text-[#767676]">
                {myApp.store_description}
              </p>
            )}
            <p className="text-[13px] text-[#767676]">
              {myApp.store_address} · {myApp.phone} · {myApp.email}
            </p>
            <p className="text-[13px] text-[#767676] pt-1">
              {myApp.status === 'approved'
                ? 'Your store has been approved and is ready to sell on Kova.'
                : 'Your application is pending review by a Kova Root Administrator. You can continue shopping as a customer in the meantime — once approved, we will send you a welcome email and switch your account to Seller Center.'}
            </p>
            <div className="flex flex-wrap gap-2.5 pt-2">
              {myApp.status === 'approved' ? (
                <Link
                  to="/seller"
                  className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full transition-colors"
                >
                  Visit your store
                </Link>
              ) : (
                <Link
                  to="/"
                  className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full transition-colors"
                >
                  Continue shopping
                </Link>
              )}
            </div>
          </div>
        ) : isSignedIn ? (
          <form
            onSubmit={handleSignedInApply}
            className="bg-white border border-[#ececec] rounded-[20px] p-7 max-w-[760px] grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <div className="sm:col-span-2">
              <h2 className="text-[20px] font-semibold text-black">
                Apply for a Seller Store
              </h2>
              <p className="text-[13px] text-[#767676] mt-0.5">
                Signed in as <strong className="text-black">{user?.name}</strong>{' '}
                ({user?.email})
              </p>
            </div>

            {error && (
              <div className="sm:col-span-2 bg-[#fdecec] border border-[#e5322d]/30 text-[#e5322d] rounded-[12px] px-4 py-3 text-[13px] font-medium">
                {error}
              </div>
            )}

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[12px] font-semibold">Store name</span>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Your store name"
                className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold">Business phone</span>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="012 345 678"
                className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold">Business email</span>
              <input
                type="email"
                required
                value={email || user?.email || ''}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="store@example.com"
                className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
              />
            </label>

            <CambodiaLocationSelector
              province={province}
              district={district}
              commune={commune}
              onChange={(loc) => {
                setProvince(loc.province);
                setDistrict(loc.district);
                setCommune(loc.commune);
              }}
              inputClassName="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[14px] bg-white outline-none"
            />

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold">
                Google Maps link (optional)
              </span>
              <input
                type="url"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/..."
                className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
              />
            </label>

            {composedAddress && (
              <div className="sm:col-span-2 bg-[#f7f7f7] border border-[#ececec] rounded-[14px] px-4 py-2.5 flex items-center gap-2 text-[13px] text-[#555555]">
                <MapPin className="w-4 h-4 text-[#ff6e20] shrink-0" />
                <span className="truncate">
                  <strong className="text-black">Location preview:</strong>{' '}
                  {composedAddress}
                </span>
              </div>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold">
                Business registration # (optional)
              </span>
              <input
                type="text"
                value={businessRegNo}
                onChange={(e) => setBusinessRegNo(e.target.value)}
                className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold">
                Tax ID / VAT (optional)
              </span>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
              />
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[12px] font-semibold">
                Store description
              </span>
              <textarea
                rows={3}
                value={storeDescription}
                onChange={(e) => setStoreDescription(e.target.value)}
                placeholder="Tell customers what your store sells..."
                className="border border-[#ececec] rounded-[12px] p-3.5 text-[14px] outline-none focus:border-[#ff6e20]"
              />
            </label>

            <div className="sm:col-span-2 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[14px] font-semibold px-6 py-3 rounded-full"
              >
                {submitting ? 'Submitting...' : 'Submit store application'}
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleGuestSellerRegister}
            className="bg-white border border-[#ececec] rounded-[20px] p-7 max-w-[760px] grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[20px] font-semibold text-black">
                  Register as a Seller
                </h2>
                <p className="text-[13px] text-[#767676] mt-0.5">
                  Create your seller account and submit your store application
                  in one step.
                </p>
              </div>
              <Link
                to="/login"
                className="text-[13px] font-semibold text-[#ff6e20] hover:underline"
              >
                Already have an account? Sign in
              </Link>
            </div>

            {error && (
              <div className="sm:col-span-2 bg-[#fdecec] border border-[#e5322d]/30 text-[#e5322d] rounded-[12px] px-4 py-3 text-[13px] font-medium">
                {error}
              </div>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold">Owner full name</span>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Your full name"
                className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold">Store name</span>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Your store name"
                className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold">Email address</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold">Phone number</span>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="012 345 678"
                className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
              />
            </label>

            <PasswordInput
              label="Password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordErrors.password) {
                  setPasswordErrors((prev) => ({
                    ...prev,
                    password: undefined,
                  }));
                }
              }}
              placeholder="At least 8 characters"
              error={passwordErrors.password}
              shakeKey={passwordShakeKey}
              inputClassName="text-[14px]"
            />

            <PasswordInput
              label="Confirm password"
              required
              minLength={8}
              autoComplete="new-password"
              value={passwordConfirmation}
              onChange={(e) => {
                setPasswordConfirmation(e.target.value);
                if (passwordErrors.confirm) {
                  setPasswordErrors((prev) => ({
                    ...prev,
                    confirm: undefined,
                  }));
                }
              }}
              placeholder="Re-enter password"
              error={passwordErrors.confirm}
              shakeKey={passwordShakeKey}
              inputClassName="text-[14px]"
            />

            <CambodiaLocationSelector
              province={province}
              district={district}
              commune={commune}
              onChange={(loc) => {
                setProvince(loc.province);
                setDistrict(loc.district);
                setCommune(loc.commune);
              }}
              inputClassName="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[14px] bg-white outline-none"
            />

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold">
                Google Maps link (optional)
              </span>
              <input
                type="url"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/..."
                className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
              />
            </label>

            {composedAddress && (
              <div className="sm:col-span-2 bg-[#f7f7f7] border border-[#ececec] rounded-[14px] px-4 py-2.5 flex items-center gap-2 text-[13px] text-[#555555]">
                <MapPin className="w-4 h-4 text-[#ff6e20] shrink-0" />
                <span className="truncate">
                  <strong className="text-black">Location preview:</strong>{' '}
                  {composedAddress}
                </span>
              </div>
            )}

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[12px] font-semibold">
                Store description (optional)
              </span>
              <textarea
                rows={3}
                value={storeDescription}
                onChange={(e) => setStoreDescription(e.target.value)}
                placeholder="Describe what your store sells..."
                className="border border-[#ececec] rounded-[12px] p-3.5 text-[14px] outline-none focus:border-[#ff6e20]"
              />
            </label>

            <div className="sm:col-span-2 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[14px] font-semibold px-6 py-3 rounded-full"
              >
                {submitting ? 'Creating seller account...' : 'Register seller'}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="kova-container px-4 lg:px-6 pt-6 pb-12 flex flex-col gap-6">
      <div className="bg-white border border-[#ececec] rounded-[24px] p-8 sm:p-10 flex flex-col gap-4">
        <span className="self-start bg-[#ffefe6] text-[#ff6e20] px-3.5 py-1 rounded-full text-[12px] font-bold">
          ABOUT KOVA
        </span>
        <h1 className="text-[34px] font-bold text-black leading-tight">
          Kova Global Store &amp; Logistics
        </h1>
        <p className="text-[15.5px] text-[#767676] leading-[1.65] max-w-[780px]">
          Multi-vendor marketplace built for Cambodia with transparent USD/KHR
          pricing, direct National Bank of Cambodia Bakong KHQR payments,
          Cloudinary media hosting, and multi-store order fulfillment.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3">
          {[
            { num: String(stores.length), label: 'Approved Stores' },
            { num: String(products.length), label: 'Published Products' },
            { num: String(provinces.length || 25), label: 'Cambodia Provinces' },
          ].map((s) => (
            <div key={s.label} className="bg-[#f7f7f7] rounded-[16px] p-4">
              <p className="text-[24px] font-bold text-[#ff6e20]">{s.num}</p>
              <p className="text-[13px] text-[#767676]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
