-- Migration 014: Demo Exam Results
-- Stores results of sample exams taken during demo sessions.
-- Lightweight: no exam_batch_assignments needed since demo exams are ad-hoc.

CREATE TABLE IF NOT EXISTS demo_exam_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_request_id   UUID NOT NULL REFERENCES demo_requests(id) ON DELETE CASCADE,
  room_id           TEXT REFERENCES rooms(room_id) ON DELETE SET NULL,

  -- Student info (denormalized from demo_requests for quick dashboard reads)
  student_email     TEXT NOT NULL,
  student_name      TEXT NOT NULL,
  student_phone     TEXT,
  student_grade     TEXT,

  -- Teacher info
  teacher_email     TEXT,
  teacher_name      TEXT,

  -- Exam details
  subject           TEXT NOT NULL,
  total_questions   INT NOT NULL DEFAULT 10,
  answered          INT NOT NULL DEFAULT 0,
  skipped           INT NOT NULL DEFAULT 0,
  score             INT NOT NULL DEFAULT 0,
  total_marks       INT NOT NULL DEFAULT 10,
  percentage        NUMERIC(5,2) NOT NULL DEFAULT 0,
  grade_letter      TEXT,
  time_taken_seconds INT,                               -- total exam time used

  -- Per-question answers (JSONB array for compact storage)
  -- Each: { question_text, options, correct_answer, selected_option, is_correct, marks, time_taken }
  answers           JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Tracking
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_demo_exam_demo_req ON demo_exam_results(demo_request_id);
CREATE INDEX IF NOT EXISTS idx_demo_exam_student ON demo_exam_results(student_email);
CREATE INDEX IF NOT EXISTS idx_demo_exam_teacher ON demo_exam_results(teacher_email);
CREATE INDEX IF NOT EXISTS idx_demo_exam_room ON demo_exam_results(room_id);

-- Add outcome column to demo_requests for tracking demo end reason
DO $$ BEGIN
  ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS outcome TEXT
    CHECK (outcome IN ('completed', 'completed_with_exam', 'student_no_show', 'cancelled_by_teacher', 'time_expired'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add exam_result_id column to demo_requests for quick lookup
DO $$ BEGIN
  ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS exam_result_id UUID REFERENCES demo_exam_results(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
