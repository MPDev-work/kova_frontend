import { useRef, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { ApiError } from '../../services/api';
import type { Address } from '../../types/marketplace';
import { formatShortDate } from '../../utils/currency';
import { ProductCard } from '../../components/ProductCard';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { CambodiaLocationSelector } from '../../components/CambodiaLocationSelector';
import { ToggleSwitch } from '../../components/ToggleSwitch';

// My Profile (with real Cloudinary avatar upload + real API update)
export function MyProfilePage() {
  const { user, updateProfile, uploadAvatar, showToast } = useStore();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ name, phone: phone || null });
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to save profile.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadAvatar(file);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Image upload failed. Please try again.',
      );
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black leading-[1.35]">
            Customer profile &amp; general settings
          </h1>
          <p className="text-[12.5px] text-[#767676] mt-0.5">
            Manage your Kova account identity, profile photo, and contact
            information.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-4 py-2 rounded-full transition-colors"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>

      <section className="bg-white border border-[#ececec] rounded-[16px] px-5 py-[18px] flex flex-col gap-4 max-w-[820px]">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#ececec]">
          <div className="flex items-center gap-3.5">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-14 h-14 rounded-full object-cover border border-[#ececec]"
              />
            ) : (
              <span className="w-14 h-14 rounded-full bg-[#ff6e20] text-white text-[18px] font-bold flex items-center justify-center">
                {initials}
              </span>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[16px] font-bold text-black">{user.name}</p>
                {user.email_verified_at && (
                  <VerifiedBadge size="sm" label="Verified email" />
                )}
              </div>
              <p className="text-[12.5px] text-[#767676]">{user.email}</p>
            </div>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-[12px] font-semibold text-black px-4 py-2 rounded-full transition-colors"
            >
              {uploading ? 'Uploading...' : 'Upload avatar'}
            </button>
          </div>
        </div>

        <h2 className="text-[15px] font-semibold text-black">
          Personal information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Full name
            </span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3 py-2.5 text-[12.5px] text-black outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Phone number
            </span>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+855 ..."
              className="bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3 py-2.5 text-[12.5px] text-black outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[12px] font-semibold text-black">
              Email address
            </span>
            <input
              type="email"
              disabled
              value={user.email}
              className="bg-[#f7f7f7] border border-[#ececec] rounded-[12px] px-3 py-2.5 text-[12.5px] text-[#767676] outline-none"
            />
          </label>
        </div>
      </section>
    </form>
  );
}

// Address Book
export function AddressBookPage() {
  const { addresses, setDefaultAddress, deleteAddress } = useStore();

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black">Address book</h1>
          <p className="text-[12.5px] text-[#767676] mt-0.5">
            Manage your Phnom Penh and provincial delivery addresses.
          </p>
        </div>
        <Link
          to="/account/addresses/new"
          className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4 py-2 rounded-full transition-colors"
        >
          Add address
        </Link>
      </div>

      {addresses.length === 0 ? (
        <div className="bg-white border border-[#ececec] rounded-[16px] p-10 text-center flex flex-col items-center gap-3">
          <p className="text-[15px] font-semibold text-black">
            No saved addresses yet
          </p>
          <Link
            to="/account/addresses/new"
            className="bg-[#ff6e20] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full"
          >
            Add address
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`rounded-[16px] p-5 flex flex-col gap-2 ${
                addr.is_default
                  ? 'bg-[#ffefe6] border border-[#ff6e20]'
                  : 'bg-white border border-[#ececec]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-semibold text-black">
                  {addr.full_name}
                  {addr.is_default && (
                    <span className="ml-2 text-[11.5px] text-[#ff6e20] font-semibold">
                      · Default
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    to={`/account/addresses/${addr.id}/edit`}
                    className="text-[12px] font-semibold text-[#ff6e20] hover:underline"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => void deleteAddress(addr.id)}
                    className="text-[12px] font-semibold text-[#e5322d] hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-[13px] font-medium text-black">{addr.phone}</p>
              <p className="text-[13px] text-[#767676]">
                {[
                  addr.address_line_1,
                  addr.commune,
                  addr.district,
                  addr.province,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {!addr.is_default && (
                <button
                  type="button"
                  onClick={() => void setDefaultAddress(addr.id)}
                  className="mt-2 self-start bg-white border border-[#ececec] hover:border-[#ff6e20] text-[12px] font-semibold text-black px-4 py-1.5 rounded-full"
                >
                  Set as default
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Add Address
export function AddAddressPage() {
  const { addAddress, user, showToast } = useStore();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [province, setProvince] = useState('Phnom Penh');
  const [district, setDistrict] = useState('Chamkar Mon');
  const [commune, setCommune] = useState('Tonle Basak');
  const [street, setStreet] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addAddress({
        type: 'shipping',
        full_name: fullName,
        phone,
        province,
        district: district || null,
        commune: commune || null,
        address_line_1: street,
        is_default: isDefault,
      });
      navigate('/account/addresses');
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to save address.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black">
            Add a new address
          </h1>
          <p className="text-[12.5px] text-[#767676] mt-0.5">
            Save a delivery location to your account.
          </p>
        </div>
        <Link
          to="/account/addresses"
          className="bg-white border border-[#ececec] hover:border-black text-[12.5px] font-medium text-black px-4 py-2 rounded-full"
        >
          Back
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#ececec] rounded-[16px] p-6 max-w-[760px] grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold">Full name</span>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="border border-[#ececec] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none focus:border-[#ff6e20]"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold">Phone number</span>
          <input
            type="text"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="border border-[#ececec] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none focus:border-[#ff6e20]"
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
        />

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold">Street address</span>
          <input
            type="text"
            required
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="House #, Street..."
            className="border border-[#ececec] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none focus:border-[#ff6e20]"
          />
        </label>
        <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-2 border-t border-[#f1f1f1]">
          <div>
            <p className="text-[13px] font-semibold text-black">
              Default delivery address
            </p>
            <p className="text-[12px] text-[#767676]">
              Automatically pre-select this address at checkout.
            </p>
          </div>
          <ToggleSwitch
            checked={isDefault}
            onChange={setIsDefault}
            ariaLabel="Set as my default delivery address"
          />
        </div>
        <div className="sm:col-span-2 flex gap-2.5 pt-1">
          <Link
            to="/account/addresses"
            className="bg-white border border-[#ececec] hover:border-black text-[13px] font-semibold text-black px-5 py-2.5 rounded-full"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[13px] font-semibold px-6 py-2.5 rounded-full"
          >
            {saving ? 'Saving...' : 'Save address'}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditAddressForm({ address }: { address: Address }) {
  const { updateAddress, showToast } = useStore();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(address.full_name || '');
  const [phone, setPhone] = useState(address.phone || '');
  const [province, setProvince] = useState(address.province || 'Phnom Penh');
  const [district, setDistrict] = useState(address.district || '');
  const [commune, setCommune] = useState(address.commune || '');
  const [street, setStreet] = useState(address.address_line_1 || '');
  const [isDefault, setIsDefault] = useState(Boolean(address.is_default));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAddress(address.id, {
        type: address.type || 'shipping',
        full_name: fullName,
        phone,
        province,
        district: district || null,
        commune: commune || null,
        address_line_1: street,
        address_line_2: address.address_line_2 ?? null,
        postal_code: address.postal_code ?? null,
        is_default: isDefault,
      });
      navigate('/account/addresses');
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to update address.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-[#ececec] rounded-[16px] p-6 max-w-[760px] grid grid-cols-1 sm:grid-cols-2 gap-4"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold">Full name</span>
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="border border-[#ececec] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none focus:border-[#ff6e20]"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold">Phone number</span>
        <input
          type="text"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="border border-[#ececec] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none focus:border-[#ff6e20]"
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
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold">Street address</span>
        <input
          type="text"
          required
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          placeholder="House #, Street..."
          className="border border-[#ececec] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none focus:border-[#ff6e20]"
        />
      </label>
      <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-2 border-t border-[#f1f1f1]">
        <div>
          <p className="text-[13px] font-semibold text-black">
            Default delivery address
          </p>
          <p className="text-[12px] text-[#767676]">
            Automatically pre-select this address at checkout.
          </p>
        </div>
        <ToggleSwitch
          checked={isDefault}
          onChange={setIsDefault}
          ariaLabel="Set as my default delivery address"
        />
      </div>
      <div className="sm:col-span-2 flex gap-2.5 pt-1">
        <Link
          to="/account/addresses"
          className="bg-white border border-[#ececec] hover:border-black text-[13px] font-semibold text-black px-5 py-2.5 rounded-full"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[13px] font-semibold px-6 py-2.5 rounded-full"
        >
          {saving ? 'Updating...' : 'Update address'}
        </button>
      </div>
    </form>
  );
}

// Edit Address
export function EditAddressPage() {
  const { addressId } = useParams<{ addressId: string }>();
  const { addresses } = useStore();
  const address = addresses.find((a) => a.id === Number(addressId));

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black">Edit address</h1>
          <p className="text-[12.5px] text-[#767676] mt-0.5">
            Update your saved delivery location.
          </p>
        </div>
        <Link
          to="/account/addresses"
          className="bg-white border border-[#ececec] hover:border-black text-[12.5px] font-medium text-black px-4 py-2 rounded-full"
        >
          Back
        </Link>
      </div>

      {!address ? (
        <div className="bg-white border border-[#ececec] rounded-[16px] p-8 flex flex-col gap-3 max-w-[540px]">
          <p className="text-[14px] font-semibold text-black">
            Address not found
          </p>
          <p className="text-[13px] text-[#767676]">
            This address may have been removed or is not available on your
            account.
          </p>
          <Link
            to="/account/addresses"
            className="self-start bg-[#ff6e20] text-white text-[12.5px] font-semibold px-5 py-2 rounded-full"
          >
            Back to address book
          </Link>
        </div>
      ) : (
        <EditAddressForm key={address.id} address={address} />
      )}
    </div>
  );
}

// Recently Viewed
export function RecentlyViewedPage() {
  const { recentlyViewedIds, products } = useStore();
  const items = recentlyViewedIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <h1 className="text-[22px] font-bold text-black">Recently viewed</h1>
        <p className="text-[12.5px] text-[#767676] mt-0.5">
          Products you recently browsed.
        </p>
      </div>
      {items.length === 0 ? (
        <div className="bg-white border border-[#ececec] rounded-[16px] p-10 text-center text-[14px] text-[#767676]">
          You have not viewed any products yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

// My Reviews
export function MyReviewsPage() {
  const { reviews } = useStore();

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black">My reviews</h1>
          <p className="text-[12.5px] text-[#767676] mt-0.5">
            Reviews you submitted for Kova products.
          </p>
        </div>
        <Link
          to="/account/reviews/write"
          className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4 py-2 rounded-full"
        >
          Write a review
        </Link>
      </div>

      {reviews.length === 0 ? (
        <div className="bg-white border border-[#ececec] rounded-[16px] p-10 text-center text-[14px] text-[#767676]">
          You have not submitted any reviews yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="bg-white border border-[#ececec] rounded-[16px] p-5 flex flex-col sm:flex-row gap-4 items-start"
            >
              {rev.product_image && (
                <img
                  src={rev.product_image}
                  alt={rev.product_name || 'Product'}
                  className="w-[74px] h-[74px] rounded-[12px] object-cover border border-[#ececec] shrink-0"
                />
              )}
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[15px] font-semibold text-black flex items-center gap-1.5">
                    <span>
                      {rev.product_name || `Product #${rev.product_id}`}
                    </span>
                    {rev.is_verified_purchase && <VerifiedBadge size="xs" />}
                  </p>
                  <span className="text-[12px] text-[#767676]">
                    {formatShortDate(rev.created_at)}
                  </span>
                </div>
                <p className="text-[12.5px] text-[#ff6e20]">
                  {'★'.repeat(rev.rating)}
                  {'☆'.repeat(5 - rev.rating)}
                </p>
                <p className="text-[13.5px] text-[#767676] leading-[1.5]">
                  {rev.comment}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Write a Review
export function WriteReviewPage() {
  const [searchParams] = useSearchParams();
  const { products, addReview, showToast } = useStore();
  const navigate = useNavigate();

  const paramId = Number(searchParams.get('productId'));
  const [productId, setProductId] = useState<number>(
    paramId || products[0]?.id || 0,
  );
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      showToast('Please select a product.');
      return;
    }
    setSubmitting(true);
    try {
      await addReview({ product_id: productId, rating, comment });
      navigate('/account/reviews');
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to publish review.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[22px] font-bold text-black">Write a review</h1>
        <Link
          to="/account/reviews"
          className="bg-white border border-[#ececec] hover:border-black text-[12.5px] font-medium text-black px-4 py-2 rounded-full"
        >
          Back
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="bg-white border border-[#ececec] rounded-[16px] p-8 text-[14px] text-[#767676]">
          No products are available to review yet.
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-[#ececec] rounded-[16px] p-6 max-w-[700px] flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Select product
            </span>
            <select
              value={productId}
              onChange={(e) => setProductId(Number(e.target.value))}
              className="border border-[#ececec] rounded-[12px] px-3.5 py-2.5 text-[13px] bg-white"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Your rating
            </span>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-[26px] transition-transform hover:scale-110 ${
                    star <= rating ? 'text-[#ff6e20]' : 'text-[#ececec]'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black">
              Your review
            </span>
            <textarea
              rows={4}
              required
              minLength={5}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your honest experience..."
              className="border border-[#ececec] rounded-[14px] p-3.5 text-[13px] outline-none focus:border-[#ff6e20]"
            />
          </label>

          <div className="flex gap-2.5">
            <Link
              to="/account/reviews"
              className="bg-white border border-[#ececec] text-[13px] font-semibold text-black px-5 py-2.5 rounded-full"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[13px] font-semibold px-6 py-2.5 rounded-full"
            >
              {submitting ? 'Publishing...' : 'Publish review'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// Notification Preferences
export function NotificationPrefsPage() {
  const { notifPrefs, updateNotifPrefs } = useStore();
  const items = [
    {
      key: 'orderUpdates' as const,
      label: 'Order & shipment updates',
      desc: 'Confirmations, courier pickup, and delivery arrival alerts.',
    },
    {
      key: 'flashSales' as const,
      label: 'Promotion alerts',
      desc: 'New voucher releases and store campaigns.',
    },
    {
      key: 'priceDrops' as const,
      label: 'Wishlist price drops',
      desc: 'Alert when a saved item goes on sale.',
    },
    {
      key: 'khqrVouchers' as const,
      label: 'Bakong KHQR receipts',
      desc: 'Payment confirmation updates.',
    },
    {
      key: 'smsAlerts' as const,
      label: 'SMS notifications',
      desc: 'Delivery updates on your mobile number.',
    },
  ];

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black">
            Notification preferences
          </h1>
          <p className="text-[12.5px] text-[#767676] mt-0.5">
            Control which alerts Kova sends you.
          </p>
        </div>
        <Link
          to="/notifications"
          className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full"
        >
          View notifications
        </Link>
      </div>

      <div className="bg-white border border-[#ececec] rounded-[16px] px-5 py-[18px] flex flex-col gap-4 max-w-[820px]">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-4 pb-4 border-b border-[#ececec] last:border-b-0 last:pb-0"
          >
            <div>
              <p className="text-[14px] font-semibold text-black">
                {item.label}
              </p>
              <p className="text-[12.5px] text-[#767676]">{item.desc}</p>
            </div>
            <ToggleSwitch
              checked={notifPrefs[item.key]}
              onChange={(next) => updateNotifPrefs({ [item.key]: next })}
              ariaLabel={item.label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Privacy Settings
export function PrivacySettingsPage() {
  const { privacyPrefs, updatePrivacyPrefs } = useStore();
  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <h1 className="text-[22px] font-bold text-black">Privacy settings</h1>
        <p className="text-[12.5px] text-[#767676] mt-0.5">
          Control personalization, review visibility, and browsing history.
        </p>
      </div>

      <div className="bg-white border border-[#ececec] rounded-[16px] px-5 py-[18px] flex flex-col gap-4 max-w-[820px]">
        {[
          {
            key: 'personalizedRecs' as const,
            label: 'Personalized product recommendations',
            desc: 'Tailor home feed deals based on categories you explore.',
          },
          {
            key: 'shareReviewsPublicly' as const,
            label: 'Display my name on reviews',
            desc: 'Show your account name alongside reviews.',
          },
          {
            key: 'browsingHistory' as const,
            label: 'Save recently viewed history',
            desc: 'Keep your recently viewed items list in this browser.',
          },
        ].map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-4 pb-4 border-b border-[#ececec] last:border-b-0 last:pb-0"
          >
            <div>
              <p className="text-[14px] font-semibold text-black">
                {item.label}
              </p>
              <p className="text-[12.5px] text-[#767676]">{item.desc}</p>
            </div>
            <ToggleSwitch
              checked={privacyPrefs[item.key]}
              onChange={(next) => updatePrivacyPrefs({ [item.key]: next })}
              ariaLabel={item.label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Account Security
export function AccountSecurityPage() {
  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <h1 className="text-[22px] font-bold text-black">Account security</h1>
        <p className="text-[12.5px] text-[#767676] mt-0.5">
          Manage your password and account lifecycle.
        </p>
      </div>

      <div className="bg-white border border-[#ececec] rounded-[16px] px-5 py-[18px] flex flex-col gap-4 max-w-[820px]">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#ececec]">
          <div>
            <p className="text-[14px] font-semibold text-black">Password</p>
            <p className="text-[12.5px] text-[#767676]">
              Update your Kova account password.
            </p>
          </div>
          <Link
            to="/account/password"
            className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full"
          >
            Change password
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold text-[#e5322d]">
              Delete account
            </p>
            <p className="text-[12.5px] text-[#767676]">
              Deactivate and delete your Kova customer account.
            </p>
          </div>
          <Link
            to="/account/delete"
            className="bg-[#fdecec] hover:bg-[#f9dada] text-[#e5322d] text-[12.5px] font-semibold px-4 py-2 rounded-full"
          >
            Delete account
          </Link>
        </div>
      </div>
    </div>
  );
}

// Change Password
export function ChangePasswordPage() {
  const { changePassword, showToast } = useStore();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await changePassword({
        current_password: currentPassword,
        password,
        password_confirmation: confirm,
      });
      navigate('/account/security');
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to update password.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[22px] font-bold text-black">Change password</h1>
        <Link
          to="/account/security"
          className="bg-white border border-[#ececec] hover:border-black text-[12.5px] font-medium text-black px-4 py-2 rounded-full"
        >
          Back
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#ececec] rounded-[16px] p-6 max-w-[540px] flex flex-col gap-4"
      >
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Current password"
          className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none"
        />
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (min 8 characters)"
          className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none"
        />
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none"
        />
        <div className="flex gap-2.5 pt-1">
          <Link
            to="/account/security"
            className="bg-white border border-[#ececec] text-[13px] font-semibold text-black px-5 py-2.5 rounded-full"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[13px] font-semibold px-6 py-2.5 rounded-full"
          >
            {saving ? 'Updating...' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  );
}

// Delete Account
export function DeleteAccountPage() {
  const { deleteAccount, showToast } = useStore();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[22px] font-bold text-[#e5322d]">
          Delete your Kova account
        </h1>
        <Link
          to="/account/security"
          className="bg-white border border-[#ececec] hover:border-black text-[12.5px] font-medium text-black px-4 py-2 rounded-full"
        >
          Back
        </Link>
      </div>

      <div className="bg-white border border-[#e5322d]/30 rounded-[16px] p-6 max-w-[600px] flex flex-col gap-4">
        <p className="text-[13.5px] text-[#767676] leading-[1.6]">
          Type <strong className="text-black">DELETE</strong> below to confirm
          deleting your Kova account.
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type DELETE to confirm"
          className="border border-[#ececec] focus:border-[#e5322d] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none"
        />
        <div className="flex gap-2.5">
          <Link
            to="/account/security"
            className="bg-white border border-[#ececec] text-[13px] font-semibold text-black px-5 py-2.5 rounded-full"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={confirmText !== 'DELETE' || deleting}
            onClick={async () => {
              setDeleting(true);
              try {
                await deleteAccount();
                navigate('/');
              } catch (err) {
                showToast(
                  err instanceof ApiError
                    ? err.message
                    : 'Unable to delete account.',
                );
              } finally {
                setDeleting(false);
              }
            }}
            className="bg-[#e5322d] disabled:opacity-40 text-white text-[13px] font-semibold px-6 py-2.5 rounded-full"
          >
            {deleting ? 'Deleting...' : 'Permanently delete account'}
          </button>
        </div>
      </div>
    </div>
  );
}
