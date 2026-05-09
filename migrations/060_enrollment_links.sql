-- Migration 060: Enrollment links for CRM-originated payment flow
-- Students who express interest after demo get a payment link from the CRM agent.

CREATE TABLE enrollment_links (
  id TEXT PRIMARY KEY,                          -- 10-char alphanumeric
  demo_request_id UUID REFERENCES demo_requests(id) ON DELETE SET NULL,
  crm_lead_id TEXT NOT NULL,
  crm_tenant_id TEXT NOT NULL,

  -- Student details (from CRM lead)
  student_name TEXT NOT NULL,
  student_email TEXT,
  student_phone TEXT NOT NULL,
  student_grade TEXT,

  -- Payment details (set when student submits subject selection)
  selected_subjects TEXT[] DEFAULT '{}',
  minimum_sessions INT DEFAULT 50,
  amount_paise INT,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,

  -- Status lifecycle: pending → subject_selected → paid → expired
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'subject_selected', 'paid', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_enrollment_links_crm_lead ON enrollment_links (crm_lead_id);
CREATE INDEX idx_enrollment_links_status ON enrollment_links (status);
