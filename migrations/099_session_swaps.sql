-- Migration 099: Session swap audit log
-- Allows AO/BC to interchange two scheduled sessions (subject + teacher + topic)
-- when a teacher becomes unavailable, with an audit trail and remarks.

CREATE TABLE IF NOT EXISTS session_swaps (
  swap_id          TEXT PRIMARY KEY DEFAULT ('swap_' || substr(gen_random_uuid()::text, 1, 12)),
  session_a_id     TEXT NOT NULL REFERENCES batch_sessions(session_id) ON DELETE CASCADE,
  session_b_id     TEXT NOT NULL REFERENCES batch_sessions(session_id) ON DELETE CASCADE,
  batch_id         TEXT NOT NULL REFERENCES batches(batch_id) ON DELETE CASCADE,
  -- Snapshot of pre-swap state for forensic / undo
  a_subject_before     TEXT,
  a_teacher_email_before TEXT,
  a_teacher_name_before  TEXT,
  a_topic_before         TEXT,
  b_subject_before     TEXT,
  b_teacher_email_before TEXT,
  b_teacher_name_before  TEXT,
  b_topic_before         TEXT,
  reason           TEXT,
  remarks          TEXT,
  swapped_by       TEXT NOT NULL,
  swapped_by_role  TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_swaps_batch ON session_swaps(batch_id);
CREATE INDEX IF NOT EXISTS idx_session_swaps_session_a ON session_swaps(session_a_id);
CREATE INDEX IF NOT EXISTS idx_session_swaps_session_b ON session_swaps(session_b_id);
CREATE INDEX IF NOT EXISTS idx_session_swaps_created ON session_swaps(created_at DESC);
