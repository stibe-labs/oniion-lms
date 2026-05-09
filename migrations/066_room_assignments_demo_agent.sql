-- Migration 066: Allow demo_agent participant type in room_assignments
-- 065 added agent columns to demo_requests but missed the CHECK constraint.

ALTER TABLE room_assignments DROP CONSTRAINT IF EXISTS room_assignments_participant_type_check;
ALTER TABLE room_assignments ADD CONSTRAINT room_assignments_participant_type_check
  CHECK (participant_type IN ('teacher', 'student', 'demo_agent', 'ghost', 'coordinator'));
