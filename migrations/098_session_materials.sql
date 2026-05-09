-- ── Session Materials ─────────────────────────────────────────────
-- Files uploaded by teachers during or after a live session,
-- accessible to enrolled students after the session ends.

CREATE TABLE IF NOT EXISTS session_materials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      TEXT NOT NULL REFERENCES batch_sessions(session_id) ON DELETE CASCADE,
  batch_id        TEXT REFERENCES batches(batch_id) ON DELETE SET NULL,
  uploaded_by     TEXT NOT NULL REFERENCES portal_users(email) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  file_type       TEXT NOT NULL DEFAULT 'document',  -- 'document' | 'image' | 'pdf' | 'video' | 'other'
  file_size_bytes BIGINT,
  title           TEXT,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_materials_session_id ON session_materials(session_id);
CREATE INDEX IF NOT EXISTS idx_session_materials_uploaded_by ON session_materials(uploaded_by);
