-- ============================================================
-- 067 — Conference feature
-- ============================================================

CREATE TABLE IF NOT EXISTS conferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  created_by TEXT NOT NULL,
  admin_token TEXT NOT NULL UNIQUE,
  user_token TEXT NOT NULL UNIQUE,
  livekit_room_name TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  max_participants INT DEFAULT 200,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS conference_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conf_admin_token ON conferences(admin_token);
CREATE INDEX IF NOT EXISTS idx_conf_user_token ON conferences(user_token);
CREATE INDEX IF NOT EXISTS idx_conf_participants ON conference_participants(conference_id);
CREATE INDEX IF NOT EXISTS idx_conf_created_by ON conferences(created_by);
