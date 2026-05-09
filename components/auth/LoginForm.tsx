'use client';

import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { usePlatformName, usePlatformContext } from '@/components/providers/PlatformProvider';

type ForgotStep = 'login' | 'forgot-email' | 'forgot-otp' | 'forgot-newpass' | 'forgot-done';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const platformName = usePlatformName();
  const { logoFullUrl, logoAuthHeight } = usePlatformContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // ── Forgot Password State ────────────────────
  const [forgotStep, setForgotStep] = useState<ForgotStep>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotEmailFocused, setForgotEmailFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);
  const [newPassFocused, setNewPassFocused] = useState(false);
  const [confirmPassFocused, setConfirmPassFocused] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Login failed');
        return;
      }

      if (redirectTo) { router.push(redirectTo); return; }

      const role = data.data?.user?.role || 'student';
      const dashboardMap: Record<string, string> = {
        superadmin: '/superadmin',
        batch_coordinator: '/batch-coordinator',
        academic_operator: '/academic-operator',
        academic: '/academic-operator',
        hr: '/hr',
        teacher: '/teacher',
        student: '/student',
        parent: '/parent',
        owner: '/owner',
        ghost: '/ghost',
      };
      router.push(dashboardMap[role] || '/student');
    } catch {
      setError('Network error — could not reach server');
    } finally {
      setLoading(false);
    }
  }

  const emailActive = emailFocused || email.length > 0;
  const passwordActive = passwordFocused || password.length > 0;
  const forgotEmailActive = forgotEmailFocused || forgotEmail.length > 0;
  const otpActive = otpFocused || otp.length > 0;
  const newPassActive = newPassFocused || newPassword.length > 0;
  const confirmPassActive = confirmPassFocused || confirmPassword.length > 0;

  // ── Forgot Password Handlers ──────────────────
  function resetForgotState() {
    setForgotStep('login');
    setForgotEmail('');
    setOtp('');
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  }

  async function handleForgotSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail) { setError('Please enter your email'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok && !data.success) {
        setError(data.error || 'Failed to send OTP');
        return;
      }
      setForgotStep('forgot-otp');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp || otp.length !== 6) { setError('Enter the 6-digit code'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase(), otp }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid OTP');
        return;
      }
      setResetToken(data.data.resetToken);
      setForgotStep('forgot-newpass');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to reset password');
        return;
      }
      setForgotStep('forgot-done');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  // ── Error Banner ──────────────────────────────
  const errorBanner = error ? (
    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 sm:bg-red-500/15 sm:border-red-400/30 sm:text-red-300 flex items-start gap-2.5">
      <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-red-100 sm:bg-red-400/25 flex items-center justify-center">
        <span className="text-red-500 sm:text-red-300 text-[10px] font-bold">!</span>
      </span>
      <span>{error}</span>
    </div>
  ) : null;

  // ── Floating Input ────────────────────────────
  function floatingInput(
    id: string, label: string, value: string,
    onChange: (v: string) => void,
    focused: boolean, onFocus: () => void, onBlur: () => void,
    opts?: { type?: string; autoComplete?: string; maxLength?: number; inputMode?: string }
  ) {
    const active = focused || value.length > 0;
    return (
      <div className="relative">
        <input
          id={id}
          type={opts?.type || 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          disabled={loading}
          autoComplete={opts?.autoComplete}
          maxLength={opts?.maxLength}
          inputMode={opts?.inputMode as React.HTMLAttributes<HTMLInputElement>['inputMode']}
          required
          className={`peer w-full h-14 px-4 pt-4 rounded-xl border bg-gray-50 text-gray-900 placeholder:text-gray-400 sm:bg-white/10 sm:text-white sm:placeholder:text-emerald-200/40 text-[15px] outline-none transition-all duration-200 disabled:opacity-50 ${
            focused
              ? 'border-emerald-500 ring-2 ring-emerald-500/10 sm:border-emerald-400/60 sm:ring-emerald-400/15'
              : 'border-gray-200 hover:border-gray-300 sm:border-white/15 sm:hover:border-white/25'
          }`}
        />
        <label
          htmlFor={id}
          className={`absolute left-4 transition-all duration-200 pointer-events-none ${
            active
              ? 'top-1.5 text-[11px] font-medium text-emerald-600 sm:text-emerald-300'
              : 'top-1/2 -translate-y-1/2 text-[15px] text-gray-400 sm:text-emerald-200/50'
          }`}
        >
          {label}
        </label>
      </div>
    );
  }

  // ── Submit Button Helper ──────────────────────
  function submitBtn(label: string, loadingLabel: string, disabled: boolean) {
    return (
      <button
        type="submit"
        disabled={loading || disabled}
        className="group relative w-full h-13 rounded-xl text-emerald-950 font-medium text-[15px] bg-linear-to-r from-emerald-300 to-teal-300 hover:from-emerald-200 hover:to-teal-200 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 overflow-hidden shadow-lg shadow-emerald-400/15"
      >
        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-linear-to-r from-transparent via-white/10 to-transparent" />
        {loading ? (
          <span className="relative flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            {loadingLabel}
          </span>
        ) : (
          <span className="relative flex items-center justify-center gap-2">
            {label}
            <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform duration-200" />
          </span>
        )}
      </button>
    );
  }

  // ── Back Button Helper ────────────────────────
  function backBtn(onClick: () => void) {
    return (
      <button
        type="button"
        onClick={() => { setError(''); onClick(); }}
        className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 sm:text-emerald-200/60 sm:hover:text-emerald-200 text-sm transition-colors mb-6"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full justify-center max-w-sm mx-auto">
      {/* Logo — mobile only (desktop logo is in the page top-left) */}
      <div className="mb-6 sm:hidden">
        <img src={logoFullUrl ?? '/logo/full.png'} alt="Logo" style={{ height: logoAuthHeight }} className="object-contain drop-shadow-lg" />
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* ── LOGIN FORM ──────────────────────────── */}
      {/* ═══════════════════════════════════════════ */}
      {forgotStep === 'login' && (
        <>
          <div className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-white mb-2">Welcome back</h1>
            <p className="text-gray-500 sm:text-emerald-200/70 text-[15px]">Sign in to continue to your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {errorBanner}

            {/* Email */}
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                disabled={loading}
                autoComplete="email"
                required
                className={`peer w-full h-14 px-4 pt-4 rounded-xl border bg-gray-50 text-gray-900 placeholder:text-gray-400 sm:bg-white/10 sm:text-white sm:placeholder:text-emerald-200/40 text-[15px] outline-none transition-all duration-200 disabled:opacity-50 ${
                  emailFocused
                    ? 'border-emerald-500 ring-2 ring-emerald-500/10 sm:border-emerald-400/60 sm:ring-emerald-400/15'
                    : 'border-gray-200 hover:border-gray-300 sm:border-white/15 sm:hover:border-white/25'
                }`}
              />
              <label
                htmlFor="email"
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  emailActive
                    ? 'top-1.5 text-[11px] font-medium text-emerald-600 sm:text-emerald-300'
                    : 'top-1/2 -translate-y-1/2 text-[15px] text-gray-400 sm:text-emerald-200/50'
                }`}
              >
                Email address
              </label>
            </div>

            {/* Password */}
            <div className="relative">
              <input
                ref={passwordRef}
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                disabled={loading}
                autoComplete="current-password"
                required
                className={`peer w-full h-14 px-4 pt-4 pr-12 rounded-xl border bg-gray-50 text-gray-900 placeholder:text-gray-400 sm:bg-white/10 sm:text-white sm:placeholder:text-emerald-200/40 text-[15px] outline-none transition-all duration-200 disabled:opacity-50 ${
                  passwordFocused
                    ? 'border-emerald-500 ring-2 ring-emerald-500/10 sm:border-emerald-400/60 sm:ring-emerald-400/15'
                    : 'border-gray-200 hover:border-gray-300 sm:border-white/15 sm:hover:border-white/25'
                }`}
              />
              <label
                htmlFor="password"
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  passwordActive
                    ? 'top-1.5 text-[11px] font-medium text-emerald-600 sm:text-emerald-300'
                    : 'top-1/2 -translate-y-1/2 text-[15px] text-gray-400 sm:text-emerald-200/50'
                }`}
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 sm:text-emerald-200/50 sm:hover:text-white/70 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
              </button>
            </div>

            {/* Forgot password link */}
            <div className="flex justify-end -mt-2">
              <button
                type="button"
                onClick={() => { setError(''); setForgotEmail(email); setForgotStep('forgot-email'); }}
                className="text-emerald-600 hover:text-emerald-700 sm:text-emerald-300/70 sm:hover:text-emerald-200 text-[13px] transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {submitBtn('Continue', 'Signing in…', !email || !password)}
          </form>
        </>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ── FORGOT: ENTER EMAIL ─────────────────── */}
      {/* ═══════════════════════════════════════════ */}
      {forgotStep === 'forgot-email' && (
        <>
          {backBtn(resetForgotState)}
          <div className="mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 sm:bg-emerald-400/15 flex items-center justify-center">
              <Mail className="size-5 text-emerald-600 sm:text-emerald-300" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-white">Reset password</h1>
              <p className="text-gray-500 sm:text-emerald-200/60 text-[13px]">We&apos;ll send a verification code to your email</p>
            </div>
          </div>

          <form onSubmit={handleForgotSubmitEmail} className="space-y-6">
            {errorBanner}
            {floatingInput('forgot-email', 'Email address', forgotEmail, setForgotEmail, forgotEmailFocused, () => setForgotEmailFocused(true), () => setForgotEmailFocused(false), { type: 'email', autoComplete: 'email' })}
            {submitBtn('Send Code', 'Sending…', !forgotEmail)}
          </form>
        </>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ── FORGOT: VERIFY OTP ──────────────────── */}
      {/* ═══════════════════════════════════════════ */}
      {forgotStep === 'forgot-otp' && (
        <>
          {backBtn(() => setForgotStep('forgot-email'))}
          <div className="mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 sm:bg-emerald-400/15 flex items-center justify-center">
              <ShieldCheck className="size-5 text-emerald-600 sm:text-emerald-300" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-white">Enter code</h1>
              <p className="text-gray-500 sm:text-emerald-200/60 text-[13px]">Sent to <span className="text-emerald-600 sm:text-emerald-300">{forgotEmail}</span></p>
            </div>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-6">
            {errorBanner}
            {floatingInput('otp', '6-digit code', otp, (v) => setOtp(v.replace(/\D/g, '').slice(0, 6)), otpFocused, () => setOtpFocused(true), () => setOtpFocused(false), { inputMode: 'numeric', maxLength: 6 })}

            <p className="text-[13px] text-gray-400 sm:text-emerald-200/40 -mt-2">
              Didn&apos;t receive it?{' '}
              <button
                type="button"
                onClick={handleForgotSubmitEmail as unknown as () => void}
                className="text-emerald-600 hover:text-emerald-700 sm:text-emerald-300/70 sm:hover:text-emerald-200 underline underline-offset-2"
                disabled={loading}
              >
                Resend code
              </button>
            </p>

            {submitBtn('Verify', 'Verifying…', otp.length !== 6)}
          </form>
        </>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ── FORGOT: NEW PASSWORD ────────────────── */}
      {/* ═══════════════════════════════════════════ */}
      {forgotStep === 'forgot-newpass' && (
        <>
          <div className="mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 sm:bg-emerald-400/15 flex items-center justify-center">
              <KeyRound className="size-5 text-emerald-600 sm:text-emerald-300" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-white">New password</h1>
              <p className="text-gray-500 sm:text-emerald-200/60 text-[13px]">Choose a strong password for your account</p>
            </div>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-6">
            {errorBanner}

            <div className="relative">
              <input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onFocus={() => setNewPassFocused(true)}
                onBlur={() => setNewPassFocused(false)}
                disabled={loading}
                autoComplete="new-password"
                required
                className={`peer w-full h-14 px-4 pt-4 pr-12 rounded-xl border bg-gray-50 text-gray-900 placeholder:text-gray-400 sm:bg-white/10 sm:text-white sm:placeholder:text-emerald-200/40 text-[15px] outline-none transition-all duration-200 disabled:opacity-50 ${
                  newPassFocused
                    ? 'border-emerald-500 ring-2 ring-emerald-500/10 sm:border-emerald-400/60 sm:ring-emerald-400/15'
                    : 'border-gray-200 hover:border-gray-300 sm:border-white/15 sm:hover:border-white/25'
                }`}
              />
              <label
                htmlFor="new-password"
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  newPassActive
                    ? 'top-1.5 text-[11px] font-medium text-emerald-600 sm:text-emerald-300'
                    : 'top-1/2 -translate-y-1/2 text-[15px] text-gray-400 sm:text-emerald-200/50'
                }`}
              >
                New password
              </label>
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 sm:text-emerald-200/50 sm:hover:text-white/70 transition-colors"
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
              </button>
            </div>

            {floatingInput('confirm-password', 'Confirm password', confirmPassword, setConfirmPassword, confirmPassFocused, () => setConfirmPassFocused(true), () => setConfirmPassFocused(false), { type: 'password', autoComplete: 'new-password' })}

            {submitBtn('Reset Password', 'Resetting…', newPassword.length < 6 || !confirmPassword)}
          </form>
        </>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ── FORGOT: SUCCESS ─────────────────────── */}
      {/* ═══════════════════════════════════════════ */}
      {forgotStep === 'forgot-done' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 sm:bg-emerald-400/15 flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="size-8 text-emerald-600 sm:text-emerald-300" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-white mb-2">Password updated</h1>
          <p className="text-gray-500 sm:text-emerald-200/60 text-[14px] mb-8">You can now sign in with your new password.</p>
          <button
            onClick={resetForgotState}
            className="group relative w-full h-13 rounded-xl text-emerald-950 font-medium text-[15px] bg-linear-to-r from-emerald-300 to-teal-300 hover:from-emerald-200 hover:to-teal-200 active:scale-[0.98] transition-all duration-200 overflow-hidden shadow-lg shadow-emerald-400/15"
          >
            <span className="relative flex items-center justify-center gap-2">
              Back to Sign In
              <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </span>
          </button>
        </div>
      )}

      {/* Footer */}
      <p className="mt-10 text-center text-xs text-gray-400 sm:text-emerald-200/40">
        {platformName} Learning &middot; Empowering education
      </p>
    </div>
  );
}
