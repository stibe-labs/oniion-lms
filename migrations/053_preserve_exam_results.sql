-- Migration 053: Preserve exam results when topics are deleted
-- Problem: ON DELETE CASCADE on session_exam_results.topic_id was deleting
-- all student exam results when a teacher deleted questions/topics.
-- Fix: Change to SET NULL so results survive topic deletion.

-- 1. Make topic_id nullable (required for SET NULL)
ALTER TABLE session_exam_results ALTER COLUMN topic_id DROP NOT NULL;

-- 2. Drop the old CASCADE constraint
ALTER TABLE session_exam_results DROP CONSTRAINT session_exam_results_topic_id_fkey;

-- 3. Re-add with SET NULL
ALTER TABLE session_exam_results
  ADD CONSTRAINT session_exam_results_topic_id_fkey
  FOREIGN KEY (topic_id) REFERENCES session_exam_topics(id) ON DELETE SET NULL;
