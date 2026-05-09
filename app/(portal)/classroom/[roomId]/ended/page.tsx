'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { usePlatformName } from '@/components/providers/PlatformProvider';

/**
 * /classroom/[roomId]/ended — Class ended screen.
 * Shown after teacher ends the class, participant disconnects, or time expires.
 *
 * For STUDENTS: Shows mandatory attendance + teacher rating form.
 * For others: Shows class ended message + return to dashboard.
 */

const QUICK_TAGS = [
  { id: 'clear_teaching', label: '🎯 Clear Teaching' },
  { id: 'good_pace', label: '⏱ Good Pace' },
  { id: 'interactive', label: '💬 Interactive' },
  { id: 'helpful', label: '🙌 Helpful' },
  { id: 'too_fast', label: '⚡ Too Fast' },
  { id: 'too_slow', label: '🐢 Too Slow' },
  { id: 'need_more_practice', label: '📝 Need Practice' },
  { id: 'audio_issues', label: '🔊 Audio Issues' },
];

export default function ClassEndedPage() {
  const platformName = usePlatformName();
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const { user } = useSession();
  const [roomName, setRoomName] = useState<string>('');
  const [participantRole, setParticipantRole] = useState<string>('');
  const [participantName, setParticipantName] = useState<string>('');
  const [sessionTopic, setSessionTopic] = useState<string>('');

  const reason = searchParams.get('reason'); // 'expired' | null

  // Student post-session form state
  const [attendanceConfirmed, setAttendanceConfirmed] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [interestAnswered, setInterestAnswered] = useState(false);
  const [submittingInterest, setSubmittingInterest] = useState(false);

  useEffect(() => {
    // Read session data before clearing
    const name = sessionStorage.getItem('room_name');
    const role = sessionStorage.getItem('participant_role');
    const pName = sessionStorage.getItem('participant_name');
    if (name) setRoomName(name);
    if (role) setParticipantRole(role);
    if (pName) setParticipantName(pName);
    const storedTopic = sessionStorage.getItem('topic');
    if (storedTopic) {
      setSessionTopic(storedTopic);
      setClassPortion(storedTopic);
    }

    // Check if feedback was already submitted (survives refresh)
    const alreadySubmitted = sessionStorage.getItem(`feedback_submitted_${roomId}`);
    if (alreadySubmitted === 'true') setSubmitted(true);

    const alreadyAnsweredInterest = sessionStorage.getItem(`interest_answered_${roomId}`);
    if (alreadyAnsweredInterest === 'true') setInterestAnswered(true);

    // Clear classroom session data (but keep role info for the form)
    sessionStorage.removeItem('lk_token');
    sessionStorage.removeItem('lk_url');
  }, []);

  // Determine dashboard URL based on role
  const getDashboardUrl = () => {
    if (!user) return '/login';
    const dashMap: Record<string, string> = {
      teacher: '/teacher',
      student: '/student',
      coordinator: '/coordinator',
      academic_operator: '/academic-operator',
      academic: '/academic-operator',
      hr: '/hr',
      parent: '/parent',
      owner: '/owner',
      ghost: '/ghost',
    };
    return dashMap[user.role] || '/';
  };

  const handleGoToDashboard = () => {
    // Clear remaining session data
    sessionStorage.removeItem('room_name');
    sessionStorage.removeItem('participant_role');
    sessionStorage.removeItem('participant_name');
    sessionStorage.removeItem('participant_email');
    // Demo students → login screen (they don't have portal accounts)
    if (roomId.startsWith('demo_') && (!user || user.role === 'student')) {
      router.push('/login');
      return;
    }
    router.push(getDashboardUrl());
  };

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }, []);

  const handleSubmitFeedback = useCallback(async () => {
    if (!attendanceConfirmed || rating === 0) return;
    setSubmitting(true);
    try {
      await fetch(`/api/v1/room/${roomId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          student_email: user?.id || '',
          student_name: participantName || user?.name || '',
          rating,
          feedback_text: comment.trim(),
          tags: selectedTags.join(','),
          attendance_confirmed: true,
        }),
      });
      setSubmitted(true);
      sessionStorage.setItem(`feedback_submitted_${roomId}`, 'true');
    } catch {
      // Best effort — still allow dashboard
      setSubmitted(true);
      sessionStorage.setItem(`feedback_submitted_${roomId}`, 'true');
    } finally {
      setSubmitting(false);
    }
  }, [roomId, user, participantName, attendanceConfirmed, rating, comment, selectedTags]);

  // Teacher post-session form state
  const [classPortion, setClassPortion] = useState('');
  const [classRemarks, setClassRemarks] = useState('');
  const [savingPortion, setSavingPortion] = useState(false);
  const [portionSaved, setPortionSaved] = useState(false);

  const isExpired = reason === 'expired';
  const isDemo = roomId.startsWith('demo_');
  // For demo rooms: if no portal session and not teacher, treat as demo student
  const isStudent = participantRole === 'student' || user?.role === 'student'
    || (isDemo && user?.role !== 'teacher' && participantRole !== 'teacher');
  const displayRating = hoverRating || rating;
  const canSubmit = isDemo ? rating > 0 : (attendanceConfirmed && rating > 0);

  // ── Demo feedback submission (no attendance confirmation, use email from session cookie or sessionStorage) ──
  const handleSubmitDemoFeedback = useCallback(async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const email = user?.id || sessionStorage.getItem('participant_email') || participantName || '';
      await fetch(`/api/v1/room/${roomId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          student_email: email,
          student_name: participantName || user?.name || '',
          rating,
          feedback_text: comment.trim(),
          tags: selectedTags.join(','),
          attendance_confirmed: true,
        }),
      });
    } catch { /* best effort */ }
    setSubmitted(true);
    sessionStorage.setItem(`feedback_submitted_${roomId}`, 'true');
    setSubmitting(false);
  }, [roomId, user, participantName, rating, comment, selectedTags]);

  const handleInterestResponse = useCallback(async (interested: boolean) => {
    setSubmittingInterest(true);
    try {
      const email = user?.id || sessionStorage.getItem('participant_email') || participantName || '';
      await fetch(`/api/v1/room/${roomId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          student_email: email,
          student_name: participantName || user?.name || '',
          rating: rating || 5,
          attendance_confirmed: true,
          interest: interested,
        }),
      });
    } catch { /* best effort */ }
    setInterestAnswered(true);
    sessionStorage.setItem(`interest_answered_${roomId}`, 'true');
    setSubmittingInterest(false);
  }, [roomId, user, participantName, rating]);

  const handleSavePortion = useCallback(async () => {
    if (!classPortion.trim() && !classRemarks.trim()) return;
    setSavingPortion(true);
    try {
      const res = await fetch(`/api/v1/room/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          class_portion: classPortion.trim(),
          class_remarks: classRemarks.trim(),
        }),
      });
      if (res.ok) setPortionSaved(true);
    } catch { /* best effort */ }
    setSavingPortion(false);
  }, [roomId, classPortion, classRemarks]);

  // ── Demo student: simplified post-session screen ──
  if (isDemo && isStudent) {
    // Step 2: Interest question (after feedback submitted, before thank you)
    if (submitted && !interestAnswered) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="w-full max-w-md text-center">
            <div className="text-5xl mb-4">🤔</div>
            <h1 className="text-2xl font-bold text-white mb-2">One Last Question</h1>
            <p className="text-sm text-muted-foreground mb-8">
              Would you like to continue learning with {platformName}?
            </p>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <button
                onClick={() => handleInterestResponse(true)}
                disabled={submittingInterest}
                className="rounded-xl px-6 py-4 text-base font-semibold bg-[#34a853] hover:bg-[#2d9148] text-white transition-colors disabled:opacity-50"
              >
                ✅ Yes, I&apos;m interested!
              </button>
              <button
                onClick={() => handleInterestResponse(false)}
                disabled={submittingInterest}
                className="rounded-xl px-6 py-4 text-base font-medium bg-[#3c4043] hover:bg-[#4a4e52] text-[#9aa0a6] transition-colors disabled:opacity-50"
              >
                Not right now
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Step 3: Thank you screen
    if (submitted && interestAnswered) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="max-w-md text-center px-4">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#34a853]/10">
              <span className="text-4xl">🎉</span>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-white">Thank You!</h1>
            <p className="mb-1 text-sm text-muted-foreground">
              Your demo session has ended. We hope you enjoyed the experience!
            </p>
            {rating > 0 && (
              <div className="flex justify-center gap-1 my-3">
                {[1, 2, 3, 4, 5].map(s => (
                  <span key={s} className={`text-2xl ${s <= rating ? 'grayscale-0' : 'grayscale opacity-30'}`}>⭐</span>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3 mb-5">
              Our team will be in touch with you shortly about enrollment options.
            </p>
            <button
              onClick={() => {
                try { window.close(); } catch { /* ignore */ }
                // Fallback: if window.close() is blocked by browser, navigate home
                setTimeout(() => { window.location.href = 'https://stibelearning.online'; }, 300);
              }}
              className="rounded-lg bg-[#3c4043] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4a4e52]"
            >
              Close Window
            </button>
            <p className="text-xs text-muted-foreground mt-3">You can safely close this tab.</p>
          </div>
        </div>
      );
    }

    // Demo student: simple rating form (no attendance confirmation)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">📝</div>
            <h1 className="text-2xl font-bold text-white mb-1">Demo Session Ended</h1>
            {roomName && <p className="text-sm text-muted-foreground">{roomName}</p>}
            {sessionTopic && <p className="text-xs text-muted-foreground">Topic: {sessionTopic}</p>}
          </div>

          <div className="rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/10 overflow-hidden">
            {/* Teacher Rating */}
            <div className="p-5 border-b border-white/10">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">⭐</span>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    How was your demo session?
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Rate your experience — this helps us improve!
                  </p>
                  <div className="flex justify-center gap-2 mb-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="transition-transform hover:scale-110 active:scale-95"
                      >
                        <span className={`text-3xl transition-all ${star <= displayRating ? 'grayscale-0' : 'grayscale opacity-30'}`}>
                          ⭐
                        </span>
                      </button>
                    ))}
                  </div>
                  {displayRating > 0 && (
                    <p className="text-center text-xs text-foreground/80">
                      {displayRating === 1 && 'Poor'}
                      {displayRating === 2 && 'Fair'}
                      {displayRating === 3 && 'Good'}
                      {displayRating === 4 && 'Very Good'}
                      {displayRating === 5 && 'Excellent!'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Optional comment */}
            <div className="p-5 border-b border-white/10">
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Any comments about the session? (optional)"
                className="w-full rounded-xl bg-[#3c4043] px-3 py-2 text-sm text-white placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
                rows={2}
                maxLength={500}
              />
            </div>

            {/* Submit */}
            <div className="p-5 flex gap-3">
              <button
                onClick={() => { setSubmitted(true); sessionStorage.setItem(`feedback_submitted_${roomId}`, 'true'); }}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-medium text-[#9aa0a6] bg-[#3c4043] hover:bg-[#4a4e52] transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleSubmitDemoFeedback}
                disabled={rating === 0 || submitting}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                  rating > 0
                    ? 'bg-[#34a853] hover:bg-[#2d9148] text-white'
                    : 'bg-[#3c4043] text-[#5f6368] cursor-not-allowed'
                }`}
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Our team will contact you about enrollment options.
          </p>
        </div>
      </div>
    );
  }

  // ── Regular student: feedback already submitted ──
  if (isStudent && submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#34a853]/10">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-white">Thank You!</h1>
          <p className="mb-2 text-sm text-muted-foreground">
            Your attendance has been recorded and feedback submitted.
          </p>
          <div className="flex justify-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map(s => (
              <span key={s} className={`text-2xl ${s <= rating ? 'grayscale-0' : 'grayscale opacity-30'}`}>⭐</span>
            ))}
          </div>
          <button
            onClick={handleGoToDashboard}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Student: mandatory attendance + rating form ──
  if (isStudent && !submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">{isExpired ? '⏰' : '📝'}</div>
            <h1 className="text-2xl font-bold text-white mb-1">Session Ended</h1>
            {roomName && <p className="text-sm text-muted-foreground">{roomName}</p>}
            {sessionTopic && <p className="text-xs text-muted-foreground">Topic: {sessionTopic}</p>}
          </div>

          <div className="rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/10 overflow-hidden">

            {/* Step 1: Mandatory Attendance */}
            <div className="p-5 border-b border-white/10">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">📋</span>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">Confirm Your Attendance</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Please confirm that you attended this session. This is mandatory.
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      onClick={() => setAttendanceConfirmed(!attendanceConfirmed)}
                      className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${
                        attendanceConfirmed
                          ? 'bg-[#34a853] border-[#34a853]'
                          : 'border-[#5f6368] group-hover:border-[#8ab4f8]'
                      }`}
                    >
                      {attendanceConfirmed && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-[#e8eaed] font-medium">
                      I confirm that I attended this session
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Step 2: Mandatory Teacher Rating */}
            <div className="p-5 border-b border-white/10">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">⭐</span>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    Rate Your Teacher <span className="text-[#ea4335] text-xs">(Required)</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    How was the teaching quality in this session?
                  </p>

                  {/* Star Rating */}
                  <div className="flex justify-center gap-2 mb-3">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="transition-transform hover:scale-110 active:scale-95"
                      >
                        <span className={`text-3xl transition-all ${star <= displayRating ? 'grayscale-0' : 'grayscale opacity-30'}`}>
                          ⭐
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Rating label */}
                  {displayRating > 0 && (
                    <p className="text-center text-xs text-foreground/80 mb-2">
                      {displayRating === 1 && 'Poor'}
                      {displayRating === 2 && 'Fair'}
                      {displayRating === 3 && 'Good'}
                      {displayRating === 4 && 'Very Good'}
                      {displayRating === 5 && 'Excellent!'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Optional Tags + Comment */}
            <div className="p-5 border-b border-white/10">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">💬</span>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    Quick Feedback <span className="text-xs text-muted-foreground">(Optional)</span>
                  </h3>

                  {/* Quick Tags */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {QUICK_TAGS.map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                          selectedTags.includes(tag.id)
                            ? 'bg-blue-600/20 text-blue-300 ring-1 ring-blue-500/30'
                            : 'bg-[#3c4043] text-muted-foreground hover:bg-[#4a4e52]'
                        }`}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>

                  {/* Comment */}
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Any additional comments?"
                    className="w-full rounded-xl bg-[#3c4043] px-3 py-2 text-sm text-white placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
                    rows={2}
                    maxLength={500}
                  />
                </div>
              </div>
            </div>

            {/* Validation message */}
            {!canSubmit && (
              <div className="px-5 py-3 bg-[#ea4335]/10 border-b border-[#ea4335]/20">
                <p className="text-xs text-[#ea4335] font-medium text-center">
                  {!attendanceConfirmed && !rating
                    ? '⚠ Please confirm attendance and rate your teacher to continue'
                    : !attendanceConfirmed
                    ? '⚠ Please confirm your attendance'
                    : '⚠ Please rate your teacher to continue'}
                </p>
              </div>
            )}

            {/* Submit button */}
            <div className="p-5">
              <button
                onClick={handleSubmitFeedback}
                disabled={!canSubmit || submitting}
                className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                  canSubmit
                    ? 'bg-[#34a853] hover:bg-[#2d9148] text-white'
                    : 'bg-[#3c4043] text-[#5f6368] cursor-not-allowed'
                }`}
              >
                {submitting ? 'Submitting…' : 'Submit & Return to Dashboard'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Non-student: ended screen + teacher class portion form ──
  const isTeacher = participantRole === 'teacher' || user?.role === 'teacher';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="mb-4 text-5xl">{isExpired ? '⏰' : '✅'}</div>
          <h1 className="mb-2 text-2xl font-bold text-white">
            {isExpired ? 'Session Time Ended' : 'Session Ended'}
          </h1>
          {roomName && (
            <p className="mb-1 text-muted-foreground">{roomName}</p>
          )}
          {sessionTopic && (
            <p className="mb-1 text-xs text-muted-foreground">Topic: {sessionTopic}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {isExpired
              ? 'The scheduled session time has ended.'
              : 'The session has ended. All participants have been disconnected.'}
          </p>
        </div>

        {/* Teacher: class portion + remarks form */}
        {isTeacher && !isDemo && (
          <div className="rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/10 overflow-hidden mb-6">
            {portionSaved ? (
              <div className="p-6 text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm font-medium text-[#34a853]">Class details saved successfully!</p>
              </div>
            ) : (
              <>
                <div className="p-5 border-b border-white/10">
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">📝</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-white mb-1">Topics Covered</h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        What topics/portions did you cover in this session?
                      </p>
                      <input
                        type="text"
                        value={classPortion}
                        onChange={e => setClassPortion(e.target.value)}
                        placeholder="e.g. Chapter 5 — Quadratic Equations, solving by factorization"
                        className="w-full rounded-xl bg-[#3c4043] px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                        maxLength={500}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-5 border-b border-white/10">
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">💬</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-white mb-1">
                        Class Remarks <span className="text-xs text-muted-foreground">(Optional)</span>
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Any observations about the session? Student engagement, issues, notes.
                      </p>
                      <textarea
                        value={classRemarks}
                        onChange={e => setClassRemarks(e.target.value)}
                        placeholder="e.g. Class was engaged. 2 students were late. Need to revisit integration basics next session."
                        className="w-full rounded-xl bg-[#3c4043] px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
                        rows={3}
                        maxLength={1000}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-5 flex gap-3">
                  <button
                    onClick={handleGoToDashboard}
                    className="flex-1 rounded-xl px-4 py-3 text-sm font-medium text-[#9aa0a6] bg-[#3c4043] hover:bg-[#4a4e52] transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleSavePortion}
                    disabled={(!classPortion.trim() && !classRemarks.trim()) || savingPortion}
                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                      classPortion.trim() || classRemarks.trim()
                        ? 'bg-[#34a853] hover:bg-[#2d9148] text-white'
                        : 'bg-[#3c4043] text-[#5f6368] cursor-not-allowed'
                    }`}
                  >
                    {savingPortion ? 'Saving…' : 'Save & Continue'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={handleGoToDashboard}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
