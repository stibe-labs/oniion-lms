-- ═══════════════════════════════════════════════════════════════
-- Migration 028: Session Exam Topics (AI-Generated Daily Exams)
-- ═══════════════════════════════════════════════════════════════
-- AO uploads topic PDFs → AI generates 20 MCQs → Teachers start
-- exams in live sessions → Students take timed MCQs → Results + reports
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Exam Topics (uploaded by Academic Operators) ──────────
CREATE TABLE IF NOT EXISTS session_exam_topics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  subject           TEXT NOT NULL,
  grade             TEXT NOT NULL,
  topic_description TEXT,
  pdf_url           TEXT,
  pdf_filename      TEXT,
  question_count    INT NOT NULL DEFAULT 20,
  status            TEXT NOT NULL DEFAULT 'generating'
                    CHECK (status IN ('generating','ready','failed','archived')),
  error_message     TEXT,
  uploaded_by       TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. AI-Generated Questions (linked to topics) ────────────
CREATE TABLE IF NOT EXISTS session_exam_questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id       UUID NOT NULL REFERENCES session_exam_topics(id) ON DELETE CASCADE,
  question_text  TEXT NOT NULL,
  options        TEXT[] NOT NULL,
  correct_answer INT NOT NULL,
  marks          INT NOT NULL DEFAULT 1,
  difficulty     TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  sort_order     INT DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Student Exam Results ─────────────────────────────────
CREATE TABLE IF NOT EXISTS session_exam_results (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id           UUID NOT NULL REFERENCES session_exam_topics(id) ON DELETE CASCADE,
  session_id         TEXT REFERENCES batch_sessions(session_id) ON DELETE SET NULL,
  room_id            TEXT REFERENCES rooms(room_id) ON DELETE SET NULL,

  student_email      TEXT NOT NULL,
  student_name       TEXT NOT NULL,
  student_grade      TEXT,
  parent_email       TEXT,

  teacher_email      TEXT,
  teacher_name       TEXT,

  subject            TEXT NOT NULL,
  topic_title        TEXT NOT NULL,
  total_questions    INT NOT NULL DEFAULT 20,
  answered           INT NOT NULL DEFAULT 0,
  skipped            INT NOT NULL DEFAULT 0,
  score              INT NOT NULL DEFAULT 0,
  total_marks        INT NOT NULL DEFAULT 20,
  percentage         NUMERIC(5,2) NOT NULL DEFAULT 0,
  grade_letter       TEXT,
  time_taken_seconds INT,

  answers            JSONB NOT NULL DEFAULT '[]'::jsonb,

  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topic_id, session_id, student_email)
);

-- ── 4. Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_set_subject_grade  ON session_exam_topics(subject, grade);
CREATE INDEX IF NOT EXISTS idx_set_status         ON session_exam_topics(status);
CREATE INDEX IF NOT EXISTS idx_set_uploaded_by    ON session_exam_topics(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_seq_topic          ON session_exam_questions(topic_id);

CREATE INDEX IF NOT EXISTS idx_ser_topic          ON session_exam_results(topic_id);
CREATE INDEX IF NOT EXISTS idx_ser_student        ON session_exam_results(student_email);
CREATE INDEX IF NOT EXISTS idx_ser_session        ON session_exam_results(session_id);
CREATE INDEX IF NOT EXISTS idx_ser_room           ON session_exam_results(room_id);
