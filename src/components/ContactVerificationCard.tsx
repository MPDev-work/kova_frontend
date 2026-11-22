import { useState } from 'react';
import { CheckCircle2, Mail, Phone, ShieldCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ApiError, customerApi } from '../services/api';

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

  const [phoneStep, setPhoneStep] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);

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
      showToast('Please enter your phone number above before verifying.');
      return;
    }
    if (channel === 'email') setEmailBusy(true);
    else setPhoneBusy(true);

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
      } else {
        setPhoneStep(true);
        setPhoneCode('');
      }
      showToast(res.message || 'Verification code sent.');
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to send verification code.',
      );
    } finally {
      if (channel === 'email') setEmailBusy(false);
      else setPhoneBusy(false);
    }
  };

  const handleConfirm = async (channel: 'email' | 'phone') => {
    const code = (channel === 'email' ? emailCode : phoneCode).trim();
    if (!/^\d{6}$/.test(code)) {
      showToast('Please enter the 6-digit verification code.');
      return;
    }

    if (channel === 'email') setEmailBusy(true);
    else setPhoneBusy(true);

    try {
      const res = await customerApi.confirmVerificationCode(channel, code);
      await refreshUser();
      if (channel === 'email') {
        setEmailStep(false);
        setEmailCode('');
      } else {
        setPhoneStep(false);
        setPhoneCode('');
      }
      showToast(res.message || 'Verified successfully.');
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Invalid or expired verification code.',
      );
    } finally {
      if (channel === 'email') setEmailBusy(false);
      else setPhoneBusy(false);
    }
  };

  return (
    <section className="bg-white border border-[#ececec] rounded-[20px] p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </span>
        <div>
          <h2 className="text-[15.5px] font-bold text-black">
            Email &amp; phone verification
          </h2>
          <p className="text-[12px] text-[#8a8a8a]">
            Verify your contact details to secure your Kova account
          </p>
        </div>
      </div>

      {/* Email Verification Row */}
      <div className="bg-[#fafafa] border border-[#ececec] rounded-[16px] p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-full bg-white border border-[#ececec] text-[#555555] flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4" />
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
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified</span>
            </span>
          ) : (
            <button
              type="button"
              disabled={emailBusy}
              onClick={() => void handleSend('email')}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[12px] font-semibold px-4 py-1.5 rounded-full transition-colors shrink-0"
            >
              {emailBusy
                ? 'Sending...'
                : emailStep
                  ? 'Resend code'
                  : 'Verify email'}
            </button>
          )}
        </div>

        {!emailVerified && emailStep && (
          <div className="pt-2 border-t border-[#ececec] flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={emailCode}
                onChange={(e) =>
                  setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="Enter 6-digit code"
                className="flex-1 min-w-[160px] bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 py-2 text-[13px] font-mono tracking-widest text-black outline-none"
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
                }}
                className="text-[12px] font-semibold text-[#767676] hover:text-black px-2 py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Phone Verification Row */}
      <div className="bg-[#fafafa] border border-[#ececec] rounded-[16px] p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-full bg-white border border-[#ececec] text-[#555555] flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4" />
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
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified</span>
            </span>
          ) : (
            <button
              type="button"
              disabled={phoneBusy || !effectivePhone}
              onClick={() => void handleSend('phone')}
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-45 text-white text-[12px] font-semibold px-4 py-1.5 rounded-full transition-colors shrink-0"
            >
              {phoneBusy
                ? 'Sending...'
                : phoneStep
                  ? 'Resend code'
                  : 'Verify phone'}
            </button>
          )}
        </div>

        {!(phoneVerified && effectivePhone === (user.phone || '').trim()) &&
          phoneStep && (
            <div className="pt-2 border-t border-[#ececec] flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={phoneCode}
                  onChange={(e) =>
                    setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="Enter 6-digit code"
                  className="flex-1 min-w-[160px] bg-white border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 py-2 text-[13px] font-mono tracking-widest text-black outline-none"
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
