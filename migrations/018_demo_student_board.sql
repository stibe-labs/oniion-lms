-- Migration 018: Add student_board to demo_requests
-- Stores the board selected by the student during demo registration,
-- so it can be pre-filled when converting the lead to a student account.

ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS student_board TEXT;
