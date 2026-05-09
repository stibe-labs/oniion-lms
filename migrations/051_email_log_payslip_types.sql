-- ═══════════════════════════════════════════════════════════════
-- Migration 051: Add payslip_notification and payslip_paid to
--                email_log template_type check constraint
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE email_log DROP CONSTRAINT IF EXISTS email_log_template_type_check;

ALTER TABLE email_log ADD CONSTRAINT email_log_template_type_check CHECK (
  template_type = ANY (ARRAY[
    'teacher_invite','student_invite','room_reminder','room_cancelled',
    'room_rescheduled','payment_confirmation','coordinator_summary',
    'batch_coordinator_notify','batch_teacher_notify','batch_student_notify',
    'batch_parent_notify','daily_timetable','password_reset','password_reset_confirm',
    'demo_link','demo_reminder','demo_summary','demo_ao_accepted','demo_accepted',
    'demo_student_searching','demo_summary_ao','demo_summary_student',
    'demo_summary_teacher','demo_teacher_request',
    'session_request_submitted','session_request_approved','session_request_rejected',
    'session_reminder','weekly_timetable_auto',
    'leave_submitted','leave_ao_forwarded','leave_hr_approved','leave_hr_rejected',
    'leave_ao_rejected','leave_confirmed','leave_withdrawn','leave_session_impact',
    'leave_session_cancelled','leave_session_rescheduled','leave_session_substituted',
    'invoice_generated','payment_receipt','payment_reminder',
    'payroll_generated','payslip_notification','payslip_paid',
    'general'
  ])
);
