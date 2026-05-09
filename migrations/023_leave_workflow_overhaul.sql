-- Migration 023: Leave Workflow Overhaul
-- New flow: Teacher → AO (review + resolve sessions) → HR (approve plan) → Confirmed
-- ═══════════════════════════════════════════════════════════════

-- 1. Update status constraint to support new workflow stages
ALTER TABLE teacher_leave_requests
  DROP CONSTRAINT IF EXISTS teacher_leave_requests_status_check;

ALTER TABLE teacher_leave_requests
  ADD CONSTRAINT teacher_leave_requests_status_check
  CHECK (status IN ('pending_ao', 'pending_hr', 'approved', 'confirmed', 'rejected', 'withdrawn',
                    'pending'));  -- keep 'pending' temporarily for migration

-- 2. Add new columns for resolution workflow
ALTER TABLE teacher_leave_requests
  ADD COLUMN IF NOT EXISTS resolution_plan JSONB DEFAULT '[]'::jsonb;

ALTER TABLE teacher_leave_requests
  ADD COLUMN IF NOT EXISTS ai_suggestions JSONB;

ALTER TABLE teacher_leave_requests
  ADD COLUMN IF NOT EXISTS forwarded_at TIMESTAMPTZ;

ALTER TABLE teacher_leave_requests
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- 3. Migrate existing data: pending → pending_ao
UPDATE teacher_leave_requests SET status = 'pending_ao' WHERE status = 'pending';

-- 4. Remove legacy 'pending' from constraint now migration done
ALTER TABLE teacher_leave_requests
  DROP CONSTRAINT IF EXISTS teacher_leave_requests_status_check;

ALTER TABLE teacher_leave_requests
  ADD CONSTRAINT teacher_leave_requests_status_check
  CHECK (status IN ('pending_ao', 'pending_hr', 'approved', 'confirmed', 'rejected', 'withdrawn'));

-- 5. Drop owner columns (dead weight — owner never approves leaves)
ALTER TABLE teacher_leave_requests
  DROP COLUMN IF EXISTS owner_status,
  DROP COLUMN IF EXISTS owner_reviewed_by,
  DROP COLUMN IF EXISTS owner_reviewed_at,
  DROP COLUMN IF EXISTS owner_notes;

-- 6. Update email_log constraint with new template types
ALTER TABLE email_log DROP CONSTRAINT IF EXISTS email_log_template_type_check;

ALTER TABLE email_log ADD CONSTRAINT email_log_template_type_check CHECK (
  template_type = ANY (ARRAY[
    'teacher_invite', 'student_invite', 'room_reminder',
    'room_cancelled', 'room_rescheduled', 'payment_confirmation',
    'coordinator_summary', 'batch_coordinator_notify', 'batch_teacher_notify',
    'batch_student_notify', 'batch_parent_notify', 'daily_timetable',
    'password_reset', 'password_reset_confirm',
    'demo_link', 'demo_reminder', 'demo_summary', 'demo_ao_accepted',
    'demo_accepted', 'demo_student_searching', 'demo_summary_ao',
    'demo_summary_student', 'demo_summary_teacher', 'demo_teacher_request',
    'session_request_submitted', 'session_request_approved', 'session_request_rejected',
    'session_reminder', 'weekly_timetable_auto',
    'leave_submitted', 'leave_ao_forwarded', 'leave_hr_approved', 'leave_hr_rejected',
    'leave_ao_rejected', 'leave_confirmed', 'leave_withdrawn',
    'leave_session_impact', 'leave_session_cancelled', 'leave_session_rescheduled',
    'leave_session_substituted',
    'invoice_generated', 'payment_receipt', 'payment_reminder', 'payroll_generated',
    'general'
  ])
);
