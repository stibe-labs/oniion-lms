-- Migration: 008_end_session_events_and_go_live.sql
-- Fix: Add missing event types for end-session flow + go_live_at column
-- Date: 2026-02-28

-- 1. Drop the old CHECK constraint and recreate with all event types
ALTER TABLE room_events DROP CONSTRAINT IF EXISTS room_events_event_type_check;

ALTER TABLE room_events ADD CONSTRAINT room_events_event_type_check
  CHECK (event_type IN (
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
    -- New: end-session flow events
    'end_class_requested','end_class_approved','end_class_denied','room_ended_by_coordinator'
  ));

-- 2. Add go_live_at column to rooms table (safe: IF NOT EXISTS)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS go_live_at TIMESTAMPTZ DEFAULT NULL;
