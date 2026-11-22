import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { ApiError, authApi } from '../../services/api';
import { getUserDashboardPath } from '../../utils/authRedirect';
import { KovaLogo } from '../../components/KovaLogo';

function AuthBrandPanel() {
  const { settings } = useStore();
  return (
    <div className="flex flex-col gap-6 flex-1">
      <div className="self-start">
        <KovaLogo />
      </div>
      <div className="kova-gradient rounded-[24px] p-8 flex flex-col gap-4 text-white">
        <span className="self-start bg-white/20 text-white text-[12px] font-bold px-3.5 py-1.5 rounded-full">
          KOVA MARKETPLACE · CAMBODIA
        </span>
        <h2 className="text-[28px] sm:text-[32px] font-bold leading-[1.25]">
          Shop verified stores across Cambodia with instant Bakong KHQR.
        </h2>
        <p className="text-[14px] text-[#fff0e6] leading-[1.55]">
          Sign in with your Kova account or Google to sync your cart, manage
          delivery addresses, and track orders in real time.
        </p>
        <div className="flex flex-wrap gap-2 pt-2 text-[12px] font-semibold">
          <span className="bg-white/20 px-3 py-1.5 rounded-full">
            Bakong KHQR ({(settings.services?.bakong_environment || 'sit').toUpperCase()})
          </span>
          <span className="bg-white/20 px-3 py-1.5 rounded-full">
            Google OAuth
          </span>
          <span className="bg-white/20 px-3 py-1.5 rounded-full">
            Cloudinary Media
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-1">
        <p className="text-[28px] font-semibold text-black leading-[1.3]">
          One account for every verified store.
        </p>
        <p className="text-[15px] text-[#767676] leading-[1.5]">
          Secure Sanctum authentication, multi-store cart synchronization, and
          official National Bank of Cambodia KHQR payments.
        </p>
      </div>
    </div>
  );
}

// Login Page
export function LoginPage() {
  const { login, showToast } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    searchParams.get('google_error'),
  );
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const signedInUser = await login(email.trim(), password);
      navigate(getUserDashboardPath(signedInUser) ?? '/', { replace: true });
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Unable to sign in.';
      setError(msg);
      showToast(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    window.location.href = authApi.getGoogleRedirectUrl();
  };

  return (
    <div className="min-h-screen w-full bg-[#f7f7f7] flex items-center py-8">
      <div className="kova-container px-4 lg:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_480px] gap-10 items-center">
          <AuthBrandPanel />

          <div className="bg-white border border-[#ececec] rounded-[24px] p-7 sm:p-8 flex flex-col gap-5">
          <div>
            <h1 className="text-[32px] font-semibold text-black leading-[1.25]">
              Sign in
            </h1>
            <p className="text-[15px] text-[#767676] mt-1">
              Sign in to your Kova account.
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
            className="w-full bg-white border border-[#ececec] hover:border-[#ff6e20] text-[14px] font-semibold text-black py-3.5 rounded-[25px] transition-colors"
          >
            Continue with Google
          </button>

          <p className="text-[12px] text-[#767676] text-center">
            or continue with email
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-black">
                Email address
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-[42px] border border-[#ececec] focus:border-[#ff6e20] rounded-full px-4 text-[14px] outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-black">
                Password
              </span>
              <input
                type="password"
                required
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
              className="w-full bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[14px] font-semibold py-3.5 rounded-[12px] transition-colors"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

            <Link
              to="/register"
              className="text-[14px] font-medium text-[#ff6e20] hover:underline"
            >
              New to Kova? Create an account
            </Link>
          </div>
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
    <div className="min-h-screen w-full bg-[#f7f7f7] flex items-center py-8">
      <div className="kova-container px-4 lg:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_480px] gap-10 items-center">
          <AuthBrandPanel />

          <div className="bg-white border border-[#ececec] rounded-[24px] p-7 sm:p-8 flex flex-col gap-5">
          <div>
            <h1 className="text-[30px] font-semibold text-black">
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
            className="w-full bg-white border border-[#ececec] hover:border-[#ff6e20] text-[14px] font-semibold text-black py-3.5 rounded-[25px] transition-colors"
          >
            Continue with Google
          </button>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium">Full name</span>
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
              <span className="text-[12px] font-medium">Email address</span>
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
              <span className="text-[12px] font-medium">
                Phone number (optional)
              </span>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+855 ..."
                className="h-[42px] border border-[#ececec] rounded-full px-4 text-[14px] outline-none focus:border-[#ff6e20]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium">Password</span>
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
              <span className="text-[12px] font-medium">Confirm password</span>
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
              className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[14px] font-semibold py-3.5 rounded-[12px]"
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
export function VerificationFlowPage({
  mode,
}: {
  mode: 'forgot' | 'reset';
}) {
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
            className="bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[14px] font-semibold py-3.5 rounded-[12px]"
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
