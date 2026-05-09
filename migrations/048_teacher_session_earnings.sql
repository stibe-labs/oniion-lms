-- Migration 048: Per-session earnings tracking
-- Auto-records teacher pay after each live session ends

CREATE TABLE IF NOT EXISTS teacher_session_earnings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         TEXT NOT NULL REFERENCES rooms(room_id),
  batch_session_id TEXT,
  teacher_email   TEXT NOT NULL,
  batch_id        TEXT,
  subject         TEXT,
  scheduled_date  DATE,
  duration_minutes INT NOT NULL DEFAULT 0,
  actual_minutes  INT NOT NULL DEFAULT 0,
  rate_per_class  INT NOT NULL DEFAULT 0,
  base_paise      INT NOT NULL DEFAULT 0,
  extension_minutes INT NOT NULL DEFAULT 0,
  extension_paise INT NOT NULL DEFAULT 0,
  total_paise     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id)
);

CREATE INDEX IF NOT EXISTS idx_tse_teacher_email ON teacher_session_earnings(teacher_email);
CREATE INDEX IF NOT EXISTS idx_tse_scheduled_date ON teacher_session_earnings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tse_teacher_month ON teacher_session_earnings(teacher_email, scheduled_date);
