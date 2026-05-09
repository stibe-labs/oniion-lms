-- Migration 055: Add bank/UPI details to session_refund_requests
-- For students to provide refund payment details when requesting refunds

ALTER TABLE session_refund_requests
  ADD COLUMN IF NOT EXISTS account_holder_name TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS ifsc_code TEXT,
  ADD COLUMN IF NOT EXISTS upi_id TEXT,
  ADD COLUMN IF NOT EXISTS qr_code_url TEXT;
