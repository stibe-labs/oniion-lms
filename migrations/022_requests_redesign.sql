-- Migration 022: Requests System Redesign
-- Enables teacher + coordinator session requests, per-session leave management

-- ═══════════════════════════════════════════════════════════════
-- 1. Allow teachers & coordinators to submit session requests
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE session_requests
  DROP CONSTRAINT IF EXISTS session_requests_requester_role_check;

ALTER TABLE session_requests
  ADD CONSTRAINT session_requests_requester_role_check
  CHECK (requester_role IN ('student', 'parent', 'teacher', 'batch_coordinator'));

-- ═══════════════════════════════════════════════════════════════
-- 2. Extend teacher_leave_requests for coordinators + session mgmt
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE teacher_leave_requests
  ADD COLUMN IF NOT EXISTS requester_role TEXT NOT NULL DEFAULT 'teacher'
    CHECK (requester_role IN ('teacher', 'batch_coordinator'));

ALTER TABLE teacher_leave_requests
  ADD COLUMN IF NOT EXISTS sessions_managed BOOLEAN NOT NULL DEFAULT FALSE;

-- ═══════════════════════════════════════════════════════════════
-- 3. Per-session actions after leave approval
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS leave_session_actions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id          UUID NOT NULL REFERENCES teacher_leave_requests(id) ON DELETE CASCADE,
  batch_session_id          TEXT NOT NULL REFERENCES batch_sessions(session_id),
  action_type               TEXT NOT NULL CHECK (action_type IN ('substitute', 'cancel', 'reschedule')),
  -- Substitute fields
  substitute_teacher_email  TEXT,
  substitute_teacher_name   TEXT,
  -- Reschedule fields
  new_date                  DATE,
  new_time                  TIME,
  -- Meta
  acted_by                  TEXT NOT NULL,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_session_actions_leave
  ON leave_session_actions(leave_request_id);

CREATE INDEX IF NOT EXISTS idx_leave_session_actions_session
  ON leave_session_actions(batch_session_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. Update email_log template_type constraint with new types
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE email_log DROP CONSTRAINT IF EXISTS email_log_template_type_check;

ALTER TABLE email_log ADD CONSTRAINT email_log_template_type_check CHECK (
  template_type = ANY (ARRAY[
    'teacher_invite', 'student_invite', 'room_reminder',
    'room_cancelled', 'room_rescheduled', 'payment_confirmation',
    'coordinator_summary', 'batch_coordinator_notify', 'batch_teacher_notify',
    'batch_student_notify', 'batch_parent_notify', 'daily_timetable',
    'session_reminder', 'weekly_timetable', 'weekly_timetable_auto',
    'session_request_submitted', 'session_request_approved', 'session_request_rejected',
    'session_rescheduled_notify', 'session_cancelled_notify',
    'availability_submitted', 'leave_request_submitted', 'leave_request_approved',
    'leave_request_rejected', 'leave_sessions_affected',
    'invoice_generated', 'payment_receipt', 'payslip_notification',
    'payment_reminder', 'credentials',
    -- Demo email types
    'demo_teacher_request', 'demo_student_searching', 'demo_accepted',
    'demo_summary_teacher', 'demo_summary_ao', 'demo_summary_student',
    'demo_rejected', 'demo_cancelled', 'demo_ao_accepted',
    -- Requests redesign (NEW)
    'substitute_teacher_assigned', 'leave_session_managed',
    'coordinator_leave_submitted', 'coordinator_leave_approved', 'coordinator_leave_rejected'
  ])
);
