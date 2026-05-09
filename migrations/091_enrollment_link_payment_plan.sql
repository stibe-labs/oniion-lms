-- Migration 091: Add payment_plan to enrollment_links
-- Stores whether the student enrolled on OTP (one-time) or quarterly installment plan.
-- Set by CRM when creating the enrollment link.

ALTER TABLE enrollment_links
  ADD COLUMN IF NOT EXISTS payment_plan TEXT NOT NULL DEFAULT 'otp'
  CHECK (payment_plan IN ('otp', 'quarterly'));

COMMENT ON COLUMN enrollment_links.payment_plan IS
  'otp = one-time full payment; quarterly = 3-month installment plan with recurring gate.';

-- When student completes enrollment via this link and is added to batch_students,
-- the quarterly_due_date should be set if payment_plan = ''quarterly''.
-- That logic is handled in the enrollment completion handler.
