-- Add external_id column to notification_log for WhatsApp message IDs
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS external_id TEXT;
