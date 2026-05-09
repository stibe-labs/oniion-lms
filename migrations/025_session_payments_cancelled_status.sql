-- Add 'cancelled' to session_payments status check constraint
ALTER TABLE session_payments DROP CONSTRAINT IF EXISTS session_payments_status_check;
ALTER TABLE session_payments ADD CONSTRAINT session_payments_status_check
  CHECK (status = ANY (ARRAY['pending', 'paid', 'failed', 'refunded', 'cancelled']));
