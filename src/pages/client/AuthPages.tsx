import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore, type LoginChallenge } from '../../context/StoreContext';
import { ApiError, authApi, toFriendlyErrorMessage } from '../../services/api';
import { getUserDashboardPath } from '../../utils/authRedirect';
import { KovaLogo } from '../../components/KovaLogo';
import {
  PasswordInput,
  useShakeAnimation,
} from '../../components/PasswordInput';

function AuthStaticHeroPanel() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-full h-full rounded-[28px] overflow-hidden bg-[#ff5200] shadow-[0_14px_40px_rgba(255,110,32,0.18)]">
        <img
          src="/images/auth-hero.jpg"
          alt="Kova Marketplace"
          className="w-full h-full object-cover select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}

// Login Page (Step 1: Email or Phone + Password -> Step 2: 6-digit OTP verification)
export function LoginPage() {
  const { login, verifyLoginOtp, resendLoginOtp, showToast } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const rawGoogleError = searchParams.get('google_error');
  const [error, setError] = useState<string | null>(
    rawGoogleError ? toFriendlyErrorMessage(rawGoogleError, 0) : null,
  );
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [loginShakeKey, setLoginShakeKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 2: OTP verification state
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpShakeKey, setOtpShakeKey] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);
  const identifierShaking = useShakeAnimation(
    Boolean(credentialError),
    loginShakeKey,
  );
  const otpShaking = useShakeAnimation(Boolean(otpError), otpShakeKey);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (challenge) {
      window.setTimeout(() => {
        digitRefs.current[0]?.focus();
      }, 40);
    }
  }, [challenge]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCredentialError(null);
    setSubmitting(true);
    try {
      const result = await login(identifier.trim(), password);
      if (result.requires_verification) {
        setChallenge(result);
        setDigits(['', '', '', '', '', '']);
        setOtpError(null);
        setResendCooldown(60);
        showToast(
          result.channel === 'email'
            ? `Verification code sent to ${result.masked_target}`
            : `SMS code sent to ${result.masked_target}`,
        );
      } else {
        navigate(getUserDashboardPath(result.user) ?? '/', { replace: true });
      }
    } catch (err) {
      const isFieldAuthError =
        err instanceof ApiError && (err.status === 422 || err.status === 401);
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.';
      if (isFieldAuthError) {
        setCredentialError(msg);
        setLoginShakeKey((k) => k + 1);
      } else {
        setError(msg);
        setLoginShakeKey((k) => k + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const otpCode = digits.join('');

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    if (!/^\d{6}$/.test(otpCode)) {
      setOtpError('Please enter all 6 digits of your verification code.');
      setOtpShakeKey((k) => k + 1);
      return;
    }
    setError(null);
    setOtpError(null);
    setSubmitting(true);
    try {
      const signedInUser = await verifyLoginOtp(
        challenge.challenge_token,
        otpCode,
      );
      navigate(getUserDashboardPath(signedInUser) ?? '/', { replace: true });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'That verification code is not correct.';
      setOtpError(msg);
      setOtpShakeKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (nextChannel?: 'email' | 'phone') => {
    if (!challenge || resending) return;
    if (!nextChannel && resendCooldown > 0) return;
    setError(null);
    setOtpError(null);
    setResending(true);
    try {
      const updated = await resendLoginOtp(
        challenge.challenge_token,
        nextChannel,
      );
      setChallenge(updated);
      setDigits(['', '', '', '', '', '']);
      setResendCooldown(60);
      window.setTimeout(() => {
        digitRefs.current[0]?.focus();
      }, 40);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'We could not send a new verification code right now.';
      setError(msg);
    } finally {
      setResending(false);
    }
  };

  const handleDigitChange = (idx: number, raw: string) => {
    if (otpError) setOtpError(null);
    const clean = raw.replace(/\D/g, '');
    if (clean.length > 1) {
      const next = [...digits];
      for (let i = 0; i < 6 && i < clean.length; i += 1) {
        next[i] = clean[i];
      }
      setDigits(next);
      const focusIdx = Math.min(clean.length, 5);
      digitRefs.current[focusIdx]?.focus();
      return;
    }
    const next = [...digits];
    next[idx] = clean;
    setDigits(next);
    if (clean && idx < 5) {
      digitRefs.current[idx + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (
    idx: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'Backspace') {
      if (!digits[idx] && idx > 0) {
        const next = [...digits];
        next[idx - 1] = '';
        setDigits(next);
        digitRefs.current[idx - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      digitRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < 5) {
      digitRefs.current[idx + 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i += 1) {
      next[i] = pasted[i];
    }
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    digitRefs.current[focusIdx]?.focus();
  };

  const handleGoogleSignIn = () => {
    window.location.href = authApi.getGoogleRedirectUrl();
  };

  const alternateChannel: 'email' | 'phone' | null =
    challenge && challenge.available_channels.length > 1
      ? challenge.channel === 'email'
        ? 'phone'
        : 'email'
      : null;

  return (
    <div className="min-h-screen w-full bg-white flex items-center py-8 sm:py-12">
      <div className="max-w-[1180px] w-full mx-auto px-5 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left: Static Artwork Panel */}
          <AuthStaticHeroPanel />

          {/* Right: Credentials OR "One more step." OTP Verification */}
          {challenge ? (
            <form
              onSubmit={handleVerifyOtp}
              className="flex flex-col items-start gap-5 w-full max-w-[440px]"
            >
              <div className="flex flex-col gap-2">
                <h1 className="text-[36px] sm:text-[42px] font-bold text-black tracking-tight leading-[1.12]">
                  One more step.
                </h1>
                <p className="text-[15px] text-[#767676] leading-relaxed">
                  Enter the 6-digit code sent to{' '}
                  <span className="font-medium text-black">
                    {challenge.masked_target}
                  </span>
                  .
                </p>
              </div>

              {error && (
                <div className="w-full bg-[#fdecec] border border-[#e5322d]/30 text-[#e5322d] px-4 py-3 text-[13px] font-medium rounded-[14px]">
                  {error}
                </div>
              )}

              {/* 6 Individual Rounded OTP Digit Boxes */}
              <div className="flex flex-col gap-2 pt-1">
                {otpError && (
                  <span
                    role="alert"
                    className="text-[12.5px] font-semibold text-[#e5322d]"
                  >
                    {otpError}
                  </span>
                )}
                <div
                  className={`flex items-center gap-2.5 sm:gap-3 ${otpShaking ? 'kova-input-shake' : ''}`}
                >
                  {digits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        digitRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                      maxLength={6}
                      value={digit}
                      aria-label={`Digit ${idx + 1}`}
                      aria-invalid={Boolean(otpError) || undefined}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                      onPaste={handleDigitPaste}
                      className={`w-[46px] h-[58px] sm:w-[54px] sm:h-[66px] bg-[#f5f5f5] focus:bg-white border-2 rounded-[16px] text-center text-[22px] font-bold text-black outline-none transition-all tabular-nums ${
                        otpError
                          ? 'kova-input-error border-[#e5322d] focus:border-[#e5322d]'
                          : 'border-transparent focus:border-[#ff6e20]'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <p className="text-[13.5px] text-[#767676]">
                {resendCooldown > 0 ? (
                  <>You can request a new code in {resendCooldown} seconds.</>
                ) : (
                  <button
                    type="button"
                    disabled={resending}
                    onClick={() => void handleResend()}
                    className="text-[#ff6e20] hover:underline font-medium cursor-pointer disabled:opacity-50"
                  >
                    {resending
                      ? 'Sending a new code...'
                      : 'Resend verification code'}
                  </button>
                )}
              </p>

              <button
                type="submit"
                disabled={submitting || otpCode.length !== 6}
                className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-50 text-white text-[15px] font-semibold px-8 py-3.5 rounded-full transition-colors cursor-pointer"
              >
                {submitting ? 'Verifying...' : 'Verify & sign in'}
              </button>

              <div className="flex flex-col items-start gap-3 pt-1">
                {alternateChannel && (
                  <button
                    type="button"
                    disabled={resending}
                    onClick={() => void handleResend(alternateChannel)}
                    className="text-[14.5px] font-medium text-[#ff6e20] hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {alternateChannel === 'email'
                      ? 'Verify with email instead'
                      : 'Verify with phone number instead'}
                  </button>
                )}

                {/* <button
                  type="button"
                  onClick={() => {
                    setChallenge(null);
                    setDigits(['', '', '', '', '', '']);
                    setError(null);
                    setResendCooldown(0);
                  }}
                  className="text-[14.5px] font-medium text-[#767676] hover:text-black transition-colors cursor-pointer"
                >
                  Try another sign-in method
                </button> */}
              </div>

              <p className="text-[12.5px] text-[#8a8a8a] pt-2">
                Keep this code private. Kova will never ask you to share it.
              </p>
            </form>
          ) : (
            <div className="flex flex-col gap-5 w-full max-w-[440px]">
              {/* <div className="self-start">
                <KovaLogo size="sm" />
              </div> */}

              <div>
                <h1 className="text-[34px] sm:text-[38px] font-bold text-black tracking-tight leading-[1.15]">
                  Sign in
                </h1>
                <p className="text-[15px] text-[#767676] mt-1.5">
                  Sign in with your email address or phone number.
                </p>
              </div>

              {error && (
                <div className="bg-[#fdecec] border border-[#e5322d]/30 text-[#e5322d] px-4 py-3 text-[13px] font-medium rounded-[14px]">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full bg-white border border-[#ececec] hover:border-[#ff6e20] text-[14px] font-semibold text-black py-3.5 rounded-full inline-flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-[18px] h-[18px] shrink-0"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                  />
                  <path
                    fill="#34A853"
                    d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <p className="text-[12px] text-[#767676] text-center">
                or continue with email or phone number
              </p>

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span
                    className={`text-[12px] font-semibold ${
                      credentialError ? 'text-[#e5322d]' : 'text-black'
                    }`}
                  >
                    Email or phone number
                  </span>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={identifier}
                    aria-invalid={Boolean(credentialError) || undefined}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (credentialError) setCredentialError(null);
                    }}
                    placeholder="you@example.com or 012 345 678"
                    className={`h-[42px] border rounded-full px-4 text-[14px] outline-none transition-colors ${
                      credentialError
                        ? 'kova-input-error border-[#e5322d] focus:border-[#e5322d]'
                        : 'border-[#ececec] focus:border-[#ff6e20]'
                    } ${identifierShaking ? 'kova-input-shake' : ''}`}
                  />
                </label>

                <PasswordInput
                  label="Password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (credentialError) setCredentialError(null);
                  }}
                  placeholder="Enter your password"
                  error={credentialError}
                  shakeKey={loginShakeKey}
                  inputClassName="text-[14px]"
                />

                <div className="flex items-center justify-end text-[13px]">
                  <Link
                    to="/forgot-password"
                    className="text-[#ff6e20] font-medium hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[14.5px] font-semibold py-3.5 rounded-full transition-colors cursor-pointer"
                >
                  {submitting ? 'Signing in...' : 'Continue'}
                </button>
              </form>

              <Link
                to="/register"
                className="text-[14px] font-medium text-[#ff6e20] hover:underline"
              >
                New to Kova? Create an account
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Register Page
export function RegisterPage() {
  const { register } = useStore();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [shakeKey, setShakeKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const nameShaking = useShakeAnimation(Boolean(fieldErrors.name), shakeKey);
  const emailShaking = useShakeAnimation(Boolean(fieldErrors.email), shakeKey);
  const phoneShaking = useShakeAnimation(Boolean(fieldErrors.phone), shakeKey);

  const clearFieldError = (field: string) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const nextErrors: Record<string, string> = {};
    if (password.length < 8) {
      nextErrors.password = 'Your password must be at least 8 characters.';
    }
    if (password !== passwordConfirmation) {
      nextErrors.password_confirmation = "Your passwords don't match.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setShakeKey((k) => k + 1);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        password_confirmation: passwordConfirmation,
      });
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const mapped: Record<string, string> = {};
        Object.entries(err.errors).forEach(([key, msgs]) => {
          const first = msgs[0];
          if (first) mapped[key] = toFriendlyErrorMessage(first, err.status);
        });
        if (Object.keys(mapped).length > 0) {
          setFieldErrors(mapped);
          setShakeKey((k) => k + 1);
          return;
        }
      }
      const msg =
        err instanceof ApiError
          ? err.message
          : 'We could not create your account right now. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex items-center py-8 sm:py-12">
      <div className="max-w-[1180px] w-full mx-auto px-5 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <AuthStaticHeroPanel />

          <div className="flex flex-col gap-5 w-full max-w-[440px]">
            {/* <div className="self-start">
              <KovaLogo size="sm" />
            </div> */}

            <div>
              <h1 className="text-[32px] font-bold text-black tracking-tight leading-[1.15]">
                Create your Kova account
              </h1>
              <p className="text-[14.5px] text-[#767676] mt-1">
                Register as a customer to shop verified Cambodia stores.
              </p>
            </div>

            {error && (
              <div className="bg-[#fdecec] border border-[#e5322d]/30 text-[#e5322d] px-4 py-3 text-[13px] font-medium rounded-[14px]">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                window.location.href = authApi.getGoogleRedirectUrl();
              }}
              className="w-full bg-white border border-[#ececec] hover:border-[#ff6e20] text-[14px] font-semibold text-black py-3.5 rounded-full inline-flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-[18px] h-[18px] shrink-0"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                />
                <path
                  fill="#34A853"
                  d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"
                />
                <path
                  fill="#EA4335"
                  d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="flex flex-col gap-4"
            >
              <label className="flex flex-col gap-1.5">
                <span
                  className={`text-[12px] font-semibold ${
                    fieldErrors.name ? 'text-[#e5322d]' : 'text-black'
                  }`}
                >
                  {fieldErrors.name || 'Full name'}
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError('name');
                  }}
                  placeholder="Your full name"
                  className={`h-[42px] border rounded-full px-4 text-[14px] outline-none transition-colors ${
                    fieldErrors.name
                      ? 'kova-input-error border-[#e5322d] focus:border-[#e5322d]'
                      : 'border-[#ececec] focus:border-[#ff6e20]'
                  } ${nameShaking ? 'kova-input-shake' : ''}`}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span
                  className={`text-[12px] font-semibold ${
                    fieldErrors.email ? 'text-[#e5322d]' : 'text-black'
                  }`}
                >
                  {fieldErrors.email || 'Email address'}
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError('email');
                  }}
                  placeholder="you@example.com"
                  className={`h-[42px] border rounded-full px-4 text-[14px] outline-none transition-colors ${
                    fieldErrors.email
                      ? 'kova-input-error border-[#e5322d] focus:border-[#e5322d]'
                      : 'border-[#ececec] focus:border-[#ff6e20]'
                  } ${emailShaking ? 'kova-input-shake' : ''}`}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span
                  className={`text-[12px] font-semibold ${
                    fieldErrors.phone ? 'text-[#e5322d]' : 'text-black'
                  }`}
                >
                  {fieldErrors.phone || 'Phone number (optional)'}
                </span>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    clearFieldError('phone');
                  }}
                  placeholder="012 345 678 or +855 ..."
                  className={`h-[42px] border rounded-full px-4 text-[14px] outline-none transition-colors ${
                    fieldErrors.phone
                      ? 'kova-input-error border-[#e5322d] focus:border-[#e5322d]'
                      : 'border-[#ececec] focus:border-[#ff6e20]'
                  } ${phoneShaking ? 'kova-input-shake' : ''}`}
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
                  clearFieldError('password');
                }}
                placeholder="At least 8 characters"
                error={fieldErrors.password}
                shakeKey={shakeKey}
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
                  clearFieldError('password_confirmation');
                }}
                placeholder="Re-enter your password"
                error={fieldErrors.password_confirmation}
                shakeKey={shakeKey}
                inputClassName="text-[14px]"
              />
              <button
                type="submit"
                disabled={submitting}
                className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[14.5px] font-semibold py-3.5 rounded-full transition-colors cursor-pointer"
              >
                {submitting ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <Link
              to="/login"
              className="text-[14px] font-medium text-[#ff6e20] hover:underline"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Forgot & Reset Password Flow
export function VerificationFlowPage({ mode }: { mode: 'forgot' | 'reset' }) {
  const { showToast, signOut } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const emailShaking = useShakeAnimation(Boolean(fieldErrors.email), shakeKey);

  const clearFieldError = (field: string) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (mode === 'forgot') {
      if (!email.trim()) {
        setFieldErrors({ email: 'Please enter your email address.' });
        setShakeKey((k) => k + 1);
        return;
      }
    } else {
      if (!token || !email.trim()) {
        setFormError(
          'This reset link is invalid or incomplete. Please request a new one.',
        );
        return;
      }
      const nextErrors: Record<string, string> = {};
      if (password.length < 8) {
        nextErrors.password = 'Your password must be at least 8 characters.';
      }
      if (password !== passwordConfirmation) {
        nextErrors.password_confirmation = "Your passwords don't match.";
      }
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        setShakeKey((k) => k + 1);
        return;
      }
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      if (mode === 'forgot') {
        const res = await authApi.forgotPassword(email.trim());
        showToast(
          res.message ||
            'We sent a password reset link to your email. Please check your inbox.',
        );
        navigate('/login');
      } else {
        const res = await authApi.resetPassword({
          token,
          email: email.trim(),
          password,
          password_confirmation: passwordConfirmation,
        });
        await signOut({ silent: true });
        showToast(
          res.message ||
            'Your password has been updated. Please sign in with your new password.',
        );
        navigate('/login', { replace: true });
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.';
      if (mode === 'forgot') {
        setFieldErrors({ email: msg });
        setShakeKey((k) => k + 1);
      } else if (err instanceof ApiError && err.errors?.password?.[0]) {
        setFieldErrors({
          password: toFriendlyErrorMessage(err.errors.password[0], err.status),
        });
        setShakeKey((k) => k + 1);
      } else {
        setFormError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f7f7f7] flex items-center justify-center px-4 py-12">
      <div className="bg-white border border-[#ececec] p-8 max-w-[520px] w-full flex flex-col gap-3 rounded-[24px]">
        <div className="self-start">
          <KovaLogo size="sm" />
        </div>
        <h1 className="text-[28px] font-semibold text-black">
          {mode === 'forgot' ? 'Forgot your password?' : 'Reset your password'}
        </h1>
        <p className="text-[14.5px] text-[#767676]">
          {mode === 'forgot'
            ? 'Enter your registered email address to receive a password reset link.'
            : email
              ? `Choose a new password for ${email}.`
              : 'Choose a new password for your Kova account.'}
        </p>

        {formError && (
          <div className="bg-[#fdecec] border border-[#e5322d]/30 text-[#e5322d] px-4 py-3 text-[13px] font-medium rounded-[14px]">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {mode === 'forgot' ? (
            <label className="flex flex-col gap-1.5">
              <span
                className={`text-[12px] font-semibold ${
                  fieldErrors.email ? 'text-[#e5322d]' : 'text-black'
                }`}
              >
                {fieldErrors.email || 'Email address'}
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError('email');
                }}
                placeholder="Email address"
                className={`h-[42px] border rounded-full px-4 text-[14px] outline-none transition-colors ${
                  fieldErrors.email
                    ? 'kova-input-error border-[#e5322d] focus:border-[#e5322d]'
                    : 'border-[#ececec] focus:border-[#ff6e20]'
                } ${emailShaking ? 'kova-input-shake' : ''}`}
              />
            </label>
          ) : (
            <>
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="token" value={token} />
              <PasswordInput
                label="New password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFieldError('password');
                }}
                placeholder="New password (min 8 characters)"
                error={fieldErrors.password}
                shakeKey={shakeKey}
                inputClassName="text-[14px]"
              />
              <PasswordInput
                label="Confirm new password"
                required
                minLength={8}
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(e) => {
                  setPasswordConfirmation(e.target.value);
                  clearFieldError('password_confirmation');
                }}
                placeholder="Confirm new password"
                error={fieldErrors.password_confirmation}
                shakeKey={shakeKey}
                inputClassName="text-[14px]"
              />
            </>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[14px] font-semibold py-3.5 rounded-full"
          >
            {submitting
              ? 'Submitting...'
              : mode === 'forgot'
                ? 'Send reset link'
                : 'Reset password'}
          </button>
        </form>

        <Link
          to="/login"
          className="text-[13.5px] text-[#767676] hover:text-[#ff6e20]"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
