-- Migration 042: Add generation_progress to session_exam_topics
-- Tracks current stage of AI question generation for UI progress display
ALTER TABLE session_exam_topics
  ADD COLUMN IF NOT EXISTS generation_progress TEXT DEFAULT NULL;

-- Values: 'extracting' | 'building_prompt' | 'generating_ai' | 'parsing' | 'saving' | NULL (idle)
