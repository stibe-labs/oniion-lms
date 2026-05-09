-- Add solution_steps column for caching AI-generated step-by-step solutions
ALTER TABLE session_exam_questions ADD COLUMN IF NOT EXISTS solution_steps TEXT;
