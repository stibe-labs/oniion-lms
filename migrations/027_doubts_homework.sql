-- ────────────────────────────────────────────────────────────
-- 027 — Session Doubts + Homework Assignments
-- ────────────────────────────────────────────────────────────

-- ── Session Doubts ───────────────────────────────────────────
-- Students raise doubts during live sessions. Teachers answer them.
CREATE TABLE IF NOT EXISTS session_doubts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         TEXT NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  batch_id        TEXT,
  student_email   TEXT NOT NULL,
  student_name    TEXT NOT NULL DEFAULT '',
  subject         TEXT,
  doubt_text      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'answered', 'deferred', 'closed')),
  teacher_reply   TEXT,
  replied_by      TEXT,
  replied_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_doubts_room     ON session_doubts (room_id);
CREATE INDEX idx_session_doubts_student  ON session_doubts (student_email);
CREATE INDEX idx_session_doubts_status   ON session_doubts (status) WHERE status = 'open';

-- ── Homework Assignments ─────────────────────────────────────
-- Teachers assign homework during or after sessions.
CREATE TABLE IF NOT EXISTS homework_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         TEXT REFERENCES rooms(room_id) ON DELETE SET NULL,
  batch_id        TEXT NOT NULL,
  subject         TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  due_date        DATE,
  assigned_by     TEXT NOT NULL,
  assigned_by_name TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'closed', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_homework_batch      ON homework_assignments (batch_id);
CREATE INDEX idx_homework_room       ON homework_assignments (room_id) WHERE room_id IS NOT NULL;
CREATE INDEX idx_homework_due        ON homework_assignments (due_date) WHERE status = 'active';

-- ── Homework Submissions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS homework_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id     UUID NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
  student_email   TEXT NOT NULL,
  student_name    TEXT NOT NULL DEFAULT '',
  submission_text TEXT,
  file_url        TEXT,
  file_name       TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  grade           TEXT,
  teacher_comment TEXT,
  graded_by       TEXT,
  graded_at       TIMESTAMPTZ,
  UNIQUE (homework_id, student_email)
);

CREATE INDEX idx_hw_sub_homework ON homework_submissions (homework_id);
CREATE INDEX idx_hw_sub_student  ON homework_submissions (student_email);
