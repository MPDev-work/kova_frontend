import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { ContactVerificationCard } from './ContactVerificationCard';
import { AvatarCropModal } from './AvatarCropModal';
import { DashboardPageHeader } from './DashboardPrimitives';
import { FigmaIcon, ICON_STROKE_WIDTH } from './FigmaIcon';
import { PasswordInput } from './PasswordInput';
import { VerifiedBadge } from './VerifiedBadge';
import { useStore } from '../context/StoreContext';
import { ApiError, authApi, customerApi } from '../services/api';
import { formatShortDate } from '../utils/currency';
import { validateUploadFile } from '../utils/mediaUpload';

interface DashboardAccountSettingsPageProps {
  workspace: 'admin' | 'seller';
}

export function DashboardAccountSettingsPage({
  workspace,
}: DashboardAccountSettingsPageProps) {
  const {
    user,
    updateProfile,
    uploadAvatar,
    changePassword,
    deactivateAccount,
    deleteAccount,
    refreshUser,
    signOut,
    showToast,
  } = useStore();
  const navigate = useNavigate();

  const isAdminWorkspace = workspace === 'admin';

  // Profile identity
  const [name, setName] = useState(user?.name || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Verified Change Email
  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  // Verified Change Phone
  const [phoneChangeOpen, setPhoneChangeOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);

  // Change Password + Forgot Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<{
    current?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [passwordShakeKey, setPasswordShakeKey] = useState(0);
  const [savingPassword, setSavingPassword] = useState(false);
  const [sendingResetLink, setSendingResetLink] = useState(false);
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

  // Verified Deactivate Account (Seller)
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateChannel, setDeactivateChannel] = useState<'email' | 'phone'>(
    'email',
  );
  const [deactivateCodeSent, setDeactivateCodeSent] = useState(false);
  const [deactivateCode, setDeactivateCode] = useState('');
  const [deactivateBusy, setDeactivateBusy] = useState(false);

  // Verified Delete Account with 30-day grace period (Seller)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteChannel, setDeleteChannel] = useState<'email' | 'phone'>(
    'email',
  );
  const [deleteCodeSent, setDeleteCodeSent] = useState(false);
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const hasLinkedPhone = Boolean(user.phone?.trim());

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Full name is required.');
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim(), phone: user.phone || null });
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to save profile.',
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    const err = validateUploadFile(file, 'image');
    if (err) {
      showToast(err);
      return;
    }
    setPendingAvatarFile(file);
  };

  const handleConfirmCroppedAvatar = async (croppedFile: File) => {
    setUploadingAvatar(true);
    try {
      await uploadAvatar(croppedFile);
      setPendingAvatarFile(null);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to upload profile photo.',
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSendEmailChangeCode = async () => {
    const target = newEmail.trim();
    if (!target) {
      showToast('Enter a new email address first.');
      return;
    }
    setEmailBusy(true);
    try {
      const res = await customerApi.sendContactChangeCode('email', target);
      setEmailCodeSent(true);
      showToast(
        res.message || `Verification code sent to ${res.data.sent_to || user.email}.`,
      );
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to send email verification code.',
      );
    } finally {
      setEmailBusy(false);
    }
  };

  const handleConfirmEmailChange = async () => {
    if (emailCode.trim().length !== 6) {
      showToast('Enter the 6-digit verification code.');
      return;
    }
    setEmailBusy(true);
    try {
      const res = await customerApi.confirmContactChangeCode(
        'email',
        emailCode.trim(),
      );
      await refreshUser();
      setEmailChangeOpen(false);
      setEmailCodeSent(false);
      setNewEmail('');
      setEmailCode('');
      showToast(res.message || 'Email address updated and verified.');
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to verify email code.',
      );
    } finally {
      setEmailBusy(false);
    }
  };

  const handleSendPhoneChangeCode = async () => {
    const target = newPhone.trim();
    if (!target) {
      showToast('Enter a new phone number first.');
      return;
    }
    setPhoneBusy(true);
    try {
      const res = await customerApi.sendContactChangeCode('phone', target);
      setPhoneCodeSent(true);
      showToast(res.message || 'Verification SMS sent to your new phone.');
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to send phone verification code.',
      );
    } finally {
      setPhoneBusy(false);
    }
  };

  const handleConfirmPhoneChange = async () => {
    if (phoneCode.trim().length !== 6) {
      showToast('Enter the 6-digit SMS code.');
      return;
    }
    setPhoneBusy(true);
    try {
      const res = await customerApi.confirmContactChangeCode(
        'phone',
        phoneCode.trim(),
      );
      await refreshUser();
      setPhoneChangeOpen(false);
      setPhoneCodeSent(false);
      setNewPhone('');
      setPhoneCode('');
      showToast(res.message || 'Phone number updated and verified.');
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to verify SMS code.',
      );
    } finally {
      setPhoneBusy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: {
      current?: string;
      password?: string;
      confirm?: string;
    } = {};

    if (!currentPassword) {
      nextErrors.current = 'Please enter your current password.';
    }
    if (newPassword.length < 8) {
      nextErrors.password = 'Your new password must be at least 8 characters.';
    }
    if (newPassword !== confirmPassword) {
      nextErrors.confirm = "Your passwords don't match.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setPasswordErrors(nextErrors);
      setPasswordShakeKey((k) => k + 1);
      return;
    }

    setPasswordErrors({});
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
      const msg =
        err instanceof ApiError
          ? err.message
          : 'We could not update your password. Please try again.';
      if (
        err instanceof ApiError &&
        (err.errors?.current_password || /current password/i.test(msg))
      ) {
        setPasswordErrors({ current: msg });
      } else if (err instanceof ApiError && err.errors?.password) {
        setPasswordErrors({ password: msg });
      } else {
        setPasswordErrors({ current: msg });
      }
      setPasswordShakeKey((k) => k + 1);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleForgotPasswordReset = async () => {
    if (!user.email) {
      showToast('No email address is linked to this account.');
      return;
    }
    if (sendingResetLink || resetCooldown > 0) return;
    setSendingResetLink(true);
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
      setSendingResetLink(false);
    }
  };

  const handleSendDeactivateCode = async () => {
    setDeactivateBusy(true);
    try {
      const res = await customerApi.sendSecurityActionCode(
        'deactivate',
        deactivateChannel,
      );
      setDeactivateCodeSent(true);
      showToast(res.message || 'Verification code sent.');
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to send verification code.',
      );
    } finally {
      setDeactivateBusy(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (deactivateCode.trim().length !== 6) {
      showToast('Enter the 6-digit verification code.');
      return;
    }
    setDeactivateBusy(true);
    try {
      await deactivateAccount(deactivateCode.trim());
      navigate('/login', { replace: true });
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to deactivate account.',
      );
    } finally {
      setDeactivateBusy(false);
    }
  };

  const handleSendDeleteCode = async () => {
    setDeleteBusy(true);
    try {
      const res = await customerApi.sendSecurityActionCode('delete', deleteChannel);
      setDeleteCodeSent(true);
      showToast(res.message || 'Verification code sent.');
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to send verification code.',
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteCode.trim().length !== 6) {
      showToast('Enter the 6-digit verification code.');
      return;
    }
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      showToast('Type DELETE to confirm account deletion.');
      return;
    }
    setDeleteBusy(true);
    try {
      await deleteAccount(deleteCode.trim());
      navigate('/login', { replace: true });
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to schedule account deletion.',
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title="Account settings"
        subtitle={
          isAdminWorkspace
            ? 'Manage your Root Administrator profile photo, identity, verified contact details, and password.'
            : 'Manage your seller owner profile photo, verified email & phone, password, and account security.'
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] gap-5 items-start">
        <div className="flex flex-col gap-5">
          {/* 1. Profile & Avatar */}
          <form
            onSubmit={handleSaveProfile}
            className="bg-white border border-[#ececec] p-4 sm:p-5 flex flex-col gap-3.5 rounded-[24px]"
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
                  <span
                    className={`w-16 h-16 rounded-full text-white text-[20px] font-bold flex items-center justify-center ${
                      isAdminWorkspace ? 'bg-black' : 'bg-[#ff6e20]'
                    }`}
                  >
                    {initials}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5 min-w-0">
                <p className="text-[16px] font-bold text-black flex items-center gap-1.5">
                  <span className="truncate">{user.name}</span>
                  {(isAdminWorkspace || user.email_verified_at) && (
                    <VerifiedBadge size="xs" />
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <button
                    type="button"
                    disabled={uploadingAvatar}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 bg-[#f7f7f7] hover:bg-[#ffefe6] hover:text-[#ff6e20] border border-[#ececec] text-[12px] font-semibold text-black px-3.5 py-1.5 rounded-full transition-colors disabled:opacity-50"
                  >
                    <FigmaIcon name="camera" className="w-3.5 h-3.5" />
                    <span>
                      {uploadingAvatar ? 'Uploading...' : 'Change photo'}
                    </span>
                  </button>
                  <span className="text-[11.5px] text-[#8a8a8a]">
                    Any image · 1:1 crop (max 20MB)
                  </span>
                </div>
              </div>
            </div>

            <AvatarCropModal
              open={Boolean(pendingAvatarFile)}
              file={pendingAvatarFile}
              uploading={uploadingAvatar}
              onCancel={() => setPendingAvatarFile(null)}
              onConfirm={handleConfirmCroppedAvatar}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12px] font-semibold text-black">
                  Full name
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13.5px] outline-none"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-black">
                  Email address
                </span>
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="h-[42px] border border-[#ececec] bg-[#f7f7f7] text-[#767676] rounded-full px-4 text-[13.5px] outline-none"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-black">
                  Phone number
                </span>
                <input
                  type="text"
                  disabled
                  value={user.phone || 'Not linked yet'}
                  className="h-[42px] border border-[#ececec] bg-[#f7f7f7] text-[#767676] rounded-full px-4 text-[13.5px] outline-none"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#f1f1f1]">
              <p className="text-[11.5px] text-[#8a8a8a]">
                Use verified change controls below to update your email or phone
                number.
              </p>
              {(() => {
                const isProfileDirty =
                  name.trim() !== (user.name || '').trim();
                return (
                  <button
                    type="submit"
                    disabled={!isProfileDirty || savingProfile}
                    className={`inline-flex items-center gap-1.5 text-[13px] font-semibold px-5 py-2 rounded-full transition-colors shrink-0 ${
                      isProfileDirty
                        ? 'bg-[#ff6e20] hover:bg-[#e85d12] text-white cursor-pointer disabled:opacity-60'
                        : 'bg-[#e7f6e7] text-[#029500] cursor-default'
                    }`}
                  >
                    {savingProfile ? (
                      <span>Saving...</span>
                    ) : isProfileDirty ? (
                      <span>Save profile</span>
                    ) : (
                      <>
                        <FigmaIcon name="check" className="w-3.5 h-3.5" />
                        <span>Saved</span>
                      </>
                    )}
                  </button>
                );
              })()}
            </div>
          </form>

          {/* 2. Contact Verification */}
          <ContactVerificationCard phoneDraft={user.phone || ''} />

          {/* 3. Verified Change Email & Change Phone (24px parent - 14px p-3.5 = 10px child) */}
          <section className="bg-white border border-[#ececec] p-3.5 flex flex-col gap-3 rounded-[24px]">
            <div>
              <h2 className="text-[15.5px] font-bold text-black">
                Change email or phone number
              </h2>
              <p className="text-[12px] text-[#8a8a8a] mt-0.5">
                Updating your login email sends a 6-digit code to your current
                email ({user.email}); updating your phone verifies the new
                number first.
              </p>
            </div>

            {/* Change Email */}
            <div className="border border-[#ececec] rounded-[10px] p-3.5 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center shrink-0">
                    <FigmaIcon name="mail" className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-black">
                      Email address
                    </p>
                    <p className="text-[12px] text-[#767676] truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmailChangeOpen((v) => !v);
                    setEmailCodeSent(false);
                    setEmailCode('');
                  }}
                  className="text-[12px] font-semibold px-3.5 py-1.5 rounded-full border border-[#ececec] hover:border-[#ff6e20] hover:text-[#ff6e20] text-black transition-colors"
                >
                  {emailChangeOpen ? 'Cancel' : 'Change email'}
                </button>
              </div>

              {emailChangeOpen && (
                <div className="pt-2 border-t border-[#f1f1f1] flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Enter new email address"
                      className="flex-1 min-w-[200px] h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] outline-none"
                    />
                    <button
                      type="button"
                      disabled={emailBusy}
                      onClick={() => void handleSendEmailChangeCode()}
                      className="h-[42px] bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-4 rounded-full transition-colors"
                    >
                      {emailBusy
                        ? 'Sending...'
                        : emailCodeSent
                          ? 'Resend code'
                          : 'Send 6-digit code'}
                    </button>
                  </div>

                  {emailCodeSent && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={emailCode}
                        onChange={(e) =>
                          setEmailCode(e.target.value.replace(/\D/g, ''))
                        }
                        placeholder={`6-digit code sent to ${user.email}`}
                        className="flex-1 min-w-[210px] h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] font-mono tracking-widest outline-none"
                      />
                      <button
                        type="button"
                        disabled={emailBusy || emailCode.length !== 6}
                        onClick={() => void handleConfirmEmailChange()}
                        className="h-[42px] bg-black hover:bg-black/85 disabled:opacity-60 text-white text-[12.5px] font-semibold px-4 rounded-full transition-colors"
                      >
                        {emailBusy ? 'Verifying...' : 'Verify & update email'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Change Phone */}
            <div className="border border-[#ececec] rounded-[10px] p-3.5 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-full bg-[#e7f6e7] text-[#029500] flex items-center justify-center shrink-0">
                    <FigmaIcon name="phone" className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-black">
                      Phone number
                    </p>
                    <p className="text-[12px] text-[#767676] truncate">
                      {user.phone || 'No phone number linked'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPhoneChangeOpen((v) => !v);
                    setPhoneCodeSent(false);
                    setPhoneCode('');
                  }}
                  className="text-[12px] font-semibold px-3.5 py-1.5 rounded-full border border-[#ececec] hover:border-[#ff6e20] hover:text-[#ff6e20] text-black transition-colors"
                >
                  {phoneChangeOpen
                    ? 'Cancel'
                    : user.phone
                      ? 'Change phone'
                      : 'Add phone'}
                </button>
              </div>

              {phoneChangeOpen && (
                <div className="pt-2 border-t border-[#f1f1f1] flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+855 12 345 678"
                      className="flex-1 min-w-[200px] h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] outline-none"
                    />
                    <button
                      type="button"
                      disabled={phoneBusy}
                      onClick={() => void handleSendPhoneChangeCode()}
                      className="h-[42px] bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold px-4 rounded-full transition-colors"
                    >
                      {phoneBusy
                        ? 'Sending...'
                        : phoneCodeSent
                          ? 'Resend SMS'
                          : 'Send SMS code'}
                    </button>
                  </div>

                  {phoneCodeSent && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={phoneCode}
                        onChange={(e) =>
                          setPhoneCode(e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="Enter 6-digit SMS code"
                        className="w-[180px] h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] tracking-[0.2em] font-semibold outline-none"
                      />
                      <button
                        type="button"
                        disabled={phoneBusy || phoneCode.length !== 6}
                        onClick={() => void handleConfirmPhoneChange()}
                        className="h-[42px] bg-black hover:bg-black/85 disabled:opacity-60 text-white text-[12.5px] font-semibold px-4 rounded-full transition-colors"
                      >
                        {phoneBusy ? 'Verifying...' : 'Verify & update phone'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* 4. Change Password + Forgot Password */}
          <form
            onSubmit={handleChangePassword}
            noValidate
            className="bg-white border border-[#ececec] p-4 sm:p-5 flex flex-col gap-3.5 rounded-[24px]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center shrink-0">
                  <FigmaIcon name="key" className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-[15.5px] font-bold text-black">
                    Change password
                  </h2>
                  <p className="text-[12px] text-[#8a8a8a]">
                    Keep your account secure with a strong password
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={sendingResetLink || resetCooldown > 0}
                onClick={() => void handleForgotPasswordReset()}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#ff6e20] hover:underline disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
              >
                {sendingResetLink && (
                  <Loader2
                    className="w-3.5 h-3.5 animate-spin shrink-0"
                    strokeWidth={ICON_STROKE_WIDTH}
                  />
                )}
                <span>
                  {sendingResetLink
                    ? 'Sending reset link...'
                    : resetCooldown > 0
                      ? `Resend link in ${resetCooldown}s`
                      : 'Forgot current password? Send reset link'}
                </span>
              </button>
            </div>

            {resetFeedback && (
              <div
                className={`text-[12.5px] font-medium px-4 py-2.5 rounded-[12px] border ${
                  resetFeedback.ok
                    ? 'bg-[#e7f6e7] border-[#029500]/25 text-[#029500]'
                    : 'bg-[#fdecec] border-[#e5322d]/25 text-[#e5322d]'
                }`}
              >
                {resetFeedback.message}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PasswordInput
                label="Current password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (passwordErrors.current) {
                    setPasswordErrors((prev) => ({
                      ...prev,
                      current: undefined,
                    }));
                  }
                }}
                placeholder="Enter your current password"
                error={passwordErrors.current}
                shakeKey={passwordShakeKey}
                containerClassName="sm:col-span-2"
              />

              <PasswordInput
                label="New password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (passwordErrors.password) {
                    setPasswordErrors((prev) => ({
                      ...prev,
                      password: undefined,
                    }));
                  }
                }}
                placeholder="Minimum 8 characters"
                error={passwordErrors.password}
                shakeKey={passwordShakeKey}
              />

              <PasswordInput
                label="Confirm new password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (passwordErrors.confirm) {
                    setPasswordErrors((prev) => ({
                      ...prev,
                      confirm: undefined,
                    }));
                  }
                }}
                placeholder="Re-enter new password"
                error={passwordErrors.confirm}
                shakeKey={passwordShakeKey}
              />
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

          {/* 5. Account Deactivation & 30-Day Deletion (Seller only) */}
          {!isAdminWorkspace && (
            <section className="bg-white border border-[#ececec] p-3.5 flex flex-col gap-3 rounded-[24px]">
              <div>
                <h2 className="text-[15.5px] font-bold text-black">
                  Account deactivation &amp; deletion
                </h2>
                <p className="text-[12px] text-[#8a8a8a] mt-0.5">
                  Both actions require 6-digit OTP verification. Deleted
                  accounts remain recoverable for 30 days before permanent
                  removal.
                </p>
              </div>

              {/* Deactivate */}
              <div className="border border-[#ececec] rounded-[10px] p-3.5 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center shrink-0">
                      <FigmaIcon name="pause-circle" className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-black">
                        Deactivate account
                      </p>
                      <p className="text-[11.5px] text-[#767676]">
                        Temporarily disable your account. Sign back in anytime
                        to reactivate.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeactivateOpen((v) => !v);
                      setDeactivateCodeSent(false);
                      setDeactivateCode('');
                    }}
                    className="text-[12px] font-semibold px-3.5 py-1.5 rounded-full border border-[#ececec] hover:border-[#ff6e20] hover:text-[#ff6e20] text-black transition-colors"
                  >
                    {deactivateOpen ? 'Cancel' : 'Deactivate'}
                  </button>
                </div>

                {deactivateOpen && (
                  <div className="pt-2 border-t border-[#f1f1f1] flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDeactivateChannel('email')}
                        className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                          deactivateChannel === 'email'
                            ? 'bg-[#ff6e20] text-white border-[#ff6e20]'
                            : 'bg-white border-[#ececec] text-[#555555]'
                        }`}
                      >
                        Email ({user.email})
                      </button>
                      {hasLinkedPhone && (
                        <button
                          type="button"
                          onClick={() => setDeactivateChannel('phone')}
                          className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                            deactivateChannel === 'phone'
                              ? 'bg-[#ff6e20] text-white border-[#ff6e20]'
                              : 'bg-white border-[#ececec] text-[#555555]'
                          }`}
                        >
                          SMS ({user.phone})
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={deactivateBusy}
                        onClick={() => void handleSendDeactivateCode()}
                        className="ml-auto px-4 py-1.5 rounded-full text-[12px] font-semibold bg-black text-white hover:bg-black/85 disabled:opacity-60"
                      >
                        {deactivateBusy
                          ? 'Sending...'
                          : deactivateCodeSent
                            ? 'Resend code'
                            : 'Send 6-digit code'}
                      </button>
                    </div>

                    {deactivateCodeSent && (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={deactivateCode}
                          onChange={(e) =>
                            setDeactivateCode(e.target.value.replace(/\D/g, ''))
                          }
                          placeholder="6-digit code"
                          className="w-[170px] h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[13px] tracking-[0.2em] font-semibold outline-none"
                        />
                        <button
                          type="button"
                          disabled={
                            deactivateBusy || deactivateCode.length !== 6
                          }
                          onClick={() => void handleConfirmDeactivate()}
                          className="h-[42px] px-4 rounded-full bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12.5px] font-semibold"
                        >
                          {deactivateBusy
                            ? 'Deactivating...'
                            : 'Verify & deactivate'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 30-Day Scheduled Delete */}
              <div className="border border-[#fdecec] rounded-[10px] p-3.5 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-[#fdecec] text-[#e5322d] flex items-center justify-center shrink-0">
                      <FigmaIcon name="trash" className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-[#e5322d]">
                        Delete account (30-day grace period)
                      </p>
                      <p className="text-[11.5px] text-[#767676]">
                        Scheduled for permanent deletion after 30 days. Sign in
                        within 30 days to cancel.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteOpen((v) => !v);
                      setDeleteCodeSent(false);
                      setDeleteCode('');
                      setDeleteConfirmText('');
                    }}
                    className="text-[12px] font-semibold px-3.5 py-1.5 rounded-full border border-[#e5322d]/30 text-[#e5322d] hover:bg-[#fdecec] transition-colors"
                  >
                    {deleteOpen ? 'Cancel' : 'Delete account'}
                  </button>
                </div>

                {deleteOpen && (
                  <div className="pt-2 border-t border-[#fdecec] flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDeleteChannel('email')}
                        className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                          deleteChannel === 'email'
                            ? 'bg-[#e5322d] text-white border-[#e5322d]'
                            : 'bg-white border-[#ececec] text-[#555555]'
                        }`}
                      >
                        Email ({user.email})
                      </button>
                      {hasLinkedPhone && (
                        <button
                          type="button"
                          onClick={() => setDeleteChannel('phone')}
                          className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                            deleteChannel === 'phone'
                              ? 'bg-[#e5322d] text-white border-[#e5322d]'
                              : 'bg-white border-[#ececec] text-[#555555]'
                          }`}
                        >
                          SMS ({user.phone})
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={deleteBusy}
                        onClick={() => void handleSendDeleteCode()}
                        className="ml-auto px-4 py-1.5 rounded-full text-[12px] font-semibold bg-black text-white hover:bg-black/85 disabled:opacity-60"
                      >
                        {deleteBusy
                          ? 'Sending...'
                          : deleteCodeSent
                            ? 'Resend code'
                            : 'Send 6-digit code'}
                      </button>
                    </div>

                    {deleteCodeSent && (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={deleteCode}
                          onChange={(e) =>
                            setDeleteCode(e.target.value.replace(/\D/g, ''))
                          }
                          placeholder="6-digit code"
                          className="w-[160px] h-[42px] border border-[#ececec] focus:border-[#e5322d] rounded-full px-4 text-[13px] tracking-[0.2em] font-semibold outline-none"
                        />
                        <input
                          type="text"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder='Type "DELETE"'
                          className="w-[170px] h-[42px] border border-[#ececec] focus:border-[#e5322d] rounded-full px-4 text-[13px] font-semibold outline-none"
                        />
                        <button
                          type="button"
                          disabled={
                            deleteBusy ||
                            deleteCode.length !== 6 ||
                            deleteConfirmText.trim().toUpperCase() !== 'DELETE'
                          }
                          onClick={() => void handleConfirmDelete()}
                          className="h-[42px] px-4 rounded-full bg-[#e5322d] hover:bg-[#c92823] disabled:opacity-60 text-white text-[12.5px] font-semibold"
                        >
                          {deleteBusy ? 'Scheduling...' : 'Confirm 30-day delete'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Right Side: Account Overview & Session */}
        <div className="flex flex-col gap-4">
          <section className="bg-white border border-[#ececec] p-4 sm:p-5 flex flex-col gap-3 rounded-[24px]">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className="w-4 h-4 text-[#ff6e20]"
                strokeWidth={ICON_STROKE_WIDTH}
              />
              <h2 className="text-[15px] font-bold text-black">
                Account overview
              </h2>
            </div>

            <dl className="flex flex-col divide-y divide-[#f1f1f1] text-[12.5px]">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#767676]">Workspace</dt>
                <dd className="font-semibold text-[#ff6e20]">
                  {isAdminWorkspace ? 'Root Admin Console' : 'Seller Center'}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#767676]">Role</dt>
                <dd className="font-semibold text-black">
                  {isAdminWorkspace ? 'Root Administrator' : 'Store Owner'}
                </dd>
              </div>
              {!isAdminWorkspace && (
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[#767676]">Store</dt>
                  <dd className="font-semibold text-black truncate max-w-[160px]">
                    {user.store?.name || 'My Store'}
                  </dd>
                </div>
              )}
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

          {isAdminWorkspace && (
            <section className="bg-white border border-[#ececec] p-4 sm:p-5 flex items-start gap-2.5 rounded-[24px]">
              <FigmaIcon
                name="alert-triangle"
                className="w-4 h-4 text-[#ff6e20] shrink-0 mt-0.5"
              />
              <p className="text-[12px] text-[#767676] leading-relaxed">
                Root Administrator accounts are isolated from customer pages and
                protected against self-deletion to prevent platform lockout.
              </p>
            </section>
          )}

          <section className="bg-white border border-[#ececec] p-4 sm:p-5 flex flex-col gap-3 rounded-[24px]">
            <h2 className="text-[15px] font-bold text-black">Session</h2>
            <p className="text-[12.5px] text-[#767676] leading-relaxed">
              Sign out of your{' '}
              {isAdminWorkspace ? 'Root Admin' : 'Seller Center'} session on
              this device.
            </p>
            <button
              type="button"
              onClick={() => void signOut().then(() => navigate('/login'))}
              className="inline-flex items-center justify-center gap-2 bg-[#fff0f0] hover:bg-[#e5322d] text-[#e5322d] hover:text-white text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors cursor-pointer"
            >
              <FigmaIcon name="log-out" className="w-4 h-4" />
              <span>Log out</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
