-- Add subject and grade columns to open_classrooms for exam generation support
ALTER TABLE open_classrooms ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE open_classrooms ADD COLUMN IF NOT EXISTS grade TEXT;
