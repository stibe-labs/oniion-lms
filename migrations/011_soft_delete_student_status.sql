-- ═══════════════════════════════════════════════════════════════
-- Migration 011: Soft-delete invoices + Student batch status
-- Date: 2026-03-04
-- ═══════════════════════════════════════════════════════════════

-- 1. Soft-delete: hide invoices from owner without destroying student/parent records
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hidden_from_owner BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_hidden ON invoices (hidden_from_owner) WHERE hidden_from_owner = FALSE;

-- 2. Student batch status: track discontinue / break / rejoin
ALTER TABLE batch_students ADD COLUMN IF NOT EXISTS student_status TEXT NOT NULL DEFAULT 'active'
  CHECK (student_status IN ('active','discontinued','on_break','rejoined'));
ALTER TABLE batch_students ADD COLUMN IF NOT EXISTS discontinued_at TIMESTAMPTZ;
ALTER TABLE batch_students ADD COLUMN IF NOT EXISTS rejoined_at TIMESTAMPTZ;
ALTER TABLE batch_students ADD COLUMN IF NOT EXISTS status_note TEXT;

CREATE INDEX IF NOT EXISTS idx_batch_students_status ON batch_students (student_status);
