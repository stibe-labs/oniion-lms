'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

/**
 * FeedbackDialog — Post-class rating popup for students.
 *
 * Shows:
 *   - 5 star rating (required)
 *   - Quick feedback tags (optional)
 *   - Free-text comment (optional)
 *   - Submit → POST /api/v1/room/[room_id]/feedback
 *   - Skip button → closes without submitting
 *
 * Appears as a modal overlay when student is about to leave.
 */

export interface FeedbackDialogProps {
  roomId: string;
  studentEmail: string;
  studentName: string;
  onComplete: () => void; // called after submit or skip
}

const QUICK_TAGS = [
  { id: 'clear_teaching', label: '🎯 Clear Teaching', emoji: '🎯' },
  { id: 'good_pace', label: '⏱ Good Pace', emoji: '⏱' },
  { id: 'interactive', label: '💬 Interactive', emoji: '💬' },
  { id: 'helpful', label: '🙌 Helpful', emoji: '🙌' },
  { id: 'too_fast', label: '⚡ Too Fast', emoji: '⚡' },
  { id: 'too_slow', label: '🐢 Too Slow', emoji: '🐢' },
  { id: 'need_more_practice', label: '📝 Need Practice', emoji: '📝' },
  { id: 'audio_issues', label: '🔊 Audio Issues', emoji: '🔊' },
];

export default function FeedbackDialog({
  roomId,
  studentEmail,
  studentName,
  onComplete,
}: FeedbackDialogProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await fetch(`/api/v1/room/${roomId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          student_email: studentEmail,
          student_name: studentName,
          rating,
          feedback_text: comment.trim(),
          tags: selectedTags.join(','),
          attendance_confirmed: true,
        }),
      });
      setSubmitted(true);
      setTimeout(onComplete, 1200);
    } catch {
      // Best-effort — still close
      onComplete();
    } finally {
      setSubmitting(false);
    }
  }, [roomId, studentEmail, studentName, rating, comment, selectedTags, onComplete]);

  const displayRating = hoverRating || rating;

  if (submitted) {
    return (
      <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/70 backdrop-blur-md">
        <div className="mx-4 w-full max-w-sm rounded-3xl bg-[#2d2e30] p-8 text-center shadow-2xl ring-1 ring-white/6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#34a853]/10">
            <span className="text-3xl">✅</span>
          </div>
          <h3 className="text-lg font-semibold text-white">Thank you!</h3>
          <p className="mt-1 text-sm text-muted-foreground">Your feedback helps us improve.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="mx-4 w-full max-w-sm rounded-3xl bg-[#2d2e30] p-6 shadow-2xl ring-1 ring-white/6">
        {/* Header */}
        <div className="text-center mb-5">
          <h3 className="text-lg font-semibold text-white">How was your session?</h3>
          <p className="mt-1 text-sm text-muted-foreground">Rate your experience</p>
        </div>

        {/* Star Rating */}
        <div className="flex justify-center gap-2 mb-5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="transition-transform hover:scale-110 active:scale-95"
            >
              <span
                className={cn(
                  'text-3xl transition-all',
                  star <= displayRating ? 'grayscale-0' : 'grayscale opacity-30',
                )}
              >
                ⭐
              </span>
            </button>
          ))}
        </div>

        {/* Rating label */}
        {displayRating > 0 && (
          <p className="text-center text-sm text-foreground/80 mb-4">
            {displayRating === 1 && 'Poor'}
            {displayRating === 2 && 'Fair'}
            {displayRating === 3 && 'Good'}
            {displayRating === 4 && 'Very Good'}
            {displayRating === 5 && 'Excellent!'}
          </p>
        )}

        {/* Quick Tags */}
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                selectedTags.includes(tag.id)
                  ? 'bg-blue-600/20 text-blue-300 ring-1 ring-blue-500/30'
                  : 'bg-[#3c4043] text-muted-foreground hover:bg-[#4a4e52] hover:text-foreground/80',
              )}
            >
              {tag.label}
            </button>
          ))}
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Any additional comments? (optional)"
          className="w-full rounded-xl bg-[#3c4043] px-3 py-2 text-sm text-white placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
          rows={2}
          maxLength={500}
        />

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onComplete}
            className="flex-1 rounded-xl bg-[#3c4043] px-4 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-[#4a4e52]"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
