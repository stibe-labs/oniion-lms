-- Add image_url column to session_exam_questions for QP page images
ALTER TABLE session_exam_questions ADD COLUMN IF NOT EXISTS image_url TEXT;
