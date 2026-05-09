-- Migration 075: Expand participant_type to include batch_coordinator + index join_token
-- Enables direct-join WhatsApp links for teachers, students, and batch coordinators

-- Expand CHECK to include batch_coordinator as a valid participant type
ALTER TABLE room_assignments DROP CONSTRAINT IF EXISTS room_assignments_participant_type_check;
ALTER TABLE room_assignments ADD CONSTRAINT room_assignments_participant_type_check
  CHECK (participant_type IN ('teacher', 'student', 'demo_agent', 'ghost', 'coordinator', 'batch_coordinator'));

-- Index for fast join_token lookups (used by /api/v1/room/join and /join/[room_id] page)
CREATE INDEX IF NOT EXISTS idx_room_assignments_join_token
  ON room_assignments(join_token) WHERE join_token IS NOT NULL;
