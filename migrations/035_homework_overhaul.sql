-- ────────────────────────────────────────────────────────────
-- 035 — Homework Overhaul: Questions, File Uploads, Status Tracking
-- ────────────────────────────────────────────────────────────

-- ── Homework Questions (numbered questions per assignment) ──
CREATE TABLE IF NOT EXISTS homework_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id     UUID NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
  question_number INT NOT NULL,
  question_text   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (homework_id, question_number)
);

CREATE INDEX idx_hw_questions_homework ON homework_questions (homework_id);

-- ── Extend homework_submissions with file uploads + completion status ──
ALTER TABLE homework_submissions
  ADD COLUMN IF NOT EXISTS completion_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (completion_status IN ('completed', 'partial', 'not_started')),
  ADD COLUMN IF NOT EXISTS file_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS file_names TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS delay_days INT DEFAULT 0;

-- ── Extend homework_assignments with due time (not just date) ──
ALTER TABLE homework_assignments
  ADD COLUMN IF NOT EXISTS due_time TIME DEFAULT NULL;
