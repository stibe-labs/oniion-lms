-- 068: Add scheduling columns to conferences
ALTER TABLE conferences ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE conferences ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 60;
ALTER TABLE conferences ADD COLUMN IF NOT EXISTS conference_type TEXT DEFAULT 'instant';
