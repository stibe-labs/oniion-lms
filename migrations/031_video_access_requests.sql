-- Migration 031: Video access request workflow
-- Students request access to session recordings, AO approves/rejects

CREATE TABLE IF NOT EXISTS video_access_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         TEXT NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  student_email   TEXT NOT NULL REFERENCES portal_users(email) ON DELETE CASCADE,
  reason          TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by     TEXT REFERENCES portal_users(email),
  review_notes    TEXT,
  recording_url   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ,
  UNIQUE(room_id, student_email)
);

CREATE INDEX IF NOT EXISTS idx_var_status ON video_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_var_student ON video_access_requests(student_email);
