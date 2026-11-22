import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { Package, Star, Trash2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { ApiError } from '../../services/api';
import type { Address, ReviewItem } from '../../types/marketplace';
import { formatShortDate } from '../../utils/currency';
import { DashboardModal } from '../../components/DashboardPrimitives';
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

const REVIEW_RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
};

interface PendingReviewItem {
  key: string;
  orderItemId: number;
  productId: number;
  productName: string;
  productImage?: string | null;
  storeName?: string | null;
  orderNumber: string;
  orderDate: string;
  orderStatus: string;
}

// My Reviews
export function MyReviewsPage() {
  const {
    orders,
    reviews,
    addReview,
    deleteReview,
    refreshOrders,
    refreshReviews,
    showToast,
  } = useStore();
  const [activeTab, setActiveTab] = useState<'reviewed' | 'to_review'>(
    'reviewed',
  );
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [reviewTarget, setReviewTarget] = useState<PendingReviewItem | null>(
    null,
  );
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void refreshOrders();
    void refreshReviews();
  }, [refreshOrders, refreshReviews]);

  const toReviewItems = useMemo<PendingReviewItem[]>(() => {
    const eligibleStatuses = new Set(['completed', 'delivered', 'shipped']);
    const list: PendingReviewItem[] = [];
    const seenKeys = new Set<string>();

    for (const order of orders) {
      if (order.status === 'cancelled') continue;
      for (const child of order.children || []) {
        if (child.status === 'cancelled') continue;
        const effectiveStatus = eligibleStatuses.has(child.status)
          ? child.status
          : eligibleStatuses.has(order.status)
            ? order.status
            : null;
        if (!effectiveStatus) continue;

        for (const item of child.items || []) {
          if (!item.product_id) continue;
          const alreadyReviewed = reviews.some(
            (r) =>
              (r.order_item_id && r.order_item_id === item.id) ||
              r.product_id === item.product_id,
          );
          if (alreadyReviewed) continue;

          const dedupeKey = `${order.id}-${item.id}`;
          if (seenKeys.has(dedupeKey)) continue;
          seenKeys.add(dedupeKey);

          list.push({
            key: dedupeKey,
            orderItemId: item.id,
            productId: item.product_id,
            productName: item.product_name,
            productImage: item.image ?? null,
            storeName: child.store?.name ?? null,
            orderNumber: order.order_number,
            orderDate: order.created_at,
            orderStatus: effectiveStatus,
          });
        }
      }
    }

    return list;
  }, [orders, reviews]);

  const openWriteModal = (item: PendingReviewItem) => {
    setReviewTarget(item);
    setRating(5);
    setHoverRating(null);
    setTitle('');
    setComment('');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;
    if (comment.trim().length < 5) {
      showToast('Please write at least 5 characters for your review.');
      return;
    }
    setSubmitting(true);
    try {
      await addReview({
        product_id: reviewTarget.productId,
        order_item_id: reviewTarget.orderItemId,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim(),
      });
      setReviewTarget(null);
      setActiveTab('reviewed');
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to submit review.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: number) => {
    setDeletingId(reviewId);
    try {
      await deleteReview(reviewId);
      setConfirmDeleteId(null);
      if (selectedReview?.id === reviewId) {
        setSelectedReview(null);
      }
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to delete review.',
      );
    } finally {
      setDeletingId(null);
    }
  };

  const displayRating = hoverRating ?? rating;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black">My reviews</h1>
          <p className="text-[12.5px] text-[#767676] mt-0.5">
            Track products waiting for your feedback and review your past ratings.
          </p>
        </div>
      </div>

      {/* Top Switch Bar: Reviewed | To review */}
      <div className="bg-white border border-[#ececec] rounded-[16px] p-1.5 inline-flex items-center gap-1.5 self-start">
        <button
          type="button"
          onClick={() => setActiveTab('reviewed')}
          className={`px-4 py-2 rounded-[12px] text-[13px] font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'reviewed'
              ? 'bg-[#ff6e20] text-white shadow-[0_4px_12px_rgba(255,110,32,0.25)]'
              : 'text-[#555555] hover:bg-[#f7f7f7] hover:text-black'
          }`}
        >
          <span>Reviewed</span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full ${
              activeTab === 'reviewed'
                ? 'bg-white/20 text-white'
                : 'bg-[#f4f4f4] text-[#767676]'
            }`}
          >
            {reviews.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('to_review')}
          className={`px-4 py-2 rounded-[12px] text-[13px] font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'to_review'
              ? 'bg-[#ff6e20] text-white shadow-[0_4px_12px_rgba(255,110,32,0.25)]'
              : 'text-[#555555] hover:bg-[#f7f7f7] hover:text-black'
          }`}
        >
          <span>To review</span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full ${
              activeTab === 'to_review'
                ? 'bg-white/20 text-white'
                : toReviewItems.length > 0
                  ? 'bg-[#ffefe6] text-[#ff6e20]'
                  : 'bg-[#f4f4f4] text-[#767676]'
            }`}
          >
            {toReviewItems.length}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'reviewed' ? (
        reviews.length === 0 ? (
          <div className="bg-white border border-[#ececec] rounded-[18px] p-12 text-center flex flex-col items-center gap-2">
            <span className="w-12 h-12 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
              <Star className="w-5 h-5" />
            </span>
            <p className="text-[15px] font-semibold text-black">
              No reviews yet
            </p>
            <p className="text-[13px] text-[#767676]">
              Switch to &ldquo;To review&rdquo; to rate your shipped or completed orders.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviews.map((rev) => (
              <button
                key={rev.id}
                type="button"
                onClick={() => {
                  setConfirmDeleteId(null);
                  setSelectedReview(rev);
                }}
                className="group bg-white border border-[#ececec] hover:border-[#ff6e20]/60 hover:shadow-[0_10px_28px_rgba(0,0,0,0.06)] rounded-[18px] overflow-hidden text-left flex flex-col transition-all"
              >
                <div className="relative h-[168px] w-full bg-[#f7f7f7] overflow-hidden flex items-center justify-center border-b border-[#f0f0f0]">
                  {rev.product_image ? (
                    <img
                      src={rev.product_image}
                      alt={rev.product_name || 'Product'}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  ) : (
                    <Package className="w-8 h-8 text-[#c4c4c4]" />
                  )}
                  <span className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm border border-[#ececec] text-[#ff6e20] text-[11.5px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                    ★ {rev.rating}.0
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col gap-2">
                  <div className="flex items-start gap-1.5">
                    <p className="text-[14px] font-semibold text-black line-clamp-1 flex-1">
                      {rev.product_name || `Product #${rev.product_id}`}
                    </p>
                    {rev.is_verified_purchase && (
                      <span className="shrink-0 mt-0.5">
                        <VerifiedBadge size="xs" />
                      </span>
                    )}
                  </div>

                  <p className="text-[13px] text-[#ff6e20] leading-none">
                    {'★'.repeat(rev.rating)}
                    {'☆'.repeat(5 - rev.rating)}
                  </p>

                  {rev.title && (
                    <p className="text-[13px] font-semibold text-black line-clamp-1">
                      {rev.title}
                    </p>
                  )}

                  <p className="text-[12.5px] text-[#767676] leading-[1.5] line-clamp-2 flex-1">
                    {rev.comment}
                  </p>

                  <div className="pt-2 mt-auto border-t border-[#f4f4f4] flex items-center justify-between text-[11.5px]">
                    <span className="text-[#8a8a8a]">
                      {formatShortDate(rev.created_at)}
                    </span>
                    <span className="font-semibold text-[#ff6e20] group-hover:underline">
                      View detail
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      ) : toReviewItems.length === 0 ? (
        <div className="bg-white border border-[#ececec] rounded-[18px] p-12 text-center flex flex-col items-center gap-2">
          <span className="w-12 h-12 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
            <Package className="w-5 h-5" />
          </span>
          <p className="text-[15px] font-semibold text-black">
            All caught up!
          </p>
          <p className="text-[13px] text-[#767676]">
            Products from your shipped or completed orders will appear here to review.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {toReviewItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => openWriteModal(item)}
              className="group bg-white border border-[#ececec] hover:border-[#ff6e20]/60 hover:shadow-[0_10px_28px_rgba(0,0,0,0.06)] rounded-[18px] overflow-hidden text-left flex flex-col transition-all"
            >
              <div className="relative h-[168px] w-full bg-[#f7f7f7] overflow-hidden flex items-center justify-center border-b border-[#f0f0f0]">
                {item.productImage ? (
                  <img
                    src={item.productImage}
                    alt={item.productName}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                ) : (
                  <Package className="w-8 h-8 text-[#c4c4c4]" />
                )}
                <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm border border-[#ececec] text-black text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize shadow-sm">
                  {item.orderStatus}
                </span>
              </div>

              <div className="p-4 flex-1 flex flex-col gap-2">
                <p className="text-[14px] font-semibold text-black line-clamp-2">
                  {item.productName}
                </p>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[#767676]">
                  {item.storeName && <span>{item.storeName}</span>}
                  <span>·</span>
                  <span>#{item.orderNumber}</span>
                </div>

                <div className="pt-2.5 mt-auto border-t border-[#f4f4f4] flex items-center justify-between gap-2">
                  <span className="text-[11.5px] text-[#8a8a8a]">
                    {formatShortDate(item.orderDate)}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-[#ffefe6] group-hover:bg-[#ff6e20] text-[#ff6e20] group-hover:text-white text-[12px] font-semibold px-3 py-1 rounded-full transition-colors">
                    <Star className="w-3.5 h-3.5" />
                    <span>Write review</span>
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Review Detail Modal (Reviewed card click) */}
      <DashboardModal
        open={Boolean(selectedReview)}
        onClose={() => {
          setSelectedReview(null);
          setConfirmDeleteId(null);
        }}
        title="Review details"
        subtitle={
          selectedReview
            ? `Submitted on ${formatShortDate(selectedReview.created_at)}`
            : undefined
        }
        widthClass="max-w-[540px]"
        footer={
          selectedReview && (
            <div className="w-full flex items-center justify-between gap-2">
              {confirmDeleteId === selectedReview.id ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={deletingId === selectedReview.id}
                    onClick={() => void handleDelete(selectedReview.id)}
                    className="bg-[#e5322d] hover:bg-[#c8231e] disabled:opacity-60 text-white text-[12.5px] font-semibold px-4 py-2 rounded-full transition-colors"
                  >
                    {deletingId === selectedReview.id
                      ? 'Deleting...'
                      : 'Confirm delete'}
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === selectedReview.id}
                    onClick={() => setConfirmDeleteId(null)}
                    className="bg-white border border-[#ececec] hover:border-black text-[12.5px] font-semibold text-black px-3.5 py-2 rounded-full transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(selectedReview.id)}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#e5322d] hover:bg-[#fdecec] px-3.5 py-2 rounded-full transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete review</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedReview(null);
                  setConfirmDeleteId(null);
                }}
                className="bg-white border border-[#ececec] hover:border-black text-[12.5px] font-semibold text-black px-5 py-2 rounded-full transition-colors"
              >
                Close
              </button>
            </div>
          )
        }
      >
        {selectedReview && (
          <div className="flex flex-col gap-4">
            <div className="bg-[#f7f7f7] border border-[#ececec] rounded-[14px] p-3.5 flex items-center gap-3.5">
              <div className="w-16 h-16 rounded-[12px] overflow-hidden border border-[#ececec] bg-white shrink-0 flex items-center justify-center">
                {selectedReview.product_image ? (
                  <img
                    src={selectedReview.product_image}
                    alt={selectedReview.product_name || 'Product'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-6 h-6 text-[#979797]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold text-black flex items-center gap-1.5">
                  <span className="truncate">
                    {selectedReview.product_name ||
                      `Product #${selectedReview.product_id}`}
                  </span>
                  {selectedReview.is_verified_purchase && (
                    <VerifiedBadge size="xs" />
                  )}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[16px] text-[#ff6e20] leading-none">
                    {'★'.repeat(selectedReview.rating)}
                    {'☆'.repeat(5 - selectedReview.rating)}
                  </span>
                  <span className="text-[12px] font-semibold text-[#ff6e20]">
                    {selectedReview.rating}/5 ·{' '}
                    {REVIEW_RATING_LABELS[selectedReview.rating] || 'Rated'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              {selectedReview.title && (
                <h3 className="text-[15px] font-semibold text-black">
                  {selectedReview.title}
                </h3>
              )}
              <p className="text-[13.5px] text-[#555555] leading-[1.65] whitespace-pre-wrap">
                {selectedReview.comment}
              </p>
            </div>
          </div>
        )}
      </DashboardModal>

      {/* Write Review Popup Modal (To review card click) */}
      <DashboardModal
        open={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        title="Write a product review"
        subtitle="Share your experience to help other Kova shoppers."
        widthClass="max-w-[540px]"
        footer={
          <>
            <button
              type="button"
              onClick={() => setReviewTarget(null)}
              className="bg-white border border-[#ececec] hover:border-black text-[12.5px] font-semibold text-black px-4.5 py-2 rounded-full transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="my-reviews-write-form"
              disabled={submitting}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-5 py-2 rounded-full transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit review'}
            </button>
          </>
        }
      >
        {reviewTarget && (
          <form
            id="my-reviews-write-form"
            onSubmit={handleSubmitReview}
            className="flex flex-col gap-4"
          >
            <div className="bg-[#f7f7f7] border border-[#ececec] rounded-[14px] p-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-[10px] overflow-hidden border border-[#ececec] bg-white shrink-0 flex items-center justify-center">
                {reviewTarget.productImage ? (
                  <img
                    src={reviewTarget.productImage}
                    alt={reviewTarget.productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-5 h-5 text-[#979797]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-black truncate">
                  {reviewTarget.productName}
                </p>
                <p className="text-[12px] text-[#767676] truncate">
                  {reviewTarget.storeName
                    ? `Sold by ${reviewTarget.storeName} · `
                    : ''}
                  #{reviewTarget.orderNumber}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-semibold text-black">
                  Your rating
                </span>
                <span className="text-[12px] font-semibold text-[#ff6e20]">
                  {displayRating}/5 · {REVIEW_RATING_LABELS[displayRating]}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => setRating(star)}
                    aria-label={`Rate ${star} out of 5`}
                    className={`text-[30px] leading-none transition-transform hover:scale-110 ${
                      star <= displayRating
                        ? 'text-[#ff6e20]'
                        : 'text-[#dfdfdf]'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-black">
                Review title{' '}
                <span className="font-normal text-[#8a8a8a]">(optional)</span>
              </span>
              <input
                type="text"
                maxLength={255}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Summarize your experience..."
                className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] text-black outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-black">
                Your review
              </span>
              <textarea
                required
                minLength={5}
                maxLength={2000}
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share what you liked about product quality, packaging, and delivery..."
                className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13px] text-black outline-none resize-none"
              />
            </label>
          </form>
        )}
      </DashboardModal>
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
