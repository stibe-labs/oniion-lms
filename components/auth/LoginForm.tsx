'use client';

import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { usePlatformName, useAuthConfig } from '@/components/providers/PlatformProvider';

type ForgotStep = 'login' | 'forgot-email' | 'forgot-otp' | 'forgot-newpass' | 'forgot-done';

export default function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get('redirect');
  const platformName = usePlatformName();
  const { accentColor } = useAuthConfig();

  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [showPassword,   setShowPassword]   = useState(false);
  const [emailFocused,   setEmailFocused]   = useState(false);
  const [passFocused,    setPassFocused]    = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Forgot password state
  const [forgotStep,          setForgotStep]          = useState<ForgotStep>('login');
  const [forgotEmail,         setForgotEmail]         = useState('');
  const [otp,                 setOtp]                 = useState('');
  const [resetToken,          setResetToken]          = useState('');
  const [newPassword,         setNewPassword]         = useState('');
  const [confirmPassword,     setConfirmPassword]     = useState('');
  const [showNewPassword,     setShowNewPassword]     = useState(false);
  const [forgotEmailFocused,  setForgotEmailFocused]  = useState(false);
  const [otpFocused,          setOtpFocused]          = useState(false);
  const [newPassFocused,      setNewPassFocused]      = useState(false);
  const [confirmPassFocused,  setConfirmPassFocused]  = useState(false);

  // ── Auth handlers ──────────────────────────────────────────────────────────

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
      if (!res.ok || !data.success) { setError(data.error || 'Login failed'); return; }
      if (redirectTo) { router.push(redirectTo); return; }
      const role = data.data?.user?.role || 'student';
      const map: Record<string, string> = {
        superadmin: '/superadmin', batch_coordinator: '/batch-coordinator',
        academic_operator: '/academic-operator', academic: '/academic-operator',
        hr: '/hr', teacher: '/teacher', student: '/student',
        parent: '/parent', owner: '/owner', ghost: '/ghost',
      };
      router.push(map[role] || '/student');
    } catch {
      setError('Network error — could not reach server');
    } finally {
      setLoading(false);
    }
  }

  function resetForgotState() {
    setForgotStep('login');
    setForgotEmail(''); setOtp(''); setResetToken('');
    setNewPassword(''); setConfirmPassword(''); setError('');
  }

  async function handleForgotSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail) { setError('Please enter your email'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok && !data.success) { setError(data.error || 'Failed to send OTP'); return; }
      setForgotStep('forgot-otp');
    } catch { setError('Network error'); } finally { setLoading(false); }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp || otp.length !== 6) { setError('Enter the 6-digit code'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase(), otp }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error || 'Invalid OTP'); return; }
      setResetToken(data.data.resetToken);
      setForgotStep('forgot-newpass');
    } catch { setError('Network error'); } finally { setLoading(false); }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error || 'Failed to reset password'); return; }
      setForgotStep('forgot-done');
    } catch { setError('Network error'); } finally { setLoading(false); }
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────

  const errorBanner = error ? (
    <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 flex items-start gap-2.5">
      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
        <span className="text-red-500 text-[10px] font-bold leading-none">!</span>
      </span>
      <span className="leading-snug">{error}</span>
    </div>
  ) : null;

  function FloatingInput({
    id, label, value, onChange, focused, onFocus, onBlur,
    type = 'text', autoComplete, maxLength, inputMode, inputRef, extra,
  }: {
    id: string; label: string; value: string;
    onChange: (v: string) => void;
    focused: boolean; onFocus: () => void; onBlur: () => void;
    type?: string; autoComplete?: string; maxLength?: number;
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
    inputRef?: React.Ref<HTMLInputElement>;
    extra?: React.ReactNode;
  }) {
    const active = focused || value.length > 0;
    return (
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          disabled={loading}
          autoComplete={autoComplete}
          maxLength={maxLength}
          inputMode={inputMode}
          required
          className="w-full h-14 px-4 pt-4 rounded-xl border bg-gray-50 text-gray-900 text-[15px] outline-none transition-all duration-200 disabled:opacity-50"
          style={
            focused
              ? { borderColor: accentColor, boxShadow: `0 0 0 3px ${accentColor}1a` }
              : { borderColor: '#e5e7eb' }
          }
        />
        <label
          htmlFor={id}
          className={`absolute left-4 transition-all duration-200 pointer-events-none ${
            active ? 'top-1.5 text-[11px] font-medium' : 'top-1/2 -translate-y-1/2 text-[15px] text-gray-400'
          }`}
          style={active ? { color: accentColor } : undefined}
        >
          {label}
        </label>
        {extra}
      </div>
    );
  }

  function SubmitBtn({ label, loadingLabel, disabled }: { label: string; loadingLabel: string; disabled: boolean }) {
    return (
      <button
        type="submit"
        disabled={loading || disabled}
        className="group w-full h-12 rounded-xl font-semibold text-[15px] text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
          boxShadow: `0 8px 24px ${accentColor}30`,
        }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            {loadingLabel}
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            {label}
            <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform duration-200" />
          </span>
        )}
      </button>
    );
  }

  function BackBtn({ onClick }: { onClick: () => void }) {
    return (
      <button
        type="button"
        onClick={() => { setError(''); onClick(); }}
        className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm transition-colors mb-6"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </button>
    );
  }

  function StepIcon({ icon: Icon }: { icon: React.ElementType }) {
    return (
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${accentColor}18` }}
      >
        <Icon className="size-5" style={{ color: accentColor }} />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ══ LOGIN ══════════════════════════════════════════════════════════════ */}
      {forgotStep === 'login' && (
        <>
          <div className="mb-8">
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: accentColor, boxShadow: `0 0 0 3px ${accentColor}28` }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' as const, color: `${accentColor}99` }}>
                Secure Sign In
              </span>
            </div>
            <h1 style={{ fontSize: 27, fontWeight: 800, letterSpacing: -0.4, color: '#0f172a', margin: '0 0 8px', lineHeight: 1.2 }}>
              Welcome back
            </h1>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
              Sign in to continue your learning journey
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorBanner}

            {/* Email */}
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                disabled={loading}
                autoComplete="email"
                required
                className="w-full h-14 px-4 pt-4 rounded-xl border bg-gray-50 text-gray-900 text-[15px] outline-none transition-all duration-200 disabled:opacity-50"
                style={emailFocused
                  ? { borderColor: accentColor, boxShadow: `0 0 0 3px ${accentColor}1a` }
                  : { borderColor: '#e5e7eb' }
                }
              />
              <label
                htmlFor="email"
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  (emailFocused || email.length > 0) ? 'top-1.5 text-[11px] font-medium' : 'top-1/2 -translate-y-1/2 text-[15px] text-gray-400'
                }`}
                style={(emailFocused || email.length > 0) ? { color: accentColor } : undefined}
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
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
                disabled={loading}
                autoComplete="current-password"
                required
                className="w-full h-14 px-4 pt-4 pr-12 rounded-xl border bg-gray-50 text-gray-900 text-[15px] outline-none transition-all duration-200 disabled:opacity-50"
                style={passFocused
                  ? { borderColor: accentColor, boxShadow: `0 0 0 3px ${accentColor}1a` }
                  : { borderColor: '#e5e7eb' }
                }
              />
              <label
                htmlFor="password"
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  (passFocused || password.length > 0) ? 'top-1.5 text-[11px] font-medium' : 'top-1/2 -translate-y-1/2 text-[15px] text-gray-400'
                }`}
                style={(passFocused || password.length > 0) ? { color: accentColor } : undefined}
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
              </button>
            </div>

            {/* Forgot link */}
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={() => { setError(''); setForgotEmail(email); setForgotStep('forgot-email'); }}
                className="text-[13px] transition-colors hover:opacity-70"
                style={{ color: accentColor }}
              >
                Forgot password?
              </button>
            </div>

            <SubmitBtn label="Sign in" loadingLabel="Signing in…" disabled={!email || !password} />
          </form>
        </>
      )}

      {/* ══ FORGOT: EMAIL ══════════════════════════════════════════════════════ */}
      {forgotStep === 'forgot-email' && (
        <>
          <BackBtn onClick={resetForgotState} />
          <div className="mb-8 flex items-center gap-3">
            <StepIcon icon={Mail} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Reset password</h1>
              <p className="text-gray-500 text-[13px] mt-0.5">We&apos;ll send a code to your email</p>
            </div>
          </div>
          <form onSubmit={handleForgotSubmitEmail} className="space-y-4">
            {errorBanner}
            <FloatingInput
              id="forgot-email" label="Email address"
              value={forgotEmail} onChange={setForgotEmail}
              focused={forgotEmailFocused}
              onFocus={() => setForgotEmailFocused(true)}
              onBlur={() => setForgotEmailFocused(false)}
              type="email" autoComplete="email"
            />
            <SubmitBtn label="Send Code" loadingLabel="Sending…" disabled={!forgotEmail} />
          </form>
        </>
      )}

      {/* ══ FORGOT: OTP ════════════════════════════════════════════════════════ */}
      {forgotStep === 'forgot-otp' && (
        <>
          <BackBtn onClick={() => setForgotStep('forgot-email')} />
          <div className="mb-8 flex items-center gap-3">
            <StepIcon icon={ShieldCheck} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Enter code</h1>
              <p className="text-gray-500 text-[13px] mt-0.5">
                Sent to <span style={{ color: accentColor }}>{forgotEmail}</span>
              </p>
            </div>
          </div>
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {errorBanner}
            <FloatingInput
              id="otp" label="6-digit code"
              value={otp} onChange={v => setOtp(v.replace(/\D/g, '').slice(0, 6))}
              focused={otpFocused}
              onFocus={() => setOtpFocused(true)}
              onBlur={() => setOtpFocused(false)}
              inputMode="numeric" maxLength={6}
            />
            <p className="text-[13px] text-gray-400">
              Didn&apos;t receive it?{' '}
              <button
                type="button"
                onClick={handleForgotSubmitEmail as unknown as () => void}
                disabled={loading}
                className="underline underline-offset-2 transition-opacity hover:opacity-70"
                style={{ color: accentColor }}
              >
                Resend code
              </button>
            </p>
            <SubmitBtn label="Verify" loadingLabel="Verifying…" disabled={otp.length !== 6} />
          </form>
        </>
      )}

      {/* ══ FORGOT: NEW PASSWORD ═══════════════════════════════════════════════ */}
      {forgotStep === 'forgot-newpass' && (
        <>
          <div className="mb-8 flex items-center gap-3">
            <StepIcon icon={KeyRound} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">New password</h1>
              <p className="text-gray-500 text-[13px] mt-0.5">Choose a strong password</p>
            </div>
          </div>
          <form onSubmit={handleResetPassword} className="space-y-4">
            {errorBanner}

            {/* New password */}
            <div className="relative">
              <input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                onFocus={() => setNewPassFocused(true)}
                onBlur={() => setNewPassFocused(false)}
                disabled={loading}
                autoComplete="new-password"
                required
                className="w-full h-14 px-4 pt-4 pr-12 rounded-xl border bg-gray-50 text-gray-900 text-[15px] outline-none transition-all duration-200 disabled:opacity-50"
                style={newPassFocused
                  ? { borderColor: accentColor, boxShadow: `0 0 0 3px ${accentColor}1a` }
                  : { borderColor: '#e5e7eb' }
                }
              />
              <label
                htmlFor="new-password"
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  (newPassFocused || newPassword.length > 0) ? 'top-1.5 text-[11px] font-medium' : 'top-1/2 -translate-y-1/2 text-[15px] text-gray-400'
                }`}
                style={(newPassFocused || newPassword.length > 0) ? { color: accentColor } : undefined}
              >
                New password
              </label>
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                tabIndex={-1}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showNewPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
              </button>
            </div>

            <FloatingInput
              id="confirm-password" label="Confirm password"
              value={confirmPassword} onChange={setConfirmPassword}
              focused={confirmPassFocused}
              onFocus={() => setConfirmPassFocused(true)}
              onBlur={() => setConfirmPassFocused(false)}
              type="password" autoComplete="new-password"
            />

            <SubmitBtn label="Reset Password" loadingLabel="Resetting…" disabled={newPassword.length < 6 || !confirmPassword} />
          </form>
        </>
      )}

      {/* ══ FORGOT: SUCCESS ════════════════════════════════════════════════════ */}
      {forgotStep === 'forgot-done' && (
        <div className="text-center py-6">
          <div style={{
            width: 68, height: 68, borderRadius: 22,
            background: `${accentColor}14`,
            boxShadow: `0 0 0 8px ${accentColor}0a, 0 0 0 16px ${accentColor}05`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
          }}>
            <ShieldCheck className="size-8" style={{ color: accentColor }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.3, color: '#0f172a', margin: '0 0 10px' }}>
            Password updated
          </h1>
          <p className="text-gray-400 text-[14px] mb-8 leading-relaxed">
            Your password has been reset. You can now sign in with your new password.
          </p>
          <button
            onClick={resetForgotState}
            className="group w-full h-12 rounded-xl font-semibold text-[15px] text-white transition-all active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
              boxShadow: `0 8px 24px ${accentColor}30`,
            }}
          >
            <span className="flex items-center justify-center gap-2">
              Back to Sign In
              <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </button>
        </div>
      )}

      {/* Footer */}
      <p style={{ marginTop: 28, textAlign: 'center', fontSize: 11, color: '#cbd5e1', letterSpacing: 0.3 }}>
        {platformName} &middot; Empowering education
      </p>
    </div>
  );
}
