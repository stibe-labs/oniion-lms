-- 107_room_events_constraint.sql
--
-- Adds 'livekit_idle_close_ignored' (and a few other event_types currently
-- inserted by the codebase but missing from the check constraint) to the
-- room_events_event_type_check constraint.
--
-- Symptom before this fix: webhook handler tries to record an audit event
-- when LiveKit auto-closes a room due to idleness, the INSERT fails with
-- "violates check constraint" 23514, the request returns 500, and the log
-- gets spammed.

ALTER TABLE room_events DROP CONSTRAINT IF EXISTS room_events_event_type_check;

ALTER TABLE room_events ADD CONSTRAINT room_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'room_created',
    'room_started',
    'room_ended_by_teacher',
    'room_ended_by_coordinator',
    'room_expired',
    'room_cancelled',
    'participant_joined',
    'participant_left',
    'payment_completed',
    'notification_sent',
    'reminder_sent',
    'recording_started',
    'recording_stopped',
    'recording_completed',
    'recording_failed',
    'attention_update',
    'exam_started',
    'exam_submitted',
    'teacher_joined',
    'teacher_left',
    'go_live',
    'attendance_marked',
    'attendance_update',
    'contact_violation',
    'contact_violation_detected',
    'student_feedback',
    'class_portion_updated',
    'class_remarks_updated',
    'cancellation_requested',
    'cancellation_approved',
    'cancellation_rejected',
    'rejoin_requested',
    'rejoin_approved',
    'rejoin_denied',
    'fee_payment_confirmed',
    'fee_payment',
    'admission_status_change',
    'session_report_generated',
    'parent_report_generated',
    'monitoring_alert',
    'teacher_camera_toggle',
    'student_attention_low',
    'class_report_generated',
    'end_class_requested',
    'end_class_approved',
    'end_class_denied',
    'demo_ended_by_teacher',
    'egress_ended',
    'ghost_mode_entry',
    'ghost_mode_exit',
    'session_extended',
    -- New in this migration:
    'livekit_idle_close_ignored'
  ]));
