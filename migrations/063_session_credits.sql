-- Migration 063: Session credits — track prepaid session balance per student per subject
-- When a student pays for enrollment (e.g. 50 sessions), credits are recorded here.
-- When AO generates invoices for scheduled sessions, credits are consumed first.

CREATE TABLE IF NOT EXISTS student_session_credits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email     TEXT NOT NULL REFERENCES portal_users(email),
  subject           TEXT NOT NULL,           -- e.g. 'Mathematics', 'Physics'
  batch_type        TEXT NOT NULL,           -- one_to_one, one_to_three, one_to_many, etc.

  -- Credit totals
  total_sessions    INT NOT NULL,            -- total sessions purchased (e.g. 50)
  used_sessions     INT NOT NULL DEFAULT 0,  -- sessions consumed by invoice generation
  remaining         INT GENERATED ALWAYS AS (total_sessions - used_sessions) STORED,

  -- Fee details (from enrollment_fee_structure at time of purchase)
  fee_per_session_paise INT NOT NULL,        -- per-session rate locked at purchase time
  currency          TEXT NOT NULL DEFAULT 'INR',

  -- Source tracking
  enrollment_link_id TEXT REFERENCES enrollment_links(id),
  invoice_id        UUID REFERENCES invoices(id),  -- the enrollment invoice that funded these credits
  source            TEXT NOT NULL DEFAULT 'enrollment',  -- enrollment | manual | top_up

  -- Lifecycle
  is_active         BOOL NOT NULL DEFAULT true,
  expires_at        TIMESTAMPTZ,              -- optional expiry date
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_session_credits_student ON student_session_credits(student_email, subject);
CREATE INDEX idx_session_credits_active ON student_session_credits(student_email) WHERE is_active = true AND (total_sessions - used_sessions) > 0;

-- Ledger: detailed log of every credit consumption
CREATE TABLE IF NOT EXISTS session_credit_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id         UUID NOT NULL REFERENCES student_session_credits(id),
  student_email     TEXT NOT NULL,
  subject           TEXT NOT NULL,
  sessions_consumed INT NOT NULL,            -- how many sessions consumed in this entry
  invoice_id        UUID REFERENCES invoices(id),          -- the invoice that was reduced/skipped
  schedule_group_id TEXT,                     -- schedule group that triggered this
  batch_session_ids TEXT[],                   -- individual session IDs covered
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_ledger_student ON session_credit_ledger(student_email);
CREATE INDEX idx_credit_ledger_credit ON session_credit_ledger(credit_id);

-- Add 'prepaid' to session_payments status check constraint
ALTER TABLE session_payments DROP CONSTRAINT IF EXISTS session_payments_status_check;
ALTER TABLE session_payments ADD CONSTRAINT session_payments_status_check
  CHECK (status = ANY (ARRAY['pending', 'paid', 'failed', 'refunded', 'cancelled', 'prepaid']));
