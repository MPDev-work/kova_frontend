import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { Check, Loader2, Package, Star, Trash2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useConfirmDelete } from '../../context/ConfirmDeleteContext';
import { ApiError, authApi, customerApi } from '../../services/api';
import type { Address, ReviewItem } from '../../types/marketplace';
import { formatShortDate } from '../../utils/currency';
import { DashboardModal } from '../../components/DashboardPrimitives';
import { ContactVerificationCard } from '../../components/ContactVerificationCard';
import { ProductCard } from '../../components/ProductCard';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { CambodiaLocationSelector } from '../../components/CambodiaLocationSelector';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { PasswordInput } from '../../components/PasswordInput';

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

  const isProfileDirty =
    name.trim() !== (user.name || '').trim() ||
    phone.trim() !== (user.phone || '').trim();

  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <h1 className="text-[22px] font-bold text-black leading-[1.35]">
          Customer profile &amp; general settings
        </h1>
        <p className="text-[12.5px] text-[#767676] mt-0.5">
          Manage your Kova account identity, profile photo, and contact
          information.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white border border-[#ececec] rounded-[16px] px-5 py-[18px] flex flex-col gap-4 max-w-[820px]"
      >
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
              className="h-[42px] bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[12.5px] text-black outline-none"
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
              className="h-[42px] bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[12.5px] text-black outline-none"
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
              className="h-[42px] bg-[#f7f7f7] border border-[#ececec] rounded-full px-4 text-[12.5px] text-[#767676] outline-none"
            />
          </label>
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-[#f1f1f1]">
          <button
            type="submit"
            disabled={!isProfileDirty || saving}
            className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors ${
              isProfileDirty
                ? 'bg-[#ff6e20] hover:bg-[#e85d12] text-white cursor-pointer disabled:opacity-60'
                : 'bg-[#e7f6e7] text-[#029500] cursor-default'
            }`}
          >
            {saving ? (
              <span>Saving...</span>
            ) : isProfileDirty ? (
              <span>Save changes</span>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved</span>
              </>
            )}
          </button>
        </div>
      </form>

      <div className="max-w-[820px]">
        <ContactVerificationCard phoneDraft={phone} />
      </div>
    </div>
  );
}

// Add / Edit Address Modal (used inside AddressBookPage)
function AddressFormModal({
  open,
  editingAddress,
  onClose,
}: {
  open: boolean;
  editingAddress: Address | null;
  onClose: () => void;
}) {
  const { addAddress, updateAddress, user, showToast } = useStore();
  const isEdit = Boolean(editingAddress);

  const [fullName, setFullName] = useState(
    editingAddress?.full_name || user?.name || '',
  );
  const [phone, setPhone] = useState(
    editingAddress?.phone || user?.phone || '',
  );
  const [province, setProvince] = useState(
    editingAddress?.province || 'Phnom Penh',
  );
  const [district, setDistrict] = useState(
    editingAddress ? editingAddress.district || '' : 'Chamkar Mon',
  );
  const [commune, setCommune] = useState(
    editingAddress ? editingAddress.commune || '' : 'Tonle Basak',
  );
  const [street, setStreet] = useState(editingAddress?.address_line_1 || '');
  const [isDefault, setIsDefault] = useState(
    editingAddress ? Boolean(editingAddress.is_default) : true,
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingAddress) {
        await updateAddress(editingAddress.id, {
          type: editingAddress.type || 'shipping',
          full_name: fullName,
          phone,
          province,
          district: district || null,
          commune: commune || null,
          address_line_1: street,
          address_line_2: editingAddress.address_line_2 ?? null,
          postal_code: editingAddress.postal_code ?? null,
          is_default: isDefault,
        });
      } else {
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
      }
      onClose();
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : isEdit
            ? 'We could not update this address right now.'
            : 'We could not save this address right now.',
      );
    } finally {
      setSaving(false);
    }
  };

  const formId = 'customer-address-modal-form';

  return (
    <DashboardModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit address' : 'Add a new address'}
      subtitle={
        isEdit
          ? 'Update your saved delivery location.'
          : 'Save a delivery location to your account.'
      }
      widthClass="max-w-[680px]"
      footer={
        <div className="w-full flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="bg-white border border-[#ececec] hover:border-black text-[13px] font-semibold text-black px-5 py-2 rounded-full transition-colors cursor-pointer disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={saving}
            className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[13px] font-semibold px-6 py-2 rounded-full transition-colors cursor-pointer"
          >
            {saving
              ? isEdit
                ? 'Updating...'
                : 'Saving...'
              : isEdit
                ? 'Update address'
                : 'Save address'}
          </button>
        </div>
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-black">
            Full name
          </span>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-[42px] border border-[#ececec] rounded-full px-4 text-[13px] outline-none focus:border-[#ff6e20]"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-black">
            Phone number
          </span>
          <input
            type="text"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-[42px] border border-[#ececec] rounded-full px-4 text-[13px] outline-none focus:border-[#ff6e20]"
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
          <span className="text-[12px] font-semibold text-black">
            Street address
          </span>
          <input
            type="text"
            required
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="House #, Street..."
            className="h-[42px] border border-[#ececec] rounded-full px-4 text-[13px] outline-none focus:border-[#ff6e20]"
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
      </form>
    </DashboardModal>
  );
}

// Address Book
export function AddressBookPage() {
  const { addresses, setDefaultAddress, deleteAddress } = useStore();
  const { confirmDelete } = useConfirmDelete();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hiddenAddressIds, setHiddenAddressIds] = useState<number[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  const visibleAddresses = addresses.filter(
    (addr) => !hiddenAddressIds.includes(addr.id),
  );

  const openAddModal = () => {
    setEditingAddress(null);
    setModalOpen(true);
  };

  const openEditModal = (addr: Address) => {
    setEditingAddress(addr);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingAddress(null);
    if (searchParams.has('add') || searchParams.has('edit')) {
      const next = new URLSearchParams(searchParams);
      next.delete('add');
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
  };

  const addParam = searchParams.get('add');
  const editParam = searchParams.get('edit');
  const urlEditAddress = editParam
    ? addresses.find((a) => a.id === Number(editParam)) || null
    : null;
  const effectiveModalOpen =
    modalOpen ||
    addParam === '1' ||
    addParam === 'true' ||
    Boolean(urlEditAddress);
  const effectiveEditingAddress = modalOpen ? editingAddress : urlEditAddress;

  const handleDeleteAddress = (addr: Address) => {
    const label = addr.full_name || addr.address_line_1 || 'saved address';
    confirmDelete({
      title: 'Delete address?',
      description: `Remove "${label}" from your saved delivery addresses?`,
      itemLabel: label,
      onOptimisticRemove: () => {
        setHiddenAddressIds((prev) => [...prev, addr.id]);
      },
      onUndo: () => {
        setHiddenAddressIds((prev) => prev.filter((id) => id !== addr.id));
      },
      onCommit: async () => {
        await deleteAddress(addr.id);
        setHiddenAddressIds((prev) => prev.filter((id) => id !== addr.id));
      },
    });
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black">Address book</h1>
          <p className="text-[12.5px] text-[#767676] mt-0.5">
            Manage your Phnom Penh and provincial delivery addresses.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[12.5px] font-semibold px-4 py-2 rounded-full transition-colors cursor-pointer"
        >
          Add address
        </button>
      </div>

      {visibleAddresses.length === 0 ? (
        <div className="bg-white border border-[#ececec] rounded-[16px] p-10 text-center flex flex-col items-center gap-3">
          <p className="text-[15px] font-semibold text-black">
            No saved addresses yet
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full transition-colors cursor-pointer"
          >
            Add address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleAddresses.map((addr) => (
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
                  <button
                    type="button"
                    onClick={() => openEditModal(addr)}
                    className="text-[12px] font-semibold text-[#ff6e20] hover:underline cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAddress(addr)}
                    className="text-[12px] font-semibold text-[#e5322d] hover:underline cursor-pointer"
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
                  className="mt-2 self-start bg-white border border-[#ececec] hover:border-[#ff6e20] text-[12px] font-semibold text-black px-4 py-1.5 rounded-full cursor-pointer"
                >
                  Set as default
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {effectiveModalOpen && (
        <AddressFormModal
          key={effectiveEditingAddress?.id ?? 'new'}
          open
          editingAddress={effectiveEditingAddress}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

// Route redirects so /account/addresses/new and /account/addresses/:id/edit open the modal
export function AddAddressPage() {
  return <Navigate to="/account/addresses?add=1" replace />;
}

export function EditAddressPage() {
  const { addressId } = useParams<{ addressId: string }>();
  return (
    <Navigate
      to={
        addressId
          ? `/account/addresses?edit=${encodeURIComponent(addressId)}`
          : '/account/addresses'
      }
      replace
    />
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
  const { confirmDelete } = useConfirmDelete();
  const [activeTab, setActiveTab] = useState<'reviewed' | 'to_review'>(
    'reviewed',
  );
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
  const [hiddenReviewIds, setHiddenReviewIds] = useState<number[]>([]);

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

  const visibleReviews = useMemo(
    () => reviews.filter((r) => !hiddenReviewIds.includes(r.id)),
    [reviews, hiddenReviewIds],
  );

  const handleDelete = (review: ReviewItem) => {
    const label = review.product_name || review.title || 'your review';
    confirmDelete({
      title: 'Delete review?',
      description: `Remove your review for "${label}"?`,
      itemLabel: label,
      onOptimisticRemove: () => {
        setHiddenReviewIds((prev) => [...prev, review.id]);
        if (selectedReview?.id === review.id) {
          setSelectedReview(null);
        }
      },
      onUndo: () => {
        setHiddenReviewIds((prev) => prev.filter((id) => id !== review.id));
      },
      onCommit: async () => {
        await deleteReview(review.id);
        setHiddenReviewIds((prev) => prev.filter((id) => id !== review.id));
      },
    });
  };

  const displayRating = hoverRating ?? rating;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black">My reviews</h1>
          <p className="text-[12.5px] text-[#767676] mt-0.5">
            Track products waiting for your feedback and review your past
            ratings.
          </p>
        </div>
      </div>

      {/* Top Switch Bar: Reviewed | To review */}
      <div className="bg-white border border-[#ececec] rounded-full p-1.5 inline-flex items-center gap-1.5 self-start">
        <button
          type="button"
          onClick={() => setActiveTab('reviewed')}
          className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'reviewed'
              ? 'bg-[#ff6e20] text-white'
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
            {visibleReviews.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('to_review')}
          className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'to_review'
              ? 'bg-[#ff6e20] text-white'
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
        visibleReviews.length === 0 ? (
          <div className="bg-white border border-[#ececec] rounded-[18px] p-12 text-center flex flex-col items-center gap-2">
            <span className="w-12 h-12 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
              <Star className="w-5 h-5" />
            </span>
            <p className="text-[15px] font-semibold text-black">
              No reviews yet
            </p>
            <p className="text-[13px] text-[#767676]">
              Switch to &ldquo;To review&rdquo; to rate your shipped or
              completed orders.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleReviews.map((rev) => (
              <button
                key={rev.id}
                type="button"
                onClick={() => setSelectedReview(rev)}
                className="group bg-white border border-[#ececec] hover:border-[#ff6e20]/60 hover:shadow-[0_10px_28px_rgba(0,0,0,0.06)] rounded-[18px] overflow-hidden text-left flex items-center justify-between transition-all"
              >
                <div className="relative h-[120px] overflow-hidden flex items-center justify-center rounded-r-[18px]">
                  {rev.product_image ? (
                    <img
                      src={rev.product_image}
                      alt={rev.product_name || 'Product'}
                      className="w-full h-full group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  ) : (
                    <Package className="w-8 h-8 text-[#c4c4c4]" />
                  )}
                </div>
                <div className="p-2.5 flex-1 flex flex-col gap-1">
                  <div className="flex items-start gap-1.5">
                    <p className="text-[14px] font-semibold text-black line-clamp-2 flex-1">
                      {rev.product_name || `Product #${rev.product_id}`}
                    </p>
                  </div>

                  <p className="text-[13px] text-[#ff6e20] leading-none">
                    {rev.rating} {'★'.repeat(rev.rating)}
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
          <p className="text-[15px] font-semibold text-black">All caught up!</p>
          <p className="text-[13px] text-[#767676]">
            Products from your shipped or completed orders will appear here to
            review.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {toReviewItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => openWriteModal(item)}
              className="group bg-white border border-[#ececec] hover:border-[#ff6e20]/60 hover:shadow-[0_10px_28px_rgba(0,0,0,0.06)] rounded-[18px] overflow-hidden text-left flex items-center justify-between transition-all"
            >
              <div className="relative h-[120px] w-[120px] shrink-0 bg-[#f7f7f7] overflow-hidden flex items-center justify-center rounded-r-[18px]">
                {item.productImage ? (
                  <img
                    src={item.productImage}
                    alt={item.productName}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                ) : (
                  <Package className="w-8 h-8 text-[#c4c4c4]" />
                )}
              </div>

              <div className="p-2.5 flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-semibold text-black line-clamp-2 flex-1">
                    {item.productName}
                  </p>
                  <span className="shrink-0 bg-[#f4f4f4] text-[#555555] text-[10.5px] font-semibold px-2 py-0.5 rounded-full capitalize">
                    {item.orderStatus}
                  </span>
                </div>

                <p className="text-[12.5px] text-[#767676] truncate">
                  {item.storeName ? `${item.storeName} · ` : ''}#
                  {item.orderNumber}
                </p>

                <p className="text-[12.5px] text-[#ff6e20]/80 leading-none">
                  ☆☆☆☆☆
                </p>

                <div className="pt-2 mt-auto border-t border-[#f4f4f4] flex items-center justify-between text-[11.5px]">
                  <span className="text-[#8a8a8a]">
                    {formatShortDate(item.orderDate)}
                  </span>
                  <span className="font-semibold text-[#ff6e20] group-hover:underline">
                    Write review
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
        onClose={() => setSelectedReview(null)}
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
              <button
                type="button"
                onClick={() => handleDelete(selectedReview)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#e5322d] hover:bg-[#fdecec] px-3.5 py-2 rounded-full transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete review</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedReview(null)}
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
                className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] text-black outline-none"
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
      <div>
        <h1 className="text-[22px] font-bold text-black">Write a review</h1>
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
              className="h-[42px] border border-[#ececec] rounded-full px-4 text-[13px] bg-white"
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
      <div>
        <h1 className="text-[22px] font-bold text-black">
          Notification preferences
        </h1>
        <p className="text-[12.5px] text-[#767676] mt-0.5">
          Control which alerts Kova sends you.
        </p>
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
  const { user, refreshUser, deactivateAccount, showToast } = useStore();
  const navigate = useNavigate();

  // Change Email state
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailCodeSentTo, setEmailCodeSentTo] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailCooldown, setEmailCooldown] = useState(0);

  // Change Phone state
  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneCodeSentTo, setPhoneCodeSentTo] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  // Deactivate Account state
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateChannel, setDeactivateChannel] = useState<'email' | 'phone'>(
    'email',
  );
  const [deactivateSentTo, setDeactivateSentTo] = useState<string | null>(null);
  const [deactivateCode, setDeactivateCode] = useState('');
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deactivateCooldown, setDeactivateCooldown] = useState(0);

  useEffect(() => {
    if (emailCooldown <= 0 && phoneCooldown <= 0 && deactivateCooldown <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setEmailCooldown((v) => (v > 0 ? v - 1 : 0));
      setPhoneCooldown((v) => (v > 0 ? v - 1 : 0));
      setDeactivateCooldown((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [emailCooldown, phoneCooldown, deactivateCooldown]);

  if (!user) return null;

  const hasPhone = Boolean(user.phone && user.phone.trim());

  const handleSendEmailChange = async () => {
    if (!newEmail.trim()) {
      setEmailError('Please enter your new email address.');
      return;
    }
    setEmailBusy(true);
    setEmailError(null);
    try {
      const res = await customerApi.sendContactChangeCode('email', newEmail);
      const destination = res.data.sent_to || user.email;
      setEmailCodeSentTo(destination);
      setEmailCode('');
      setEmailCooldown(60);
      showToast(res.message || `Verification code sent to ${destination}.`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'We could not send the verification code right now.';
      setEmailError(msg);
    } finally {
      setEmailBusy(false);
    }
  };

  const handleConfirmEmailChange = async () => {
    if (!/^\d{6}$/.test(emailCode.trim())) {
      setEmailError('Please enter the 6-digit verification code.');
      return;
    }
    setEmailBusy(true);
    setEmailError(null);
    try {
      const res = await customerApi.confirmContactChangeCode(
        'email',
        emailCode,
      );
      await refreshUser();
      setEditingEmail(false);
      setNewEmail('');
      setEmailCodeSentTo(null);
      setEmailCode('');
      setEmailCooldown(0);
      showToast(res.message || 'Email address updated and verified.');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'That verification code is not correct. Please check and try again.';
      setEmailError(msg);
    } finally {
      setEmailBusy(false);
    }
  };

  const handleSendPhoneChange = async () => {
    if (!newPhone.trim()) {
      setPhoneError('Please enter your new phone number.');
      return;
    }
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      const res = await customerApi.sendContactChangeCode('phone', newPhone);
      setPhoneCodeSentTo(res.data.target);
      setPhoneCode('');
      setPhoneCooldown(60);
      showToast(res.message || `Verification code sent to ${res.data.target}.`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'We could not send the SMS verification code right now.';
      setPhoneError(msg);
    } finally {
      setPhoneBusy(false);
    }
  };

  const handleConfirmPhoneChange = async () => {
    if (!/^\d{6}$/.test(phoneCode.trim())) {
      setPhoneError('Please enter the 6-digit verification code.');
      return;
    }
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      const res = await customerApi.confirmContactChangeCode(
        'phone',
        phoneCode,
      );
      await refreshUser();
      setEditingPhone(false);
      setNewPhone('');
      setPhoneCodeSentTo(null);
      setPhoneCode('');
      setPhoneCooldown(0);
      showToast(res.message || 'Phone number updated and verified.');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'That verification code is not correct. Please check and try again.';
      setPhoneError(msg);
    } finally {
      setPhoneBusy(false);
    }
  };

  const handleSendDeactivateCode = async () => {
    setDeactivateBusy(true);
    setDeactivateError(null);
    try {
      const res = await customerApi.sendSecurityActionCode(
        'deactivate',
        deactivateChannel,
      );
      setDeactivateSentTo(res.data.target);
      setDeactivateCode('');
      setDeactivateCooldown(60);
      showToast(res.message || `Verification code sent to ${res.data.target}.`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'We could not send the verification code right now.';
      setDeactivateError(msg);
    } finally {
      setDeactivateBusy(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!/^\d{6}$/.test(deactivateCode.trim())) {
      setDeactivateError('Please enter the 6-digit verification code.');
      return;
    }
    setDeactivateBusy(true);
    setDeactivateError(null);
    try {
      await deactivateAccount(deactivateCode.trim());
      navigate('/login', { replace: true });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'We could not deactivate your account right now.';
      setDeactivateError(msg);
    } finally {
      setDeactivateBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <h1 className="text-[22px] font-bold text-black">Account security</h1>
        <p className="text-[12.5px] text-[#767676] mt-0.5">
          Manage your verified email, phone number, password, and account
          lifecycle.
        </p>
      </div>

      {/* Sign-in & Contact Credentials */}
      <div className="bg-white border border-[#ececec] rounded-[16px] px-5 py-[18px] flex flex-col gap-4 max-w-[820px]">
        {/* Email Row */}
        <div className="flex flex-col gap-3 pb-4 border-b border-[#ececec]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-black">
                Email address
              </p>
              <p className="text-[12.5px] text-[#767676] truncate">
                {user.email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingEmail((v) => !v);
                setEmailError(null);
                setEmailCodeSentTo(null);
                setEmailCode('');
              }}
              className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full transition-colors cursor-pointer"
            >
              {editingEmail ? 'Close' : 'Change email'}
            </button>
          </div>

          {editingEmail && (
            <div className="bg-[#fafafa] border border-[#ececec] rounded-[14px] p-4 flex flex-col gap-3">
              <p className="text-[12.5px] text-[#555555]">
                Enter your new email address. We&rsquo;ll send a 6-digit
                verification code to your current email ({user.email}) to
                confirm before updating.
              </p>
              {emailError && (
                <p className="text-[12px] font-medium text-[#e5322d] bg-[#fdecec] border border-[#e5322d]/25 rounded-[10px] px-3 py-2">
                  {emailError}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new-email@example.com"
                  className="flex-1 min-w-[210px] h-[42px] bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] outline-none"
                />
                <button
                  type="button"
                  disabled={emailBusy || emailCooldown > 0 || !newEmail.trim()}
                  onClick={() => void handleSendEmailChange()}
                  className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-50 text-white text-[12.5px] font-semibold px-4.5 py-2.5 rounded-full transition-colors cursor-pointer"
                >
                  {emailBusy && !emailCodeSentTo
                    ? 'Sending...'
                    : emailCooldown > 0
                      ? `Resend (${emailCooldown}s)`
                      : emailCodeSentTo
                        ? 'Resend code'
                        : 'Send code'}
                </button>
              </div>
              {emailCodeSentTo && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={emailCode}
                    onChange={(e) =>
                      setEmailCode(
                        e.target.value.replace(/\D/g, '').slice(0, 6),
                      )
                    }
                    placeholder={`6-digit code sent to ${emailCodeSentTo}`}
                    className="flex-1 min-w-[210px] h-[42px] bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] font-mono tracking-widest outline-none"
                  />
                  <button
                    type="button"
                    disabled={emailBusy || emailCode.length !== 6}
                    onClick={() => void handleConfirmEmailChange()}
                    className="bg-black hover:bg-black/85 disabled:opacity-45 text-white text-[12.5px] font-semibold px-5 py-2.5 rounded-full transition-colors cursor-pointer"
                  >
                    {emailBusy ? 'Verifying...' : 'Verify & update'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Phone Number Row */}
        <div className="flex flex-col gap-3 pb-4 border-b border-[#ececec]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-black">
                Phone number
              </p>
              <p className="text-[12.5px] text-[#767676] truncate">
                {user.phone || 'No phone number linked yet'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingPhone((v) => !v);
                setPhoneError(null);
                setPhoneCodeSentTo(null);
                setPhoneCode('');
              }}
              className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full transition-colors cursor-pointer"
            >
              {editingPhone ? 'Close' : hasPhone ? 'Change phone' : 'Add phone'}
            </button>
          </div>

          {editingPhone && (
            <div className="bg-[#fafafa] border border-[#ececec] rounded-[14px] p-4 flex flex-col gap-3">
              <p className="text-[12.5px] text-[#555555]">
                Enter your new phone number (must not be used by another
                account). We&rsquo;ll send a 6-digit SMS code to verify before
                saving.
              </p>
              {phoneError && (
                <p className="text-[12px] font-medium text-[#e5322d] bg-[#fdecec] border border-[#e5322d]/25 rounded-[10px] px-3 py-2">
                  {phoneError}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="012 345 678 or +855 ..."
                  className="flex-1 min-w-[210px] h-[42px] bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] outline-none"
                />
                <button
                  type="button"
                  disabled={phoneBusy || phoneCooldown > 0 || !newPhone.trim()}
                  onClick={() => void handleSendPhoneChange()}
                  className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-50 text-white text-[12.5px] font-semibold px-4.5 py-2.5 rounded-full transition-colors cursor-pointer"
                >
                  {phoneBusy && !phoneCodeSentTo
                    ? 'Sending...'
                    : phoneCooldown > 0
                      ? `Resend (${phoneCooldown}s)`
                      : phoneCodeSentTo
                        ? 'Resend code'
                        : 'Send code'}
                </button>
              </div>
              {phoneCodeSentTo && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={phoneCode}
                    onChange={(e) =>
                      setPhoneCode(
                        e.target.value.replace(/\D/g, '').slice(0, 6),
                      )
                    }
                    placeholder={`6-digit code sent to ${phoneCodeSentTo}`}
                    className="flex-1 min-w-[210px] h-[42px] bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] font-mono tracking-widest outline-none"
                  />
                  <button
                    type="button"
                    disabled={phoneBusy || phoneCode.length !== 6}
                    onClick={() => void handleConfirmPhoneChange()}
                    className="bg-black hover:bg-black/85 disabled:opacity-45 text-white text-[12.5px] font-semibold px-5 py-2.5 rounded-full transition-colors cursor-pointer"
                  >
                    {phoneBusy ? 'Verifying...' : 'Verify & update'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Password Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#ececec]">
          <div>
            <p className="text-[14px] font-semibold text-black">Password</p>
            <p className="text-[12.5px] text-[#767676]">
              Update your Kova account password or request a password reset.
            </p>
          </div>
          <Link
            to="/account/password"
            className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-[12.5px] font-semibold text-black px-4 py-2 rounded-full transition-colors"
          >
            Change password
          </Link>
        </div>

        {/* Deactivate Account Row */}
        <div className="flex flex-col gap-3 pb-4 border-b border-[#ececec]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[14px] font-semibold text-black">
                Deactivate account
              </p>
              <p className="text-[12.5px] text-[#767676]">
                Temporarily disable your account. You can reactivate anytime by
                signing back in.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDeactivateOpen((v) => !v);
                setDeactivateError(null);
                setDeactivateSentTo(null);
                setDeactivateCode('');
              }}
              className="bg-[#fff7ed] hover:bg-[#ffefe6] border border-[#ff6e20]/30 text-[#ff6e20] text-[12.5px] font-semibold px-4 py-2 rounded-full transition-colors cursor-pointer"
            >
              {deactivateOpen ? 'Close' : 'Deactivate account'}
            </button>
          </div>

          {deactivateOpen && (
            <div className="bg-[#fafafa] border border-[#ececec] rounded-[14px] p-4 flex flex-col gap-3">
              <p className="text-[12.5px] text-[#555555]">
                Verify your identity before deactivating your account. Your
                profile and data will be preserved until you sign back in.
              </p>

              {deactivateError && (
                <p className="text-[12px] font-medium text-[#e5322d] bg-[#fdecec] border border-[#e5322d]/25 rounded-[10px] px-3 py-2">
                  {deactivateError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeactivateChannel('email');
                    setDeactivateSentTo(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors cursor-pointer ${
                    deactivateChannel === 'email'
                      ? 'bg-[#ffefe6] border-[#ff6e20] text-[#ff6e20]'
                      : 'bg-white border-[#ececec] text-[#555555]'
                  }`}
                >
                  Verify via Email ({user.email})
                </button>
                {hasPhone && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeactivateChannel('phone');
                      setDeactivateSentTo(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors cursor-pointer ${
                      deactivateChannel === 'phone'
                        ? 'bg-[#ffefe6] border-[#ff6e20] text-[#ff6e20]'
                        : 'bg-white border-[#ececec] text-[#555555]'
                    }`}
                  >
                    Verify via Phone ({user.phone})
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={deactivateBusy || deactivateCooldown > 0}
                  onClick={() => void handleSendDeactivateCode()}
                  className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-50 text-white text-[12.5px] font-semibold px-4.5 py-2.5 rounded-full transition-colors cursor-pointer"
                >
                  {deactivateBusy && !deactivateSentTo
                    ? 'Sending...'
                    : deactivateCooldown > 0
                      ? `Resend (${deactivateCooldown}s)`
                      : deactivateSentTo
                        ? 'Resend code'
                        : 'Send verification code'}
                </button>
              </div>

              {deactivateSentTo && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={deactivateCode}
                    onChange={(e) =>
                      setDeactivateCode(
                        e.target.value.replace(/\D/g, '').slice(0, 6),
                      )
                    }
                    placeholder={`6-digit code sent to ${deactivateSentTo}`}
                    className="flex-1 min-w-[210px] h-[42px] bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] font-mono tracking-widest outline-none"
                  />
                  <button
                    type="button"
                    disabled={deactivateBusy || deactivateCode.length !== 6}
                    onClick={() => void handleConfirmDeactivate()}
                    className="bg-black hover:bg-black/85 disabled:opacity-45 text-white text-[12.5px] font-semibold px-5 py-2.5 rounded-full transition-colors cursor-pointer"
                  >
                    {deactivateBusy ? 'Deactivating...' : 'Verify & deactivate'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete Account Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold text-[#e5322d]">
              Delete account
            </p>
            <p className="text-[12.5px] text-[#767676]">
              Schedule permanent deletion with a 30-day grace period (sign back
              in within 30 days to cancel).
            </p>
          </div>
          <Link
            to="/account/delete"
            className="bg-[#fdecec] hover:bg-[#f9dada] text-[#e5322d] text-[12.5px] font-semibold px-4 py-2 rounded-full transition-colors"
          >
            Delete account
          </Link>
        </div>
      </div>
    </div>
  );
}

// Change Password (with integrated Forgot Password flow)
export function ChangePasswordPage() {
  const { user, changePassword } = useStore();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    current?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [shakeKey, setShakeKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [resetFeedback, setResetFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResetCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resetCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: {
      current?: string;
      password?: string;
      confirm?: string;
    } = {};

    if (!currentPassword) {
      nextErrors.current = 'Please enter your current password.';
    }
    if (password.length < 8) {
      nextErrors.password = 'Your new password must be at least 8 characters.';
    }
    if (password !== confirm) {
      nextErrors.confirm = "Your passwords don't match.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setShakeKey((k) => k + 1);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      await changePassword({
        current_password: currentPassword,
        password,
        password_confirmation: confirm,
      });
      navigate('/account/security');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'We could not update your password. Please try again.';
      if (
        err instanceof ApiError &&
        (err.errors?.current_password || /current password/i.test(msg))
      ) {
        setFieldErrors({ current: msg });
      } else if (err instanceof ApiError && err.errors?.password) {
        setFieldErrors({ password: msg });
      } else {
        setFieldErrors({ current: msg });
      }
      setShakeKey((k) => k + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!user?.email || sendingReset || resetCooldown > 0) return;
    setSendingReset(true);
    setResetFeedback(null);
    try {
      const res = await authApi.forgotPassword(user.email);
      const msg =
        res.message ||
        `We sent a password reset link to ${user.email}. Please check your inbox and spam folder.`;
      setResetFeedback({ ok: true, message: msg });
      setResetCooldown(60);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'We could not send the reset email right now. Please try again.';
      const waitMatch = msg.match(/wait (\d+) seconds?/i);
      if (waitMatch) {
        setResetCooldown(Number(waitMatch[1]));
      }
      setResetFeedback({ ok: false, message: msg });
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <h1 className="text-[22px] font-bold text-black">Change password</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-white border border-[#ececec] rounded-[16px] p-6 max-w-[540px] flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <PasswordInput
            label="Current password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              if (fieldErrors.current) {
                setFieldErrors((prev) => ({ ...prev, current: undefined }));
              }
            }}
            placeholder="Enter your current password"
            error={fieldErrors.current}
            shakeKey={shakeKey}
            inputClassName="text-[13px]"
          />
          <div className="flex justify-end px-1">
            <button
              type="button"
              disabled={sendingReset || resetCooldown > 0 || !user?.email}
              onClick={() => void handleForgotPassword()}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#ff6e20] hover:underline disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {sendingReset && (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              )}
              <span>
                {sendingReset
                  ? 'Sending reset link...'
                  : resetCooldown > 0
                    ? `Resend link in ${resetCooldown}s`
                    : 'Forgot password?'}
              </span>
            </button>
          </div>
        </div>

        {resetFeedback && (
          <div
            className={`rounded-[12px] px-4 py-2.5 text-[12.5px] font-medium border ${
              resetFeedback.ok
                ? 'bg-[#e7f6e7] border-[#029500]/25 text-[#029500]'
                : 'bg-[#fdecec] border-[#e5322d]/25 text-[#e5322d]'
            }`}
          >
            {resetFeedback.message}
          </div>
        )}

        <PasswordInput
          label="New password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldErrors.password) {
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }
          }}
          placeholder="New password (min 8 characters)"
          error={fieldErrors.password}
          shakeKey={shakeKey}
          inputClassName="text-[13px]"
        />
        <PasswordInput
          label="Confirm new password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            if (fieldErrors.confirm) {
              setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
            }
          }}
          placeholder="Confirm new password"
          error={fieldErrors.confirm}
          shakeKey={shakeKey}
          inputClassName="text-[13px]"
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
            className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[13px] font-semibold px-6 py-2.5 rounded-full cursor-pointer"
          >
            {saving ? 'Updating...' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  );
}

// Delete Account (Verified via Email/Phone OTP + 30-day scheduled deletion grace period)
export function DeleteAccountPage() {
  const { user, deleteAccount, showToast } = useStore();
  const navigate = useNavigate();

  const [channel, setChannel] = useState<'email' | 'phone'>('email');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  if (!user) return null;

  const hasPhone = Boolean(user.phone && user.phone.trim());

  const handleSendCode = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await customerApi.sendSecurityActionCode('delete', channel);
      setSentTo(res.data.target);
      setCode('');
      setCooldown(60);
      showToast(res.message || `Verification code sent to ${res.data.target}.`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'We could not send the verification code right now.';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const handleScheduleDelete = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Please enter the 6-digit verification code first.');
      return;
    }
    if (confirmText !== 'DELETE') {
      setError('Please type DELETE to confirm.');
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount(code.trim());
      navigate('/login', { replace: true });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'We could not schedule account deletion right now.';
      setError(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <h1 className="text-[22px] font-bold text-[#e5322d]">
          Delete your Kova account
        </h1>
      </div>

      <div className="bg-white border border-[#e5322d]/30 rounded-[16px] p-6 max-w-[640px] flex flex-col gap-4">
        <div className="bg-[#fff7ed] border border-[#ff6e20]/25 rounded-[14px] p-4 flex flex-col gap-1">
          <p className="text-[13.5px] font-semibold text-black">
            30-day recovery grace period
          </p>
          <p className="text-[12.5px] text-[#555555] leading-[1.6]">
            Your account will <strong>not</strong> be erased immediately. It
            will be scheduled for permanent deletion in <strong>30 days</strong>
            . If you change your mind and sign back in within 30 days, your
            deletion request is cancelled automatically. If you do not sign in
            within 30 days, your account will be permanently deleted from our
            system.
          </p>
        </div>

        {error && (
          <p className="text-[12.5px] font-medium text-[#e5322d] bg-[#fdecec] border border-[#e5322d]/25 rounded-[12px] px-4 py-2.5">
            {error}
          </p>
        )}

        {/* Step 1: Verify Identity */}
        <div className="flex flex-col gap-2.5 pt-1">
          <p className="text-[13px] font-semibold text-black">
            1. Verify your identity
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setChannel('email');
                setSentTo(null);
              }}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors cursor-pointer ${
                channel === 'email'
                  ? 'bg-[#ffefe6] border-[#ff6e20] text-[#ff6e20]'
                  : 'bg-white border-[#ececec] text-[#555555]'
              }`}
            >
              Email ({user.email})
            </button>
            {hasPhone && (
              <button
                type="button"
                onClick={() => {
                  setChannel('phone');
                  setSentTo(null);
                }}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors cursor-pointer ${
                  channel === 'phone'
                    ? 'bg-[#ffefe6] border-[#ff6e20] text-[#ff6e20]'
                    : 'bg-white border-[#ececec] text-[#555555]'
                }`}
              >
                Phone ({user.phone})
              </button>
            )}
            <button
              type="button"
              disabled={sending || cooldown > 0}
              onClick={() => void handleSendCode()}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-50 text-white text-[12.5px] font-semibold px-4.5 py-2 rounded-full transition-colors cursor-pointer"
            >
              {sending
                ? 'Sending...'
                : cooldown > 0
                  ? `Resend (${cooldown}s)`
                  : sentTo
                    ? 'Resend code'
                    : 'Send verification code'}
            </button>
          </div>

          {sentTo && (
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              placeholder={`Enter 6-digit code sent to ${sentTo}`}
              className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] font-mono tracking-widest outline-none"
            />
          )}
        </div>

        {/* Step 2: Confirm DELETE */}
        <div className="flex flex-col gap-2 pt-1">
          <p className="text-[13px] font-semibold text-black">
            2. Type <span className="text-[#e5322d]">DELETE</span> to confirm
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="h-[42px] border border-[#ececec] focus:border-[#e5322d] rounded-full px-4 text-[13px] outline-none"
          />
        </div>

        <div className="flex gap-2.5 pt-1">
          <Link
            to="/account/security"
            className="bg-white border border-[#ececec] text-[13px] font-semibold text-black px-5 py-2.5 rounded-full"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={confirmText !== 'DELETE' || code.length !== 6 || deleting}
            onClick={() => void handleScheduleDelete()}
            className="bg-[#e5322d] hover:bg-[#c8231e] disabled:opacity-40 text-white text-[13px] font-semibold px-6 py-2.5 rounded-full transition-colors cursor-pointer"
          >
            {deleting ? 'Scheduling...' : 'Verify & schedule deletion'}
          </button>
        </div>
      </div>
    </div>
  );
}
