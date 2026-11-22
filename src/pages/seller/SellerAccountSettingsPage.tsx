import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { ContactVerificationCard } from '../../components/ContactVerificationCard';
import { DashboardPageHeader } from '../../components/DashboardPrimitives';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { useStore } from '../../context/StoreContext';
import { ApiError } from '../../services/api';
import { formatShortDate } from '../../utils/currency';

export function SellerAccountSettingsPage() {
  const { user, updateProfile, uploadAvatar, changePassword, signOut, showToast } =
    useStore();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Full name is required.');
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() || null });
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to save profile.',
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      await uploadAvatar(file);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to upload profile photo.',
      );
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Password confirmation does not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to update password.',
      );
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Account settings"
        subtitle="Manage your seller owner profile photo, display name, contact phone, and account password."
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] gap-5 items-start">
        <div className="flex flex-col gap-5">
          {/* Profile Form (real profile moved directly to top) */}
          <form
            onSubmit={handleSaveProfile}
            className="bg-white border border-[#ececec] rounded-[20px] p-5 sm:p-6 flex flex-col gap-5"
          >
            <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-[#f1f1f1]">
              <div className="relative">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-16 h-16 rounded-full object-cover border border-[#ececec]"
                  />
                ) : (
                  <span className="w-16 h-16 rounded-full bg-[#ff6e20] text-white text-[20px] font-bold flex items-center justify-center">
                    {initials}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5 min-w-0">
                <p className="text-[16px] font-bold text-black flex items-center gap-1.5">
                  <span className="truncate">{user.name}</span>
                  {user.email_verified_at && <VerifiedBadge size="xs" />}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => void handleAvatarUpload(e)}
                  />
                  <button
                    type="button"
                    disabled={uploadingAvatar}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] border border-[#ececec] text-[12px] font-semibold text-black px-3.5 py-1.5 rounded-full transition-colors disabled:opacity-50"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>
                      {uploadingAvatar ? 'Uploading...' : 'Change photo'}
                    </span>
                  </button>
                  <span className="text-[11.5px] text-[#8a8a8a]">
                    JPG, PNG, or WebP
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-black">
                  Full name
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
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
                  placeholder="+855 12 345 678"
                  className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
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
                  className="border border-[#ececec] bg-[#f7f7f7] text-[#767676] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
                />
              </label>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingProfile}
                className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[13px] font-semibold px-5 py-2.5 rounded-full transition-colors"
              >
                {savingProfile ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </form>

          {/* Email & Phone Verification (Seller) */}
          <ContactVerificationCard phoneDraft={phone} />

          {/* Change Password Form */}
          <form
            onSubmit={handleChangePassword}
            className="bg-white border border-[#ececec] rounded-[20px] p-5 sm:p-6 flex flex-col gap-4"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-[15.5px] font-bold text-black">
                  Change password
                </h2>
                <p className="text-[12px] text-[#8a8a8a]">
                  Keep your seller account secure with a strong password
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12px] font-semibold text-black">
                  Current password
                </span>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-black">
                  New password
                </span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-black">
                  Confirm new password
                </span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="border border-[#ececec] focus:border-[#ff6e20] rounded-[12px] px-3.5 py-2.5 text-[13.5px] outline-none"
                />
              </label>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingPassword}
                className="bg-black hover:bg-black/85 disabled:opacity-60 text-white text-[13px] font-semibold px-5 py-2.5 rounded-full transition-colors"
              >
                {savingPassword ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Side: Seller Account Status & Session */}
        <div className="flex flex-col gap-4">
          <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#ff6e20]" />
              <h2 className="text-[15px] font-bold text-black">
                Account overview
              </h2>
            </div>

            <dl className="flex flex-col divide-y divide-[#f1f1f1] text-[12.5px]">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#767676]">Workspace</dt>
                <dd className="font-semibold text-[#ff6e20]">Seller Center</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#767676]">Store</dt>
                <dd className="font-semibold text-black truncate max-w-[160px]">
                  {user.store?.name || 'My Store'}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#767676]">Email verification</dt>
                <dd
                  className={`font-semibold ${
                    user.email_verified_at
                      ? 'text-[#029500]'
                      : 'text-[#ff6e20]'
                  }`}
                >
                  {user.email_verified_at ? 'Verified' : 'Unverified'}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#767676]">Phone verification</dt>
                <dd
                  className={`font-semibold ${
                    user.phone_verified_at
                      ? 'text-[#029500]'
                      : 'text-[#ff6e20]'
                  }`}
                >
                  {user.phone_verified_at ? 'Verified' : 'Unverified'}
                </dd>
              </div>
              {user.created_at && (
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[#767676]">Joined</dt>
                  <dd className="font-semibold text-black">
                    {formatShortDate(user.created_at)}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-3">
            <h2 className="text-[15px] font-bold text-black">Session</h2>
            <p className="text-[12.5px] text-[#767676] leading-relaxed">
              Sign out of your Seller Center session on this device.
            </p>
            <button
              type="button"
              onClick={() => void signOut().then(() => navigate('/login'))}
              className="inline-flex items-center justify-center gap-2 bg-[#fff0f0] hover:bg-[#e5322d] text-[#e5322d] hover:text-white text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
