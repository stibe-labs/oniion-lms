-- Migration 089: Quarterly payment due date for group batch students
-- Adds quarterly_due_date to batch_students.
-- When set, the student is on a quarterly payment plan and is blocked from
-- joining sessions if the due date has passed without paying.
-- NULL = student is on OTP (one-time payment) or annual plan — no recurring gate.

ALTER TABLE batch_students
  ADD COLUMN IF NOT EXISTS quarterly_due_date DATE;

COMMENT ON COLUMN batch_students.quarterly_due_date IS
  'Next quarterly payment due date. NULL = OTP/annual plan (no recurring gate). '
  'When this date is in the past, the student is blocked from joining sessions until AO advances the date after payment.';

-- Index for fast due-date gate lookups in room/join and session-check routes
CREATE INDEX IF NOT EXISTS idx_batch_students_quarterly_due
  ON batch_students (student_email, quarterly_due_date)
  WHERE quarterly_due_date IS NOT NULL;
