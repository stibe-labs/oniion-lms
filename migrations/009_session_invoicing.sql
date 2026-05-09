-- ═══════════════════════════════════════════════════════════════
-- Migration 009: Per-Session Invoicing Support
-- Adds batch_session_id to session_payments and invoices
-- so invoices can be generated at schedule time (before rooms exist).
-- ═══════════════════════════════════════════════════════════════

-- 1. Add batch_session_id to session_payments
ALTER TABLE session_payments ADD COLUMN IF NOT EXISTS batch_session_id TEXT;

-- 2. Make room_id nullable (invoices created before room exists)
ALTER TABLE session_payments ALTER COLUMN room_id DROP NOT NULL;

-- 3. Add unique constraint for batch_session_id + student_email
--    (only one payment per student per scheduled session)
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_payments_batch_student
  ON session_payments (batch_session_id, student_email)
  WHERE batch_session_id IS NOT NULL;

-- 4. Add batch_session_id to invoices for direct linking
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS batch_session_id TEXT;

-- 5. Index for quick invoice lookup by batch_session_id
CREATE INDEX IF NOT EXISTS idx_invoices_batch_session_id
  ON invoices (batch_session_id)
  WHERE batch_session_id IS NOT NULL;

-- 6. Index for quick session_payments lookup by batch_session_id
CREATE INDEX IF NOT EXISTS idx_session_payments_batch_session_id
  ON session_payments (batch_session_id)
  WHERE batch_session_id IS NOT NULL;
