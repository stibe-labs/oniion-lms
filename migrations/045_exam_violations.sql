-- Migration 045: Add anti-cheat violation tracking to session_exam_results
-- Stores tab switch count, auto-submit flag, and detailed violation log

ALTER TABLE session_exam_results ADD COLUMN IF NOT EXISTS violations JSONB;
ALTER TABLE session_exam_results ADD COLUMN IF NOT EXISTS tab_switch_count INT DEFAULT 0;
ALTER TABLE session_exam_results ADD COLUMN IF NOT EXISTS auto_submitted BOOLEAN DEFAULT FALSE;
