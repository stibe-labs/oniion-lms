-- Migration 083: Add writing-aware monitoring event types (AI Monitor v3)
-- New states: writing_notes, brief_absence, low_visibility, in_exam
-- These are positive/neutral states that count as engaged time.

ALTER TABLE class_monitoring_events DROP CONSTRAINT IF EXISTS class_monitoring_events_event_type_check;
ALTER TABLE class_monitoring_events ADD CONSTRAINT class_monitoring_events_event_type_check
  CHECK (event_type IN (
    'attentive','looking_away','eyes_closed','not_in_frame','low_engagement',
    'hand_raised','speaking','distracted','phone_detected','multiple_faces',
    'tab_switched','yawning','inactive','head_turned',
    -- v3 additions (positive/neutral behaviors)
    'writing_notes','brief_absence','low_visibility','in_exam'
  ));

-- Add new academic_settings key for monitoring tuning (if not present)
INSERT INTO academic_settings (setting_key, setting_values)
VALUES ('monitoring_tuning', ARRAY['{"writing_aware_mode":true,"mobile_relaxed_thresholds":true,"exam_strict_mode":false,"low_visibility_fallback":true}'])
ON CONFLICT (setting_key) DO NOTHING;
