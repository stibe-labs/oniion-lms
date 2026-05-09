-- Migration 030: Ghost mode audit log + fix egress_ended event type
-- Adds ghost_mode_entry and ghost_mode_exit event types to room_events CHECK
-- Also adds egress_ended which was used in webhook but missing from constraint

ALTER TABLE room_events DROP CONSTRAINT room_events_event_type_check;

ALTER TABLE room_events ADD CONSTRAINT room_events_event_type_check CHECK (
  event_type = ANY(ARRAY[
    'room_created','room_started','room_ended_by_teacher','room_expired','room_cancelled',
    'participant_joined','participant_left','payment_completed','notification_sent','reminder_sent',
    'recording_started','recording_stopped','attention_update','exam_started','exam_submitted',
    'teacher_joined','teacher_left','go_live','attendance_marked','attendance_update',
    'recording_completed','recording_failed','contact_violation','contact_violation_detected',
    'student_feedback','class_portion_updated','class_remarks_updated',
    'cancellation_requested','cancellation_approved','cancellation_rejected',
    'rejoin_requested','rejoin_approved','rejoin_denied',
    'fee_payment_confirmed','fee_payment','admission_status_change',
    'session_report_generated','parent_report_generated','monitoring_alert',
    'teacher_camera_toggle','student_attention_low','class_report_generated',
    'end_class_requested','end_class_approved','end_class_denied',
    'room_ended_by_coordinator','demo_ended_by_teacher',
    'egress_ended',
    'ghost_mode_entry','ghost_mode_exit'
  ])
);
