-- Migration 019: Add missing demo email template types to email_log constraint
-- The demo summary + reject/cancel notifications use types not in the CHECK constraint.

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
    -- Demo email types (from migration 015)
    'demo_teacher_request', 'demo_student_searching', 'demo_accepted',
    -- Demo summary + lifecycle types (NEW)
    'demo_summary_teacher', 'demo_summary_ao', 'demo_summary_student',
    'demo_rejected', 'demo_cancelled'
  ])
);
