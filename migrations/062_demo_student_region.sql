-- Migration 062: Add student_region to demo_requests
-- Align demo registration with enrollment fee structure (region/board/grade)

ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS student_region TEXT;
