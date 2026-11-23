import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore, type LoginChallenge } from '../../context/StoreContext';
import { ApiError, authApi } from '../../services/api';
import { getUserDashboardPath } from '../../utils/authRedirect';
import { KovaLogo } from '../../components/KovaLogo';

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
  const [error, setError] = useState<string | null>(
    searchParams.get('google_error'),
  );
  const [submitting, setSubmitting] = useState(false);

  // Step 2: OTP verification state
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

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
    setSubmitting(true);
    try {
      const result = await login(identifier.trim(), password);
      if (result.requires_verification) {
        setChallenge(result);
        setDigits(['', '', '', '', '', '']);
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
      const msg = err instanceof ApiError ? err.message : 'Unable to sign in.';
      setError(msg);
      showToast(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const otpCode = digits.join('');

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    if (!/^\d{6}$/.test(otpCode)) {
      setError('Please enter all 6 digits of your verification code.');
      return;
    }
    setError(null);
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
          : 'Invalid or expired verification code.';
      setError(msg);
      showToast(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (nextChannel?: 'email' | 'phone') => {
    if (!challenge || resending) return;
    if (!nextChannel && resendCooldown > 0) return;
    setError(null);
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
          : 'Unable to send verification code.';
      setError(msg);
      showToast(msg);
    } finally {
      setResending(false);
    }
  };

  const handleDigitChange = (idx: number, raw: string) => {
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
                <div className="w-full bg-[#fdecec] border border-[#e5322d]/30 text-[#e5322d] rounded-[14px] px-4 py-3 text-[13px] font-medium">
                  {error}
                </div>
              )}

              {/* 6 Individual Rounded OTP Digit Boxes */}
              <div className="flex items-center gap-2.5 sm:gap-3 pt-1">
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
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                    onPaste={handleDigitPaste}
                    className="w-[46px] h-[58px] sm:w-[54px] sm:h-[66px] bg-[#f5f5f5] focus:bg-white border-2 border-transparent focus:border-[#ff6e20] rounded-[16px] text-center text-[22px] font-bold text-black outline-none transition-all tabular-nums"
                  />
                ))}
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
                <div className="bg-[#fdecec] border border-[#e5322d]/30 text-[#e5322d] rounded-[14px] px-4 py-3 text-[13px] font-medium">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full bg-white border border-[#ececec] hover:border-[#ff6e20] text-[14px] font-semibold text-black py-3.5 rounded-full transition-colors cursor-pointer"
              >
                Continue with Google
              </button>

              <p className="text-[12px] text-[#767676] text-center">
                or continue with email or phone number
              </p>

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-black">
                    Email or phone number
                  </span>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@example.com or 012 345 678"
                    className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[14px] outline-none"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-black">
                    Password
                  </span>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[14px] outline-none"
                  />
                </label>

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
                  {submitting ? 'Continueing...' : 'Continue'}
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
  const { register, showToast } = useStore();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== passwordConfirmation) {
      setError('Passwords do not match.');
      return;
    }
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
      const msg =
        err instanceof ApiError ? err.message : 'Unable to create account.';
      setError(msg);
      showToast(msg);
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
              <div className="bg-[#fdecec] border border-[#e5322d]/30 text-[#e5322d] rounded-[14px] px-4 py-3 text-[13px] font-medium">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                window.location.href = authApi.getGoogleRedirectUrl();
              }}
              className="w-full bg-white border border-[#ececec] hover:border-[#ff6e20] text-[14px] font-semibold text-black py-3.5 rounded-full transition-colors cursor-pointer"
            >
              Continue with Google
            </button>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold">Full name</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
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
                <span className="text-[12px] font-semibold">
                  Phone number (optional)
                </span>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="012 345 678 or +855 ..."
                  className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold">Password</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold">
                  Confirm password
                </span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder="Re-enter your password"
                  className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
                />
              </label>
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
  const { showToast } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'reset' && (!token || !email.trim())) {
      showToast('Invalid or missing reset link. Please request a new one.');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'forgot') {
        const res = await authApi.forgotPassword(email.trim());
        showToast(res.message || 'Password reset link sent.');
        navigate('/login');
      } else {
        const res = await authApi.resetPassword({
          token,
          email: email.trim(),
          password,
          password_confirmation: passwordConfirmation,
        });
        showToast(res.message || 'Password reset successfully.');
        navigate('/login');
      }
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Unable to process request.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f7f7f7] flex items-center justify-center px-4 py-12">
      <div className="bg-white border border-[#ececec] rounded-[24px] p-8 max-w-[520px] w-full flex flex-col gap-5">
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'forgot' ? (
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
            />
          ) : (
            <>
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="token" value={token} />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
              />
              <input
                type="password"
                required
                minLength={8}
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                placeholder="Confirm new password"
                className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
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
