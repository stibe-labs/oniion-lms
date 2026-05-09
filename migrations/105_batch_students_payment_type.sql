-- Add payment_type to batch_students to track OTP vs SPO enrollment plan
-- Used by ManualEnrollModal and group batch invoice generation logic

ALTER TABLE batch_students
  ADD COLUMN IF NOT EXISTS payment_type varchar(10) DEFAULT 'otp';

COMMENT ON COLUMN batch_students.payment_type IS 'otp = one-time annual payment; spo = split payment option (quarterly)';
