-- ═══════════════════════════════════════════════════════════════
-- Migration 041: Exam Topic Categorization
-- ═══════════════════════════════════════════════════════════════
-- Add board, category (question_paper/topic), paper_type,
-- chapter_name, and topic_name for structured exam uploads.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE session_exam_topics ADD COLUMN IF NOT EXISTS board TEXT;
ALTER TABLE session_exam_topics ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'question_paper'
  CHECK (category IN ('question_paper', 'topic'));
ALTER TABLE session_exam_topics ADD COLUMN IF NOT EXISTS paper_type TEXT;
ALTER TABLE session_exam_topics ADD COLUMN IF NOT EXISTS chapter_name TEXT;
ALTER TABLE session_exam_topics ADD COLUMN IF NOT EXISTS topic_name TEXT;
