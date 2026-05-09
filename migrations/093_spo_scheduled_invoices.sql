-- ═══════════════════════════════════════════════════════════════════════
-- Migration 093: SPO scheduled invoices + per-class top-up support
-- Adds columns to invoices for:
--   • enrollment_link_id  — links invoice to enrollment
--   • installment_number  — Q1=1, Q2=2, Q3=3, Q4=4, NULL=non-SPO
--   • scheduled_for       — date when invoice should be activated (NULL=immediate)
--   • is_topup            — TRUE for per-class credit replenishment invoices
--   • topup_sessions      — number of sessions covered by top-up
-- Extends invoices.status to include 'scheduled'
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS enrollment_link_id TEXT,
  ADD COLUMN IF NOT EXISTS installment_number  INT,
  ADD COLUMN IF NOT EXISTS scheduled_for       DATE,
  ADD COLUMN IF NOT EXISTS is_topup            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS topup_sessions      INT;

-- Extend status enum to allow 'scheduled'
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'scheduled'));

-- Fast lookup for cron: scheduled invoices coming due
CREATE INDEX IF NOT EXISTS idx_invoices_scheduled_for
  ON invoices(scheduled_for, status)
  WHERE status = 'scheduled';

-- Lookup all installments for a given enrollment
CREATE INDEX IF NOT EXISTS idx_invoices_enrollment_link
  ON invoices(enrollment_link_id)
  WHERE enrollment_link_id IS NOT NULL;

-- Lookup top-up invoices per student
CREATE INDEX IF NOT EXISTS idx_invoices_topup
  ON invoices(student_email, is_topup)
  WHERE is_topup = TRUE;
