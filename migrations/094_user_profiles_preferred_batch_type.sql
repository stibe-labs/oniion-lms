-- Migration 094: Add preferred_batch_type to user_profiles
-- Allows manual enrollment to record the student's preferred batch type,
-- so the Create Batch wizard can filter students by type.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS preferred_batch_type TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_preferred_batch_type
  ON user_profiles (preferred_batch_type)
  WHERE preferred_batch_type IS NOT NULL;
