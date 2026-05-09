-- Migration 074: Teacher controls — stored in academic_settings as JSON toggles
-- Uses existing academic_settings table (setting_key TEXT PK, setting_values TEXT[])
-- We store teacher_controls as a single-element array containing a JSON string

INSERT INTO academic_settings (setting_key, setting_values)
VALUES ('teacher_controls', ARRAY['{"go_live_skip_coordinator":false,"allow_go_live_before_schedule":false,"allow_session_extend":true,"allow_homework_create":true,"allow_exam_push":true,"allow_recording":true}'])
ON CONFLICT (setting_key) DO NOTHING;
