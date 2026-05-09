-- Add student_address and student_category to enrollment_links
ALTER TABLE enrollment_links ADD COLUMN IF NOT EXISTS student_address TEXT;
ALTER TABLE enrollment_links ADD COLUMN IF NOT EXISTS student_category TEXT;
