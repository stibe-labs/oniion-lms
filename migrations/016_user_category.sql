-- 016: Add category column to user_profiles (A/B/C student categorization, also used for teachers)
-- Runs on: stibe_portal DB via ssh stibe-portal

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS category TEXT
    CHECK (category IN ('A', 'B', 'C'));

-- Index for filtering by category
CREATE INDEX IF NOT EXISTS idx_user_profiles_category ON user_profiles (category) WHERE category IS NOT NULL;
