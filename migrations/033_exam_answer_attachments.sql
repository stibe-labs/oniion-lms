-- ═══════════════════════════════════════════════════════════════
-- Migration 033: Exam answer attachments
-- Adds attachment_url to exam_answers for descriptive exam file uploads
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE exam_answers ADD COLUMN IF NOT EXISTS attachment_url TEXT;
