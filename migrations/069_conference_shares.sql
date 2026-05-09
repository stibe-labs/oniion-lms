-- Track conference link recipients for change notifications
CREATE TABLE IF NOT EXISTS conference_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  link_type TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user'
  shared_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conf_shares_conf ON conference_shares(conference_id);

-- Add cancelled status support
ALTER TABLE conferences ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
