-- ────────────────────────────────────────────────────────────
-- 071 — Homework Assignment Attachments
-- Teachers can attach files (PDF, images, Excel, etc.) to homework
-- ────────────────────────────────────────────────────────────

ALTER TABLE homework_assignments
  ADD COLUMN IF NOT EXISTS attachment_urls  TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS attachment_names TEXT[] DEFAULT '{}';
