'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePlatformName } from '@/components/providers/PlatformProvider';

/* ═══════════════════════════════════════════════════════════════
   Open Classroom — Public Join Page
   ═══════════════════════════════════════════════════════════════
   Flow:
   1. Fetch classroom info → show lobby
   2. User enters name (+ email/phone if paid)
   3. POST join → if requires_payment → redirect to /pay/...
   4. After payment returns (?paid=1) → auto-join
   5. On LiveKit token → store in sessionStorage → redirect to /classroom/[roomId]
   ═══════════════════════════════════════════════════════════════ */

interface ClassroomInfo {
  id: string;
  title: string;
  description: string | null;
  teacher_name: string | null;
  status: string;
  role: 'teacher' | 'student';
  classroom_type: string;
  scheduled_at: string | null;
  duration_minutes: number;
  payment_enabled: boolean;
  price_paise: number;
  currency: string;
  max_participants: number;
  can_join: boolean;
  opens_at: string | null;
  participant_count: number;
  share_name: string | null;
  share_phone: string | null;
  share_email: string | null;
  auth_name: string | null;
  auth_email: string | null;
  started_at: string | null;
  teacher_portal_role: string | null;
}

export default function OpenClassroomClient({ token }: { token: string }) {
  const platformName = usePlatformName();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [info, setInfo] = useState<ClassroomInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [joining, setJoining] = useState(false);
  const [waitingForLive, setWaitingForLive] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [approvalDenied, setApprovalDenied] = useState(false);

  const autoJoinFired = useRef(false);
  const sid = searchParams.get('sid') || '';
  const paid = searchParams.get('paid') === '1';
  const returnEmail = searchParams.get('email') || '';
  const returnName = searchParams.get('name') || '';
  const isSharedLink = !!sid; // came from WhatsApp share — skip form
  const isTeacherHost = info?.role === 'teacher' && !!info?.auth_name; // teacher host link — skip form

  // Fetch classroom info
  const fetchInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/open-classroom/${token}${sid ? `?sid=${sid}` : ''}`);
      const data = await res.json();
      if (data.success) {
        setInfo(data.data);
        // Pre-fill from auth (teacher host link) or share record
        if (data.data.auth_name) setName(data.data.auth_name);
        else if (data.data.share_name) setName(data.data.share_name);
        if (data.data.auth_email) setEmail(data.data.auth_email);
        else if (data.data.share_email) setEmail(data.data.share_email);
        if (data.data.share_phone) setPhone(data.data.share_phone);
        // Override from payment return params
        if (returnName) setName(decodeURIComponent(returnName));
        if (returnEmail) setEmail(decodeURIComponent(returnEmail));
      } else {
        setError(data.error || 'Classroom not found');
      }
    } catch {
      setError('Unable to load classroom');
    } finally {
      setLoading(false);
    }
  }, [token, sid, returnName, returnEmail]);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

  // Auto-join after payment return OR when coming from a shared WhatsApp link
  useEffect(() => {
    if (!info || autoJoinFired.current || !name) return;
    if ((paid || isSharedLink || isTeacherHost) && info.can_join) {
      autoJoinFired.current = true;
      handleJoin();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paid, isSharedLink, isTeacherHost, info, name]);

  const handleJoin = async () => {
    if (!info || joining) return;
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (info.payment_enabled && info.role === 'student' && !email.trim()) {
      setError('Email is required for paid classrooms');
      return;
    }

    setJoining(true);
    setError('');

    try {
      const res = await fetch(`/api/v1/open-classroom/${token}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined, sid }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Unable to join');
        setJoining(false);
        return;
      }

      // Teacher is waiting for class to go live — show waiting UI and poll
      if (data.data.waiting) {
        setWaitingForLive(true);
        setJoining(false);
        return;
      }

      // Waiting for teacher approval
      if (data.data.waiting_approval) {
        setWaitingApproval(true);
        setApprovalDenied(false);
        setJoining(false);
        return;
      }

      // Payment required — redirect to payment page
      if (data.data.requires_payment) {
        window.location.href = data.data.payment_url;
        return;
      }

      // Got LiveKit token — store in sessionStorage and redirect to classroom
      const d = data.data;
      sessionStorage.setItem('lk_token', d.livekit_token);
      sessionStorage.setItem('lk_url', d.livekit_url);
      sessionStorage.setItem('room_name', d.room_name);
      sessionStorage.setItem('participant_role', d.role);
      sessionStorage.setItem('participant_name', d.participant_name);
      sessionStorage.setItem('scheduled_start', d.scheduled_start);
      sessionStorage.setItem('duration_minutes', String(d.duration_minutes));
      sessionStorage.setItem('device', d.device || 'primary');
      sessionStorage.setItem('room_status', d.room_status || 'live');

      router.push(`/classroom/${d.room_id}`);
    } catch {
      setError('Network error. Please try again.');
      setJoining(false);
    }
  };

  // ── Poll for go-live when student is waiting ──
  useEffect(() => {
    if (!waitingForLive) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/open-classroom/${token}${sid ? `?sid=${sid}` : ''}`);
        const data = await res.json();
        if (data.success && data.data.status === 'live') {
          clearInterval(iv);
          setWaitingForLive(false);
          handleJoin();
        }
      } catch { /* retry next interval */ }
    }, 4000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForLive, token, sid]);

  // ── Poll for approval when waiting ──
  useEffect(() => {
    if (!waitingApproval || !name) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/open-classroom/${token}/join-status?name=${encodeURIComponent(name.trim())}`);
        const data = await res.json();
        if (data.success) {
          const st = data.data.approval_status;
          if (st === 'approved' || st === 'auto_approved') {
            clearInterval(iv);
            setWaitingApproval(false);
            handleJoin();
          } else if (st === 'denied') {
            clearInterval(iv);
            setWaitingApproval(false);
            setApprovalDenied(true);
          }
        }
      } catch { /* retry */ }
    }, 3000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingApproval, token, name]);

  // ── Countdown for scheduled classrooms ──
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    if (!info?.scheduled_at || info.can_join) return;
    const target = new Date(info.scheduled_at).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown(''); fetchInfo(); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [info, fetchInfo]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  // ── Error / not found ──
  if (!info) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Classroom Not Found</h2>
          <p className="text-sm text-gray-500 mt-2">{error || 'This link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  const isEnded = info.status === 'ended' || info.status === 'cancelled';
  const isTeacher = info.role === 'teacher';
  const needsPayment = info.payment_enabled && !isTeacher;
  const priceDisplay = info.price_paise > 0 ? `₹${(info.price_paise / 100).toFixed(0)}` : 'Free';

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <p className="text-emerald-100 text-xs font-medium">{platformName} Open Classroom</p>
              <h1 className="text-lg font-bold leading-tight">{info.title}</h1>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-emerald-100">
            {info.teacher_name && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {info.teacher_name}
              </span>
            )}
            {info.scheduled_at && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {new Date(info.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
                {' '}
                {new Date(info.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {info.duration_minutes ? `${info.duration_minutes} min` : 'Unlimited'}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {info.description && (
            <p className="text-sm text-gray-600 leading-relaxed">{info.description}</p>
          )}

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            {info.status === 'live' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Live Now
              </span>
            )}
            {isTeacher && (
              <span className="inline-flex items-center text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1">
                {info.teacher_portal_role === 'owner' ? 'Chairman (Host)' : 'Teacher (Host)'}
              </span>
            )}
            {needsPayment && (
              <span className="inline-flex items-center text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1">
                Entry: {priceDisplay}
              </span>
            )}
            {!needsPayment && !isTeacher && (
              <span className="inline-flex items-center text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1">
                Free Entry
              </span>
            )}
            <span className="inline-flex items-center text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
              {info.participant_count} joined
            </span>
          </div>

          {/* Waiting for teacher to go live */}
          {waitingForLive && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-amber-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-amber-800">Waiting for the teacher to start the class</p>
              <p className="text-xs text-amber-600">You&apos;ll be connected automatically once the class goes live.</p>
              <div className="flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* Waiting for teacher approval */}
          {waitingApproval && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-blue-800">Waiting for teacher approval</p>
              <p className="text-xs text-blue-600">The teacher will approve your request to join shortly.</p>
              <div className="flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* Approval denied */}
          {approvalDenied && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-2">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-red-800">Join request denied</p>
              <p className="text-xs text-red-600">The teacher has denied your request to join this classroom.</p>
            </div>
          )}

          {/* Countdown */}
          {countdown && !info.can_join && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-xs text-amber-600 font-medium mb-1">Classroom opens in</p>
              <p className="text-2xl font-bold text-amber-700 font-mono">{countdown}</p>
              <p className="text-xs text-amber-500 mt-1">Lobby opens 5 minutes before start</p>
            </div>
          )}

          {/* Ended/Cancelled state */}
          {isEnded && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-sm font-medium text-gray-700">
                {info.status === 'cancelled' ? 'This classroom has been cancelled.' : 'This classroom has ended.'}
              </p>
            </div>
          )}

          {/* Auto-join indicator (shared link or teacher host) */}
          {!isEnded && !waitingForLive && !waitingApproval && !approvalDenied && (isSharedLink || isTeacherHost) && (
            <div className="space-y-3">
              {joining && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <svg className="animate-spin h-5 w-5 text-emerald-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm text-gray-600">Joining as <strong>{name}</strong>…</span>
                </div>
              )}
              {!joining && !info.can_join && !countdown && (
                <p className="text-sm text-gray-500 text-center py-2">Waiting for classroom to open…</p>
              )}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Join form — only show for general links (no sid/host). Shared links & teacher auto-join. */}
          {!isEnded && !waitingForLive && !waitingApproval && !approvalDenied && !isSharedLink && !isTeacherHost && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Your Name</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition"
                />
              </div>

              {(needsPayment || isTeacher) && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Email {needsPayment && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition"
                  />
                </div>
              )}

              {needsPayment && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone (optional)</label>
                  <input
                    type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition"
                  />
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                  {error}
                </div>
              )}

              <button
                onClick={handleJoin}
                disabled={joining || !info.can_join || !name.trim()}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all text-sm shadow-lg shadow-emerald-200/50 active:scale-[0.98]"
              >
                {joining ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {needsPayment ? 'Proceeding to payment…' : 'Joining…'}
                  </span>
                ) : needsPayment ? (
                  `Pay ${priceDisplay} & Join`
                ) : (
                  'Join Classroom'
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-xs text-gray-400">Powered by {platformName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
