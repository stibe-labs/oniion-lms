'use client';

import React, { useEffect, useState } from 'react';
import {
  Loader2, CheckCircle, XCircle, Clock, BookOpen, User, GraduationCap, Calendar
} from 'lucide-react';
import { usePlatformName } from '@/components/providers/PlatformProvider';

// ── Types ─────────────────────────────────────────────────

type PageStep = 'loading' | 'pending' | 'submitting' | 'success' | 'accepted_by_other' | 'self_accepted' | 'expired' | 'error';

interface InviteData {
  status: 'pending' | 'accepted' | 'expired';
  student_name: string;
  student_grade: string | null;
  subject: string | null;
  teacher_name: string;
  accepted_by_name?: string;       // set when status = expired (taken by someone else)
  scheduled_start?: string;        // set when self-accepted
  duration_minutes?: number;
}

// ── Utility ───────────────────────────────────────────────

function nextSlot(): string {
  const now = new Date();
  // Round up to next 30-min boundary, +30 min from now
  now.setMinutes(now.getMinutes() + 60 - (now.getMinutes() % 30), 0, 0);
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

// ── Component ─────────────────────────────────────────────

export default function DemoInviteClient({ token }: { token: string }) {
  const platformName = usePlatformName();
  const [step, setStep] = useState<PageStep>('loading');
  const [data, setData] = useState<InviteData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form state
  const [scheduledStart, setScheduledStart] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('30');

  // Load invite info
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/demo-invite/${encodeURIComponent(token)}`);
        const json = await res.json() as { success: boolean; data?: InviteData; error?: string };
        if (!json.success || !json.data) {
          setErrorMsg(json.error || 'Invalid or expired invitation link.');
          setStep('error');
          return;
        }
        const inv = json.data;
        setData(inv);
        if (inv.status === 'pending') {
          setScheduledStart(nextSlot());
          setStep('pending');
        } else if (inv.status === 'accepted') {
          // If this teacher's own invitation was accepted by themselves
          if (inv.scheduled_start) {
            setStep('self_accepted');
          } else {
            setStep('accepted_by_other');
          }
        } else {
          // expired — taken by another teacher or timeout
          setStep(inv.accepted_by_name ? 'accepted_by_other' : 'expired');
        }
      } catch {
        setErrorMsg('Failed to load invitation. Please try again.');
        setStep('error');
      }
    }
    load();
  }, [token]);

  // Accept the demo invitation
  const handleAccept = async () => {
    if (!scheduledStart) return;
    setStep('submitting');
    try {
      const res = await fetch(`/api/v1/demo-invite/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_start: new Date(scheduledStart).toISOString(), duration_minutes: Number(durationMinutes) }),
      });
      const json = await res.json() as { success: boolean; data?: { already_accepted_by?: string }; error?: string };
      if (!json.success) {
        if (json.data?.already_accepted_by) {
          setData(prev => prev ? { ...prev, accepted_by_name: json.data!.already_accepted_by } : prev);
          setStep('accepted_by_other');
        } else {
          setErrorMsg(json.error || 'Failed to accept invitation.');
          setStep('error');
        }
        return;
      }
      setStep('success');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStep('error');
    }
  };

  // ── Render ──────────────────────────────────────────────

  if (step === 'loading') return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      <p className="text-sm text-white/60">Loading invitation…</p>
    </div>
  );

  if (step === 'error') return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <XCircle className="w-12 h-12 text-red-400" />
      <h2 className="text-xl font-bold text-white">Invalid Invitation</h2>
      <p className="text-sm text-white/60">{errorMsg}</p>
    </div>
  );

  if (step === 'expired') return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <Clock className="w-12 h-12 text-amber-400" />
      <h2 className="text-xl font-bold text-white">Invitation Expired</h2>
      <p className="text-sm text-white/60">
        This invitation link has expired. The demo may have already been scheduled or the 24-hour window has passed.
      </p>
    </div>
  );

  if (step === 'accepted_by_other') return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <CheckCircle className="w-12 h-12 text-emerald-400" />
      <h2 className="text-xl font-bold text-white">Already Accepted</h2>
      <p className="text-sm text-white/60">
        {data?.accepted_by_name
          ? `This demo was already accepted by ${data.accepted_by_name}. You'll get the next opportunity!`
          : 'Another teacher has already accepted this demo session. You\'ll get the next opportunity!'}
      </p>
      <div className="mt-2 rounded-lg bg-white/5 border border-white/10 px-5 py-3 text-sm text-white/70">
        Thank you for your willingness to teach! 🎓
      </div>
    </div>
  );

  if (step === 'self_accepted') return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <CheckCircle className="w-12 h-12 text-emerald-400" />
      <h2 className="text-xl font-bold text-white">Demo Scheduled!</h2>
      <p className="text-sm text-white/60">
        You have already accepted this demo session. You'll receive your join link 15 minutes before the session starts.
      </p>
      {data?.scheduled_start && (
        <div className="mt-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-5 py-3 text-sm text-emerald-300">
          🕐 {new Date(data.scheduled_start).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}
        </div>
      )}
    </div>
  );

  if (step === 'success') return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
        <CheckCircle className="w-9 h-9 text-emerald-400" />
      </div>
      <h2 className="text-2xl font-bold text-white">Session Confirmed!</h2>
      <p className="text-sm text-white/70 max-w-sm">
        You've accepted the demo session. The student has been notified.<br />
        You'll receive a WhatsApp with your join link <strong>15 minutes before</strong> the session.
      </p>
      <div className="mt-2 rounded-xl bg-white/5 border border-white/10 px-5 py-4 text-left text-sm text-white/70 space-y-1.5 w-full max-w-sm">
        <div className="flex gap-2"><span className="text-white/40 w-20 shrink-0">Student</span><span className="text-white font-medium">{data?.student_name}</span></div>
        {data?.subject && <div className="flex gap-2"><span className="text-white/40 w-20 shrink-0">Subject</span><span className="text-white font-medium">{data.subject}</span></div>}
        {data?.student_grade && <div className="flex gap-2"><span className="text-white/40 w-20 shrink-0">Grade</span><span className="text-white font-medium">Grade {data.student_grade}</span></div>}
      </div>
    </div>
  );

  // ── Pending — main form ──────────────────────────────────
  const isSubmitting = step === 'submitting';
  const canSubmit = !!scheduledStart && !isSubmitting;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 mb-1">
          <img src="/logo/icon.png" alt="Logo" className="h-7 w-7 object-contain sm:hidden" />
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">{platformName} Classes</span>
        </div>
        <h1 className="text-2xl font-bold text-white leading-tight">Demo Session Invitation</h1>
        <p className="text-sm text-white/60">A student is looking for a free demo class. Be the first to accept!</p>
      </div>

      {/* Student info card */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Student Details</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-white/40 shrink-0" />
            <span className="text-sm text-white font-medium">{data?.student_name}</span>
          </div>
          {data?.student_grade && (
            <div className="flex items-center gap-3">
              <GraduationCap className="w-4 h-4 text-white/40 shrink-0" />
              <span className="text-sm text-white/70">Grade {data.student_grade}</span>
            </div>
          )}
          {data?.subject && (
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-white/40 shrink-0" />
              <span className="text-sm text-white/70">{data.subject}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hello teacher */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">
        Hi <strong>{data?.teacher_name}</strong>! Pick a time that works for you and accept this demo request.
      </div>

      {/* Time picker */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/80 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-white/40" />
            Date &amp; Time
          </label>
          <input
            type="datetime-local"
            value={scheduledStart}
            onChange={e => setScheduledStart(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/80 flex items-center gap-2">
            <Clock className="w-4 h-4 text-white/40" />
            Duration
          </label>
          <select
            value={durationMinutes}
            onChange={e => setDurationMinutes(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 appearance-none"
          >
            <option value="15" className="bg-gray-900">15 minutes</option>
            <option value="30" className="bg-gray-900">30 minutes</option>
            <option value="45" className="bg-gray-900">45 minutes</option>
            <option value="60" className="bg-gray-900">60 minutes</option>
          </select>
        </div>
      </div>

      {/* Accept button */}
      <button
        onClick={handleAccept}
        disabled={!canSubmit}
        className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-all flex items-center justify-center gap-2
          ${canSubmit
            ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'
            : 'bg-white/10 text-white/30 cursor-not-allowed'
          }`}
      >
        {isSubmitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Accepting…</>
        ) : (
          <>Accept & Schedule Demo</>
        )}
      </button>

      <p className="text-xs text-white/30 text-center">
        First teacher to accept gets assigned. Others will be notified.
      </p>
    </div>
  );
}
