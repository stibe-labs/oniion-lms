-- 037: Add heartbeat column for batch coordinator presence detection
-- The Live Monitor page pings a heartbeat so teachers can see if a BC is online
-- without the BC needing to be a LiveKit room participant.

ALTER TABLE portal_users
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ DEFAULT NULL;
