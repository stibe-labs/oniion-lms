-- Add demo_ended_by_teacher to room_events event_type CHECK constraint
-- Required for: demo sessions ended by teacher (commit 6e9f1fd)

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
    'room_ended_by_coordinator','demo_ended_by_teacher'
  ])
);
