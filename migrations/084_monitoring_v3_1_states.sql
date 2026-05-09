-- Migration 084: Add thinking + reading_material states (AI Monitor v3.1)
-- These are positive/neutral states that count as engaged time.

ALTER TABLE class_monitoring_events DROP CONSTRAINT IF EXISTS class_monitoring_events_event_type_check;
ALTER TABLE class_monitoring_events ADD CONSTRAINT class_monitoring_events_event_type_check
  CHECK (event_type IN (
    'attentive','looking_away','eyes_closed','not_in_frame','low_engagement',
    'hand_raised','speaking','distracted','phone_detected','multiple_faces',
    'tab_switched','yawning','inactive','head_turned',
    -- v3 additions
    'writing_notes','brief_absence','low_visibility','in_exam',
    -- v3.1 additions
    'thinking','reading_material'
  ));
