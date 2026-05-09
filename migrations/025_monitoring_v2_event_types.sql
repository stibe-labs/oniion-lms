-- Migration 025: Add new monitoring event types and alert types for AI Monitor v2
-- New event types: tab_switched, yawning, inactive, head_turned
-- New alert types: tab_switching, student_yawning, student_inactive, head_turned, multiple_faces_detected

-- Drop and recreate the CHECK constraint on class_monitoring_events.event_type
ALTER TABLE class_monitoring_events DROP CONSTRAINT IF EXISTS class_monitoring_events_event_type_check;
ALTER TABLE class_monitoring_events ADD CONSTRAINT class_monitoring_events_event_type_check
  CHECK (event_type IN (
    'attentive','looking_away','eyes_closed','not_in_frame','low_engagement',
    'hand_raised','speaking','distracted','phone_detected','multiple_faces',
    'tab_switched','yawning','inactive','head_turned'
  ));

-- Drop and recreate the CHECK constraint on monitoring_alerts.alert_type
ALTER TABLE monitoring_alerts DROP CONSTRAINT IF EXISTS monitoring_alerts_alert_type_check;
ALTER TABLE monitoring_alerts ADD CONSTRAINT monitoring_alerts_alert_type_check
  CHECK (alert_type IN (
    'teacher_absent','teacher_camera_off','class_started_late','class_cancelled',
    'low_attendance','student_sleeping','student_not_looking','student_left_frame',
    'student_distracted','class_disruption','contact_violation','phone_detected','unusual_leave',
    'tab_switching','student_yawning','student_inactive','head_turned','multiple_faces_detected'
  ));
