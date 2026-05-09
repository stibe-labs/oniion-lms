-- ═══════════════════════════════════════════════════════════════
-- Migration 040: Exam Topic Files
-- ═══════════════════════════════════════════════════════════════
-- Support multiple question files per exam topic (any file type).
-- Replaces single pdf_url/pdf_filename on session_exam_topics.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS exam_topic_files (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id   UUID NOT NULL REFERENCES session_exam_topics(id) ON DELETE CASCADE,
  file_url   TEXT NOT NULL,
  file_name  TEXT NOT NULL,
  file_size  INT NOT NULL DEFAULT 0,
  mime_type  TEXT NOT NULL DEFAULT 'application/octet-stream',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etf_topic ON exam_topic_files(topic_id);

-- Change default status from 'generating' to 'ready' (no more AI auto-gen)
ALTER TABLE session_exam_topics ALTER COLUMN status SET DEFAULT 'ready';
