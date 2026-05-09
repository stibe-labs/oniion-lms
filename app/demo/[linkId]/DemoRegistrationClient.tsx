'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, ArrowRight, CheckCircle, AlertCircle, Info, UserCheck, Clock, Calendar, BookOpen } from 'lucide-react';
import { usePlatformName } from '@/components/providers/PlatformProvider';

// ─── Types ──────────────────────────────────────────────────

interface LinkData {
  status: string;
  grades?: string[];
  boards?: string[];
  regions?: { value: string; label: string }[];
  available_teacher_count?: number;
  student_name?: string;
  subject?: string;
  message?: string;
  // Pre-fill from CRM integration
  prefill_name?: string;
  prefill_phone?: string;
  prefill_email?: string;
  prefill_grade?: string;
  // Pre-scheduled demo (CRM agent scheduled)
  teacher_name?: string;
  scheduled_start?: string;
  duration_minutes?: number;
}

type Step = 'loading' | 'error' | 'form' | 'submitting' | 'success' | 'already_used' | 'scheduled';

// ─── Component ──────────────────────────────────────────────

export default function DemoRegistrationClient({ linkId }: { linkId: string }) {
  const platformName = usePlatformName();
  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState('');
  const [linkData, setLinkData] = useState<LinkData | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [grade, setGrade] = useState('');
  const [board, setBoard] = useState('');
  const [region, setRegion] = useState('');

  // Email check state
  const [emailCheck, setEmailCheck] = useState<{
    checking: boolean;
    isExistingStudent: boolean;
    existingRole: string | null;
    hasPendingDemo: boolean;
    pendingDemoStatus: string | null;
  }>({ checking: false, isExistingStudent: false, existingRole: null, hasPendingDemo: false, pendingDemoStatus: null });
  const emailCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckedEmail = useRef('');

  // Focus states for floating labels
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);

  // ── Check email against DB ──
  const checkEmail = useCallback(async (emailVal: string) => {
    const trimmed = emailVal.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailCheck({ checking: false, isExistingStudent: false, existingRole: null, hasPendingDemo: false, pendingDemoStatus: null });
      lastCheckedEmail.current = '';
      return;
    }
    if (trimmed === lastCheckedEmail.current) return;
    lastCheckedEmail.current = trimmed;
    setEmailCheck(prev => ({ ...prev, checking: true }));
    try {
      const res = await fetch(`/api/v1/demo/check-email?email=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.success) {
        setEmailCheck({
          checking: false,
          isExistingStudent: data.data.is_existing_student,
          existingRole: data.data.existing_role,
          hasPendingDemo: data.data.has_pending_demo,
          pendingDemoStatus: data.data.pending_demo_status,
        });
      } else {
        setEmailCheck({ checking: false, isExistingStudent: false, existingRole: null, hasPendingDemo: false, pendingDemoStatus: null });
      }
    } catch {
      setEmailCheck({ checking: false, isExistingStudent: false, existingRole: null, hasPendingDemo: false, pendingDemoStatus: null });
    }
  }, []);

  // Debounced email check on change
  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    emailCheckTimer.current = setTimeout(() => checkEmail(val), 600);
  };

  // ── Fetch link data ──
  const fetchLink = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/demo/${linkId}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'This link is not valid.');
        setStep('error');
        return;
      }

      setLinkData(data.data);

      if (data.data.status === 'link_created') {
        // Pre-fill form if data comes from CRM
        if (data.data.prefill_name) setName(data.data.prefill_name);
        if (data.data.prefill_email) setEmail(data.data.prefill_email);
        if (data.data.prefill_phone) setPhone(data.data.prefill_phone);
        if (data.data.prefill_grade) setGrade(data.data.prefill_grade);
        setStep('form');
      } else if (data.data.status === 'accepted' && data.data.scheduled_start) {
        // CRM-scheduled demo — show confirmation with schedule details
        setStep('scheduled');
      } else {
        setStep('already_used');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
      setStep('error');
    }
  }, [linkId]);

  useEffect(() => {
    fetchLink();
  }, [fetchLink]);

  // ── Submit form ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !phone.trim() || !grade || !board || !region) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid phone number (at least 10 digits).');
      return;
    }

    setError('');
    setStep('submitting');

    try {
      const res = await fetch(`/api/v1/demo/${linkId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_email: email.trim().toLowerCase(),
          student_name: name.trim(),
          student_phone: phone.trim(),
          student_grade: grade,
          student_board: board || undefined,
          student_region: region || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setStep('success');
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
        setStep('form');
      }
    } catch {
      setError('Network error. Please try again.');
      setStep('form');
    }
  };

  // ── Floating label active states ──
  const nameActive = nameFocused || name.length > 0;
  const emailActive = emailFocused || email.length > 0;
  const phoneActive = phoneFocused || phone.length > 0;

  // ── Error Banner (matches auth screen) ──
  const errorBanner = error ? (
    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 sm:bg-red-500/15 sm:border-red-400/30 sm:text-red-300 flex items-start gap-2.5">
      <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-red-100 sm:bg-red-400/25 flex items-center justify-center">
        <span className="text-red-500 sm:text-red-300 text-[10px] font-bold">!</span>
      </span>
      <span>{error}</span>
    </div>
  ) : null;

  const isSubmitDisabled = !name || !email || !phone || !grade || !board || !region;

  return (
    <div className="flex flex-col h-full justify-center max-w-sm mx-auto">
      {/* Logo — mobile only (desktop logo is in the page top-left) */}
      <div className="mb-6 sm:hidden">
        <img src="/logo/full.png" alt="Logo" className="h-10 object-contain drop-shadow-lg" />
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* ── LOADING ─────────────────────────────── */}
      {/* ═══════════════════════════════════════════ */}
      {step === 'loading' && (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="size-8 animate-spin text-emerald-600 sm:text-emerald-300" />
          <p className="mt-4 text-gray-500 sm:text-emerald-200/70 text-[15px]">Loading demo session…</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ── ERROR ───────────────────────────────── */}
      {/* ═══════════════════════════════════════════ */}
      {step === 'error' && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-red-50 sm:bg-red-400/15 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="size-8 text-red-500 sm:text-red-300" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-white mb-2">Link Not Available</h1>
          <p className="text-gray-500 sm:text-emerald-200/60 text-[14px]">{error}</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ── ALREADY USED ──────────────────────── */}
      {/* ═══════════════════════════════════════════ */}
      {step === 'already_used' && linkData && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 sm:bg-teal-400/15 flex items-center justify-center mx-auto mb-6">
            <Info className="size-8 text-teal-600 sm:text-teal-300" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-white mb-2">
            {linkData.status === 'submitted' ? 'Registration Received' :
             linkData.status === 'pending_teacher' ? 'Finding Your Teacher' :
             linkData.status === 'accepted' ? 'Demo Scheduled!' :
             linkData.status === 'completed' ? 'Demo Session Ended' :
             linkData.status === 'live' ? 'Session In Progress' :
             linkData.status === 'cancelled' ? 'Session Cancelled' :
             linkData.status === 'rejected' ? 'No Availability' :
             'Status Update'}
          </h1>
          <p className="text-gray-500 sm:text-emerald-200/70 text-[14px]">{linkData.message}</p>
          {linkData.student_name && (
            <p className="mt-4 text-[13px] text-gray-400 sm:text-emerald-200/40">
              Registered as: {linkData.student_name}
            </p>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ── SCHEDULED (CRM-direct) ── */}
      {/* ═══════════════════════════════════════════ */}
      {step === 'scheduled' && linkData && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 sm:bg-emerald-400/15 flex items-center justify-center mx-auto mb-6">
            <Calendar className="size-8 text-emerald-600 sm:text-emerald-300" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-white mb-2">Demo Session Scheduled!</h1>
          <p className="text-gray-500 sm:text-emerald-200/70 text-[14px] mb-6">
            Your free demo class is all set. Check your email or WhatsApp for the join link.
          </p>

          <div className="rounded-xl bg-gray-50 border border-gray-200 sm:bg-white/5 sm:border-white/10 p-5 text-left space-y-3">
            {linkData.subject && (
              <div className="flex items-center gap-3">
                <BookOpen className="size-4 text-emerald-600 sm:text-emerald-300 shrink-0" />
                <div>
                  <p className="text-[11px] text-gray-400 sm:text-emerald-200/40 uppercase tracking-wider">Subject</p>
                  <p className="text-sm font-medium text-gray-900 sm:text-white">{linkData.subject}</p>
                </div>
              </div>
            )}
            {linkData.teacher_name && (
              <div className="flex items-center gap-3">
                <UserCheck className="size-4 text-emerald-600 sm:text-emerald-300 shrink-0" />
                <div>
                  <p className="text-[11px] text-gray-400 sm:text-emerald-200/40 uppercase tracking-wider">Teacher</p>
                  <p className="text-sm font-medium text-gray-900 sm:text-white">{linkData.teacher_name}</p>
                </div>
              </div>
            )}
            {linkData.scheduled_start && (
              <div className="flex items-center gap-3">
                <Clock className="size-4 text-emerald-600 sm:text-emerald-300 shrink-0" />
                <div>
                  <p className="text-[11px] text-gray-400 sm:text-emerald-200/40 uppercase tracking-wider">Scheduled Time</p>
                  <p className="text-sm font-medium text-gray-900 sm:text-white">
                    {new Date(linkData.scheduled_start).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}
                  </p>
                </div>
              </div>
            )}
            {linkData.duration_minutes && (
              <div className="flex items-center gap-3">
                <Calendar className="size-4 text-emerald-600 sm:text-emerald-300 shrink-0" />
                <div>
                  <p className="text-[11px] text-gray-400 sm:text-emerald-200/40 uppercase tracking-wider">Duration</p>
                  <p className="text-sm font-medium text-gray-900 sm:text-white">{linkData.duration_minutes} minutes</p>
                </div>
              </div>
            )}
          </div>

          <p className="mt-6 text-[13px] text-gray-400 sm:text-emerald-200/40">
            A join link was sent to your WhatsApp and email. Click it when the session starts.
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ── SUCCESS ─────────────────────────────── */}
      {/* ═══════════════════════════════════════════ */}
      {step === 'success' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 sm:bg-emerald-400/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="size-8 text-emerald-600 sm:text-emerald-300" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-white mb-2">Registration Complete!</h1>
          <p className="text-gray-500 sm:text-emerald-200/70 text-[14px] mb-8">
            We are searching for the best available teacher for your demo session.
          </p>

          <div className="rounded-xl bg-gray-50 border border-gray-200 sm:bg-white/5 sm:border-white/10 p-5 text-left">
            <p className="font-medium text-gray-900 sm:text-white text-sm mb-3">What happens next?</p>
            <ol className="list-decimal list-inside space-y-2 text-[13px] text-gray-500 sm:text-emerald-200/60">
              <li>An available teacher will review your request</li>
              <li>Once confirmed, you&apos;ll get an email with a <strong className="text-gray-900 sm:text-white font-medium">join link</strong></li>
              <li>Click the link at the scheduled time to join your <strong className="text-gray-900 sm:text-white font-medium">free 30-minute</strong> demo session</li>
            </ol>
          </div>

          <p className="mt-6 text-[13px] text-gray-400 sm:text-emerald-200/40">
            Check your email (including spam/promotions) for updates from {platformName}.
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ── SUBMITTING ──────────────────────────── */}
      {/* ═══════════════════════════════════════════ */}
      {step === 'submitting' && (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="size-8 animate-spin text-emerald-600 sm:text-emerald-300" />
          <p className="mt-4 text-gray-900 sm:text-white font-medium text-[15px]">Submitting your registration…</p>
          <p className="mt-1 text-[13px] text-gray-400 sm:text-emerald-200/40">Finding the best teacher for you</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ── REGISTRATION FORM ───────────────────── */}
      {/* ═══════════════════════════════════════════ */}
      {step === 'form' && linkData && (
        <>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-white mb-2">Free Demo Session</h1>
            <p className="text-gray-500 sm:text-emerald-200/70 text-[15px]">
              Experience a <strong className="text-gray-900 sm:text-white font-medium">30-minute</strong> live session with one of our expert teachers.
            </p>
            {linkData.available_teacher_count !== undefined && linkData.available_teacher_count > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 sm:bg-emerald-400/10 sm:border-emerald-400/25 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-700 sm:text-emerald-300 font-medium">
                  {linkData.available_teacher_count} teacher{linkData.available_teacher_count > 1 ? 's' : ''} available now
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {errorBanner}

            {/* Full Name — floating label */}
            <div className="relative">
              <input
                id="demo-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                required
                className={`peer w-full h-14 px-4 pt-4 rounded-xl border bg-gray-50 text-gray-900 text-[15px] outline-none transition-all duration-200 sm:bg-white/10 sm:text-white ${
                  nameFocused
                    ? 'border-emerald-500 ring-2 ring-emerald-500/10 sm:border-emerald-400/60 sm:ring-emerald-400/15'
                    : 'border-gray-200 hover:border-gray-300 sm:border-white/15 sm:hover:border-white/25'
                }`}
              />
              <label
                htmlFor="demo-name"
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  nameActive
                    ? 'top-1.5 text-[11px] font-medium text-emerald-600 sm:text-emerald-300'
                    : 'top-1/2 -translate-y-1/2 text-[15px] text-gray-400 sm:text-emerald-200/50'
                }`}
              >
                Full Name
              </label>
            </div>

            {/* Email — floating label */}
            <div className="relative">
              <input
                id="demo-email"
                type="email"
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => { setEmailFocused(false); checkEmail(email); }}
                required
                className={`peer w-full h-14 px-4 pt-4 rounded-xl border bg-gray-50 text-gray-900 text-[15px] outline-none transition-all duration-200 sm:bg-white/10 sm:text-white ${
                  emailFocused
                    ? 'border-emerald-500 ring-2 ring-emerald-500/10 sm:border-emerald-400/60 sm:ring-emerald-400/15'
                    : (emailCheck.isExistingStudent || emailCheck.hasPendingDemo)
                      ? 'border-amber-400 ring-2 ring-amber-400/10 sm:border-amber-400/60 sm:ring-amber-400/15'
                      : 'border-gray-200 hover:border-gray-300 sm:border-white/15 sm:hover:border-white/25'
                }`}
              />
              <label
                htmlFor="demo-email"
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  emailActive
                    ? 'top-1.5 text-[11px] font-medium text-emerald-600 sm:text-emerald-300'
                    : 'top-1/2 -translate-y-1/2 text-[15px] text-gray-400 sm:text-emerald-200/50'
                }`}
              >
                Email address
              </label>
              {/* Email check spinner */}
              {emailCheck.checking && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400 sm:text-emerald-300/60" />
                </div>
              )}
              {/* Email check results */}
              {!emailCheck.checking && emailCheck.isExistingStudent && (
                <div className="mt-1.5 flex items-start gap-1.5 px-1">
                  <UserCheck className="h-3.5 w-3.5 text-amber-500 sm:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-amber-600 sm:text-amber-300">
                    This email is already registered as a <strong>{emailCheck.existingRole}</strong> in {platformName}. You can still register for a demo.
                  </p>
                </div>
              )}
              {!emailCheck.checking && emailCheck.hasPendingDemo && (
                <div className="mt-1.5 flex items-start gap-1.5 px-1">
                  <Clock className="h-3.5 w-3.5 text-amber-500 sm:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-amber-600 sm:text-amber-300">
                    This email already has an active demo request ({emailCheck.pendingDemoStatus?.replace(/_/g, ' ')}). Submitting again will create a new session.
                  </p>
                </div>
              )}
            </div>

            {/* Phone — floating label */}
            <div className="relative">
              <input
                id="demo-phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                required
                className={`peer w-full h-14 px-4 pt-4 rounded-xl border bg-gray-50 text-gray-900 text-[15px] outline-none transition-all duration-200 sm:bg-white/10 sm:text-white ${
                  phoneFocused
                    ? 'border-emerald-500 ring-2 ring-emerald-500/10 sm:border-emerald-400/60 sm:ring-emerald-400/15'
                    : 'border-gray-200 hover:border-gray-300 sm:border-white/15 sm:hover:border-white/25'
                }`}
              />
              <label
                htmlFor="demo-phone"
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  phoneActive
                    ? 'top-1.5 text-[11px] font-medium text-emerald-600 sm:text-emerald-300'
                    : 'top-1/2 -translate-y-1/2 text-[15px] text-gray-400 sm:text-emerald-200/50'
                }`}
              >
                Phone number
              </label>
            </div>

            {/* Region — floating label select */}
            {(linkData?.regions?.length ?? 0) > 0 && (
              <div className="relative">
                <select
                  id="demo-region"
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  required
                  className={`peer w-full h-14 px-4 pt-4 rounded-xl border bg-gray-50 text-gray-900 text-[15px] outline-none transition-all duration-200 appearance-none sm:bg-white/10 sm:text-white ${
                    region
                      ? 'border-emerald-500/40 sm:border-emerald-400/30'
                      : 'border-gray-200 hover:border-gray-300 sm:border-white/15 sm:hover:border-white/25'
                  }`}
                >
                  <option value="" disabled hidden></option>
                  {(linkData?.regions || []).map(r => (
                    <option key={r.value} value={r.value} className="text-gray-900 bg-white">{r.label}</option>
                  ))}
                </select>
                <label
                  htmlFor="demo-region"
                  className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                    region
                      ? 'top-1.5 text-[11px] font-medium text-emerald-600 sm:text-emerald-300'
                      : 'top-1/2 -translate-y-1/2 text-[15px] text-gray-400 sm:text-emerald-200/50'
                  }`}
                >
                  Region / Location
                </label>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="size-4 text-gray-400 sm:text-emerald-200/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}

            {/* Grade / Class — floating label select */}
            <div className="relative">
              <select
                id="demo-grade"
                value={grade}
                onChange={e => setGrade(e.target.value)}
                required
                className={`peer w-full h-14 px-4 pt-4 rounded-xl border bg-gray-50 text-gray-900 text-[15px] outline-none transition-all duration-200 appearance-none sm:bg-white/10 sm:text-white ${
                  grade
                    ? 'border-emerald-500/40 sm:border-emerald-400/30'
                    : 'border-gray-200 hover:border-gray-300 sm:border-white/15 sm:hover:border-white/25'
                }`}
              >
                <option value="" disabled hidden></option>
                {(linkData?.grades || []).map(g => (
                  <option key={g} value={g} className="text-gray-900 bg-white">Grade {g}</option>
                ))}
              </select>
              <label
                htmlFor="demo-grade"
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  grade
                    ? 'top-1.5 text-[11px] font-medium text-emerald-600 sm:text-emerald-300'
                    : 'top-1/2 -translate-y-1/2 text-[15px] text-gray-400 sm:text-emerald-200/50'
                }`}
              >
                Grade / Class
              </label>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="size-4 text-gray-400 sm:text-emerald-200/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Board — floating label select */}
            {(linkData?.boards?.length ?? 0) > 0 && (
              <div className="relative">
                <select
                  id="demo-board"
                  value={board}
                  onChange={e => setBoard(e.target.value)}
                  required
                  className={`peer w-full h-14 px-4 pt-4 rounded-xl border bg-gray-50 text-gray-900 text-[15px] outline-none transition-all duration-200 appearance-none sm:bg-white/10 sm:text-white ${
                    board
                      ? 'border-emerald-500/40 sm:border-emerald-400/30'
                      : 'border-gray-200 hover:border-gray-300 sm:border-white/15 sm:hover:border-white/25'
                  }`}
                >
                  <option value="" disabled hidden></option>
                  {(linkData?.boards || []).map(b => (
                    <option key={b} value={b} className="text-gray-900 bg-white">{b}</option>
                  ))}
                </select>
                <label
                  htmlFor="demo-board"
                  className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                    board
                      ? 'top-1.5 text-[11px] font-medium text-emerald-600 sm:text-emerald-300'
                      : 'top-1/2 -translate-y-1/2 text-[15px] text-gray-400 sm:text-emerald-200/50'
                  }`}
                >
                  Board
                </label>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="size-4 text-gray-400 sm:text-emerald-200/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}

            {/* Submit Button (matches auth exactly) */}
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="group relative w-full h-13 rounded-xl text-emerald-950 font-medium text-[15px] bg-linear-to-r from-emerald-300 to-teal-300 hover:from-emerald-200 hover:to-teal-200 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 overflow-hidden shadow-lg shadow-emerald-400/15"
            >
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-linear-to-r from-transparent via-white/10 to-transparent" />
              <span className="relative flex items-center justify-center gap-2">
                Request Free Demo Session
                <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform duration-200" />
              </span>
            </button>

            <p className="text-center text-[12px] text-gray-400 sm:text-emerald-200/40">
              No payment required · 30-minute session
            </p>
          </form>
        </>
      )}

      {/* Footer */}
      <p className="mt-10 text-center text-xs text-gray-400 sm:text-emerald-200/40">
        {platformName} &middot; Empowering education
      </p>
    </div>
  );
}
