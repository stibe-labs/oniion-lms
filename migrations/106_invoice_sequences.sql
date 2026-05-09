-- Migration 106: Replace MAX-based invoice/receipt numbering with sequences
-- Prevents duplicate numbers when multiple invoices are generated in one transaction.

-- Invoice sequence — seed from current max
DO $$
DECLARE
  current_max INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0)
    INTO current_max
    FROM invoices;
  EXECUTE 'CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH ' || (current_max + 1);
END $$;

-- Receipt sequence — seed from current max
DO $$
DECLARE
  current_max INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM '[0-9]+$') AS INTEGER)), 0)
    INTO current_max
    FROM payment_receipts;
  EXECUTE 'CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START WITH ' || (current_max + 1);
END $$;
