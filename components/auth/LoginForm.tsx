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
  const { accentColor, template } = useAuthConfig();

  const isDark = template === 'dark';

  // ── Theme tokens ───────────────────────────────────────────────────────────
  const T = {
    heading:     isDark ? '#ffffff'                   : '#0f172a',
    subtitle:    isDark ? 'rgba(255,255,255,0.38)'    : '#94a3b8',
    badgeDot:    isDark ? 'rgba(255,255,255,0.55)'    : accentColor,
    badgeText:   isDark ? 'rgba(255,255,255,0.4)'     : `${accentColor}99`,
    inputBg:     isDark ? 'rgba(255,255,255,0.07)'    : '#fafafa',
    inputBorder: isDark ? 'rgba(255,255,255,0.13)'    : '#e5e7eb',
    inputText:   isDark ? '#ffffff'                   : '#111827',
    labelOff:    isDark ? 'rgba(255,255,255,0.3)'     : '#9ca3af',
    labelOn:     accentColor,
    focusShadow: isDark ? `${accentColor}28`          : `${accentColor}1a`,
    eyeBtn:      isDark ? 'rgba(255,255,255,0.3)'     : '#9ca3af',
    backBtn:     isDark ? 'rgba(255,255,255,0.28)'    : '#9ca3af',
    errBg:       isDark ? 'rgba(239,68,68,0.1)'       : '#fef2f2',
    errBorder:   isDark ? 'rgba(239,68,68,0.22)'      : '#fee2e2',
    errText:     isDark ? '#fca5a5'                   : '#dc2626',
    errDotBg:    isDark ? 'rgba(239,68,68,0.2)'       : '#fee2e2',
    stepIconBg:  isDark ? `${accentColor}22`          : `${accentColor}18`,
    resend:      isDark ? 'rgba(255,255,255,0.35)'    : '#9ca3af',
    footer:      isDark ? 'rgba(255,255,255,0.16)'    : '#cbd5e1',
    successBg:   isDark ? `${accentColor}18`          : `${accentColor}14`,
    successHead: isDark ? '#ffffff'                   : '#0f172a',
    successSub:  isDark ? 'rgba(255,255,255,0.42)'    : '#94a3b8',
  };

  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [showPassword,  setShowPassword]  = useState(false);
  const [emailFocused,  setEmailFocused]  = useState(false);
  const [passFocused,   setPassFocused]   = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [forgotStep,         setForgotStep]         = useState<ForgotStep>('login');
  const [forgotEmail,        setForgotEmail]        = useState('');
  const [otp,                setOtp]                = useState('');
  const [resetToken,         setResetToken]         = useState('');
  const [newPassword,        setNewPassword]        = useState('');
  const [confirmPassword,    setConfirmPassword]    = useState('');
  const [showNewPassword,    setShowNewPassword]    = useState(false);
  const [forgotEmailFocused, setForgotEmailFocused] = useState(false);
  const [otpFocused,         setOtpFocused]         = useState(false);
  const [newPassFocused,     setNewPassFocused]     = useState(false);
  const [confirmPassFocused, setConfirmPassFocused] = useState(false);

  // ── Auth handlers ──────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    } catch { setError('Network error — could not reach server'); }
    finally { setLoading(false); }
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

  // ── UI helpers (all theme-aware) ───────────────────────────────────────────

  const errorBanner = error ? (
    <div style={{
      borderRadius: 12, background: T.errBg,
      border: `1px solid ${T.errBorder}`,
      padding: '10px 14px', fontSize: 13, color: T.errText,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <span style={{
        flexShrink: 0, marginTop: 1, width: 18, height: 18, borderRadius: '50%',
        background: T.errDotBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: T.errText, fontSize: 9, fontWeight: 900, lineHeight: 1 }}>!</span>
      </span>
      <span style={{ lineHeight: 1.5 }}>{error}</span>
    </div>
  ) : null;

  function inputStyle(focused: boolean, padRight = false): React.CSSProperties {
    return {
      width: '100%', height: 56,
      paddingLeft: 16, paddingRight: padRight ? 48 : 16,
      paddingTop: 18, paddingBottom: 0,
      borderRadius: 14, outline: 'none',
      background: T.inputBg,
      border: `1px solid ${focused ? accentColor : T.inputBorder}`,
      color: T.inputText, fontSize: 15,
      boxShadow: focused ? `0 0 0 3px ${T.focusShadow}` : 'none',
      transition: 'border-color 0.18s, box-shadow 0.18s',
    };
  }

  function labelStyle(active: boolean): React.CSSProperties {
    return active
      ? { position: 'absolute', left: 16, top: 7, fontSize: 11, fontWeight: 600, color: T.labelOn, pointerEvents: 'none', transition: 'all 0.18s' }
      : { position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: T.labelOff, pointerEvents: 'none', transition: 'all 0.18s' };
  }

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
      <div style={{ position: 'relative' }}>
        <input
          id={id} ref={inputRef}
          type={type} value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={onFocus} onBlur={onBlur}
          disabled={loading} autoComplete={autoComplete}
          maxLength={maxLength} inputMode={inputMode} required
          style={inputStyle(focused)}
        />
        <label htmlFor={id} style={labelStyle(active)}>{label}</label>
        {extra}
      </div>
    );
  }

  function SubmitBtn({ label, loadingLabel, disabled }: { label: string; loadingLabel: string; disabled: boolean }) {
    return (
      <button
        type="submit" disabled={loading || disabled}
        style={{
          width: '100%', height: 50, borderRadius: 14,
          fontWeight: 700, fontSize: 15, color: '#ffffff',
          background: isDark
            ? `linear-gradient(135deg, ${accentColor}ee, #6366f1cc)`
            : `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
          boxShadow: `0 8px 32px ${accentColor}40`,
          border: 'none', cursor: 'pointer',
          opacity: (loading || disabled) ? 0.45 : 1,
          pointerEvents: (loading || disabled) ? 'none' : 'auto',
          transition: 'opacity 0.2s, transform 0.1s',
        }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.98)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
            {loadingLabel}
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {label}
            <ArrowRight style={{ width: 16, height: 16 }} />
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
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          color: T.backBtn, fontSize: 13, marginBottom: 24,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.7)' : '#4b5563')}
        onMouseLeave={e => (e.currentTarget.style.color = T.backBtn)}
      >
        <ArrowLeft style={{ width: 13, height: 13 }} />
        Back
      </button>
    );
  }

  function StepIcon({ icon: Icon }: { icon: React.ElementType }) {
    return (
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: T.stepIconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon style={{ width: 18, height: 18, color: accentColor }} />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ══ LOGIN ══════════════════════════════════════════════════════════════ */}
      {forgotStep === 'login' && (
        <>
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: T.badgeDot, boxShadow: `0 0 0 3px ${accentColor}28`,
              }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: T.badgeText }}>
                Secure Sign In
              </span>
            </div>
            <h1 style={{ fontSize: 27, fontWeight: 800, letterSpacing: -0.4, color: T.heading, margin: '0 0 8px', lineHeight: 1.2 }}>
              Welcome back
            </h1>
            <p style={{ color: T.subtitle, fontSize: 14, margin: 0, lineHeight: 1.6 }}>
              Sign in to continue your learning journey
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {errorBanner}

            {/* Email */}
            <div style={{ position: 'relative' }}>
              <input
                id="email" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                disabled={loading} autoComplete="email" required
                style={inputStyle(emailFocused)}
              />
              <label htmlFor="email" style={labelStyle(emailFocused || email.length > 0)}>
                Email address
              </label>
            </div>

            {/* Password */}
            <div style={{ position: 'relative' }}>
              <input
                ref={passwordRef}
                id="password" type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
                disabled={loading} autoComplete="current-password" required
                style={inputStyle(passFocused, true)}
              />
              <label htmlFor="password" style={labelStyle(passFocused || password.length > 0)}>
                Password
              </label>
              <button
                type="button" tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  color: T.eyeBtn, background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                }}
              >
                {showPassword ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
              </button>
            </div>

            {/* Forgot */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -4 }}>
              <button
                type="button"
                onClick={() => { setError(''); setForgotEmail(email); setForgotStep('forgot-email'); }}
                style={{ fontSize: 13, color: accentColor, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.85 }}
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
          <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
            <StepIcon icon={Mail} />
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: T.heading, margin: '0 0 4px', letterSpacing: -0.3 }}>Reset password</h1>
              <p style={{ color: T.subtitle, fontSize: 13, margin: 0 }}>We&apos;ll send a code to your email</p>
            </div>
          </div>
          <form onSubmit={handleForgotSubmitEmail} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
          <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
            <StepIcon icon={ShieldCheck} />
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: T.heading, margin: '0 0 4px', letterSpacing: -0.3 }}>Enter code</h1>
              <p style={{ color: T.subtitle, fontSize: 13, margin: 0 }}>
                Sent to <span style={{ color: accentColor }}>{forgotEmail}</span>
              </p>
            </div>
          </div>
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {errorBanner}
            <FloatingInput
              id="otp" label="6-digit code"
              value={otp} onChange={v => setOtp(v.replace(/\D/g, '').slice(0, 6))}
              focused={otpFocused}
              onFocus={() => setOtpFocused(true)}
              onBlur={() => setOtpFocused(false)}
              inputMode="numeric" maxLength={6}
            />
            <p style={{ fontSize: 13, color: T.resend, margin: 0 }}>
              Didn&apos;t receive it?{' '}
              <button
                type="button"
                onClick={handleForgotSubmitEmail as unknown as () => void}
                disabled={loading}
                style={{ color: accentColor, textDecoration: 'underline', textUnderlineOffset: 2, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}
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
          <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
            <StepIcon icon={KeyRound} />
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: T.heading, margin: '0 0 4px', letterSpacing: -0.3 }}>New password</h1>
              <p style={{ color: T.subtitle, fontSize: 13, margin: 0 }}>Choose a strong password</p>
            </div>
          </div>
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {errorBanner}
            <div style={{ position: 'relative' }}>
              <input
                id="new-password" type={showNewPassword ? 'text' : 'password'} value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                onFocus={() => setNewPassFocused(true)}
                onBlur={() => setNewPassFocused(false)}
                disabled={loading} autoComplete="new-password" required
                style={inputStyle(newPassFocused, true)}
              />
              <label htmlFor="new-password" style={labelStyle(newPassFocused || newPassword.length > 0)}>
                New password
              </label>
              <button
                type="button" tabIndex={-1}
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: T.eyeBtn, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                {showNewPassword ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
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
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{
            width: 68, height: 68, borderRadius: 22,
            background: T.successBg,
            boxShadow: `0 0 0 8px ${accentColor}0a, 0 0 0 16px ${accentColor}05`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
          }}>
            <ShieldCheck style={{ width: 30, height: 30, color: accentColor }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.3, color: T.successHead, margin: '0 0 10px' }}>
            Password updated
          </h1>
          <p style={{ color: T.successSub, fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
            Your password has been reset. You can now sign in with your new password.
          </p>
          <button
            onClick={resetForgotState}
            style={{
              width: '100%', height: 50, borderRadius: 14,
              fontWeight: 700, fontSize: 15, color: '#ffffff',
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
              boxShadow: `0 8px 32px ${accentColor}40`,
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            Back to Sign In
            <ArrowRight style={{ width: 16, height: 16 }} />
          </button>
        </div>
      )}

      {/* Footer */}
      <p style={{ marginTop: 28, textAlign: 'center', fontSize: 11, color: T.footer, letterSpacing: 0.3 }}>
        {platformName} &middot; Empowering education
      </p>
    </div>
  );
}
