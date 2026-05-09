-- 054: Session refund/reschedule requests for absent students with paid invoices
-- When a student is absent from a paid session, they can request refund or reschedule.
-- The AO reviews and approves/rejects from the payments tab.

CREATE TABLE IF NOT EXISTS session_refund_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email   TEXT NOT NULL,
  batch_session_id TEXT NOT NULL,
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  session_payment_id UUID REFERENCES session_payments(id) ON DELETE SET NULL,
  request_type    TEXT NOT NULL CHECK (request_type IN ('refund', 'reschedule')),
  amount_paise    INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'INR',
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_session_id, student_email)
);

CREATE INDEX IF NOT EXISTS idx_srr_student ON session_refund_requests(student_email);
CREATE INDEX IF NOT EXISTS idx_srr_status ON session_refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_srr_invoice ON session_refund_requests(invoice_id);
