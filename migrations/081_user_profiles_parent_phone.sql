-- Add parent_phone column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS parent_phone TEXT;
