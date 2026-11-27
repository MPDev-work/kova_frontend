import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ApiError, customerApi } from '../services/api';
import { FigmaIcon, ICON_STROKE_WIDTH } from './FigmaIcon';
import { useShakeAnimation } from './PasswordInput';

interface ContactVerificationCardProps {
  /** Current phone value in the profile form so verifying can save & send OTP seamlessly */
  phoneDraft?: string;
}

/**
 * Email & Phone OTP verification card available exclusively for Customer and Seller accounts
 * (never shown to Root Admin accounts).
 */
export function ContactVerificationCard({
  phoneDraft,
}: ContactVerificationCardProps) {
  const { user, refreshUser, showToast } = useStore();

  const [emailStep, setEmailStep] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailShakeKey, setEmailShakeKey] = useState(0);
  const [emailCooldown, setEmailCooldown] = useState(0);

  const [phoneStep, setPhoneStep] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneShakeKey, setPhoneShakeKey] = useState(0);
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  const emailShaking = useShakeAnimation(Boolean(emailError), emailShakeKey);
  const phoneShaking = useShakeAnimation(Boolean(phoneError), phoneShakeKey);

  useEffect(() => {
    if (emailCooldown <= 0 && phoneCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setEmailCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      setPhoneCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [emailCooldown, phoneCooldown]);

  if (!user) return null;

  const isAdmin = Boolean(
    user.roles?.some((r) => r === 'admin' || r === 'root_admin'),
  );
  if (isAdmin) return null;

  const emailVerified = Boolean(user.email_verified_at);
  const phoneVerified = Boolean(user.phone_verified_at);
  const effectivePhone = (phoneDraft ?? user.phone ?? '').trim();

  const handleSend = async (channel: 'email' | 'phone') => {
    if (channel === 'phone' && !effectivePhone) {
      setPhoneError('Please enter your phone number above before verifying.');
      setPhoneShakeKey((k) => k + 1);
      return;
    }

    if (channel === 'email') {
      setEmailBusy(true);
      setEmailError(null);
    } else {
      setPhoneBusy(true);
      setPhoneError(null);
    }

    try {
      const res = await customerApi.sendVerificationCode(
        channel,
        channel === 'phone' ? effectivePhone : undefined,
      );
      if (res.data?.already_verified) {
        await refreshUser();
        showToast(res.message || 'Already verified.');
        return;
      }
      if (channel === 'email') {
        setEmailStep(true);
        setEmailCode('');
        setEmailCooldown(60);
      } else {
        setPhoneStep(true);
        setPhoneCode('');
        setPhoneCooldown(60);
      }
      showToast(res.message || 'Verification code sent.');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'We could not send the verification code right now.';
      if (channel === 'email') {
        setEmailError(msg);
        setEmailShakeKey((k) => k + 1);
      } else {
        setPhoneError(msg);
        setPhoneShakeKey((k) => k + 1);
      }
    } finally {
      if (channel === 'email') setEmailBusy(false);
      else setPhoneBusy(false);
    }
  };

  const handleConfirm = async (channel: 'email' | 'phone') => {
    const code = (channel === 'email' ? emailCode : phoneCode).trim();
    if (!/^\d{6}$/.test(code)) {
      const msg = 'Please enter the 6-digit verification code.';
      if (channel === 'email') {
        setEmailError(msg);
        setEmailShakeKey((k) => k + 1);
      } else {
        setPhoneError(msg);
        setPhoneShakeKey((k) => k + 1);
      }
      return;
    }

    if (channel === 'email') {
      setEmailBusy(true);
      setEmailError(null);
    } else {
      setPhoneBusy(true);
      setPhoneError(null);
    }

    try {
      const res = await customerApi.confirmVerificationCode(channel, code);
      await refreshUser();
      if (channel === 'email') {
        setEmailStep(false);
        setEmailCode('');
        setEmailCooldown(0);
      } else {
        setPhoneStep(false);
        setPhoneCode('');
        setPhoneCooldown(0);
      }
      showToast(res.message || 'Verified successfully.');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'That verification code is not correct. Please check and try again.';
      if (channel === 'email') {
        setEmailError(msg);
        setEmailShakeKey((k) => k + 1);
      } else {
        setPhoneError(msg);
        setPhoneShakeKey((k) => k + 1);
      }
    } finally {
      if (channel === 'email') setEmailBusy(false);
      else setPhoneBusy(false);
    }
  };

  return (
    <section className="bg-white border border-[#ececec] p-3.5 flex flex-col gap-3 rounded-[24px]">
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4" strokeWidth={ICON_STROKE_WIDTH} />
        </span>
        <div>
          <h2 className="text-[15.5px] font-bold text-black">
            Email &amp; phone verification
          </h2>
          <p className="text-[12px] text-[#8a8a8a]">
            Verify your contact details to secure your Kova account (each phone
            number can only be linked to one account)
          </p>
        </div>
      </div>

      {/* Email Verification Row (24px parent - 14px p-3.5 = 10px child) */}
      <div className="bg-[#fafafa] border border-[#ececec] p-3 flex flex-col gap-3 rounded-[10px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-full bg-white border border-[#ececec] text-[#555555] flex items-center justify-center shrink-0">
              <FigmaIcon name="mail" className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-black">
                Email address
              </p>
              <p className="text-[12px] text-[#767676] truncate">
                {user.email}
              </p>
            </div>
          </div>

          {emailVerified ? (
            <span className="inline-flex items-center gap-1.5 bg-[#e7f6e7] text-[#029500] text-[12px] font-semibold px-3 py-1 rounded-full shrink-0">
              <FigmaIcon name="check-circle" className="w-3.5 h-3.5" />
              <span>Verified</span>
            </span>
          ) : (
            <button
              type="button"
              disabled={emailBusy || emailCooldown > 0}
              onClick={() => void handleSend('email')}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-55 text-white text-[12px] font-semibold px-4 py-1.5 rounded-full transition-colors shrink-0"
            >
              {emailBusy
                ? 'Sending...'
                : emailCooldown > 0
                  ? `Resend (${emailCooldown}s)`
                  : emailStep
                    ? 'Resend code'
                    : 'Verify email'}
            </button>
          )}
        </div>

        {emailError && (
          <p className="text-[12px] font-medium text-[#e5322d] bg-[#fdecec] border border-[#e5322d]/20 px-3.5 py-2 rounded-[14px]">
            {emailError}
          </p>
        )}

        {!emailVerified && emailStep && (
          <div className="pt-2 border-t border-[#ececec] flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={emailCode}
                onChange={(e) => {
                  setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (emailError) setEmailError(null);
                }}
                placeholder="Enter 6-digit code"
                className={`flex-1 min-w-[160px] h-[42px] bg-white border rounded-full px-4 text-[13px] font-mono tracking-widest text-black outline-none transition-colors ${
                  emailError
                    ? 'kova-input-error border-[#e5322d] focus:border-[#e5322d]'
                    : 'border-[#ececec] focus:border-[#ff6e20]'
                } ${emailShaking ? 'kova-input-shake' : ''}`}
              />
              <button
                type="button"
                disabled={emailBusy || emailCode.length !== 6}
                onClick={() => void handleConfirm('email')}
                className="bg-black hover:bg-black/85 disabled:opacity-45 text-white text-[12px] font-semibold px-4 py-2 rounded-full transition-colors"
              >
                {emailBusy ? 'Verifying...' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmailStep(false);
                  setEmailCode('');
                  setEmailError(null);
                }}
                className="text-[12px] font-semibold text-[#767676] hover:text-black px-2 py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Phone Verification Row (24px parent - 14px p-3.5 = 10px child) */}
      <div className="bg-[#fafafa] border border-[#ececec] p-3 flex flex-col gap-3 rounded-[10px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-full bg-white border border-[#ececec] text-[#555555] flex items-center justify-center shrink-0">
              <FigmaIcon name="phone" className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-black">
                Phone number
              </p>
              <p className="text-[12px] text-[#767676] truncate">
                {effectivePhone || 'Add a phone number above to verify'}
              </p>
            </div>
          </div>

          {phoneVerified && effectivePhone === (user.phone || '').trim() ? (
            <span className="inline-flex items-center gap-1.5 bg-[#e7f6e7] text-[#029500] text-[12px] font-semibold px-3 py-1 rounded-full shrink-0">
              <FigmaIcon name="check-circle" className="w-3.5 h-3.5" />
              <span>Verified</span>
            </span>
          ) : (
            <button
              type="button"
              disabled={phoneBusy || !effectivePhone || phoneCooldown > 0}
              onClick={() => void handleSend('phone')}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-45 text-white text-[12px] font-semibold px-4 py-1.5 rounded-full transition-colors shrink-0"
            >
              {phoneBusy
                ? 'Sending...'
                : phoneCooldown > 0
                  ? `Resend (${phoneCooldown}s)`
                  : phoneStep
                    ? 'Resend code'
                    : 'Verify phone'}
            </button>
          )}
        </div>

        {phoneError && (
          <p className="text-[12px] font-medium text-[#e5322d] bg-[#fdecec] border border-[#e5322d]/20 px-3.5 py-2 rounded-[14px]">
            {phoneError}
          </p>
        )}

        {!(phoneVerified && effectivePhone === (user.phone || '').trim()) &&
          phoneStep && (
            <div className="pt-2 border-t border-[#ececec] flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={phoneCode}
                  onChange={(e) => {
                    setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    if (phoneError) setPhoneError(null);
                  }}
                  placeholder="Enter 6-digit SMS code"
                  className={`flex-1 min-w-[160px] h-[42px] bg-white border rounded-full px-4 text-[13px] font-mono tracking-widest text-black outline-none transition-colors ${
                    phoneError
                      ? 'kova-input-error border-[#e5322d] focus:border-[#e5322d]'
                      : 'border-[#ececec] focus:border-[#ff6e20]'
                  } ${phoneShaking ? 'kova-input-shake' : ''}`}
                />
                <button
                  type="button"
                  disabled={phoneBusy || phoneCode.length !== 6}
                  onClick={() => void handleConfirm('phone')}
                  className="bg-black hover:bg-black/85 disabled:opacity-45 text-white text-[12px] font-semibold px-4 py-2 rounded-full transition-colors"
                >
                  {phoneBusy ? 'Verifying...' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhoneStep(false);
                    setPhoneCode('');
                    setPhoneError(null);
                  }}
                  className="text-[12px] font-semibold text-[#767676] hover:text-black px-2 py-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
      </div>
    </section>
  );
}
