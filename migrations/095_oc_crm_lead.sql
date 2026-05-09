-- ═══════════════════════════════════════════════════════════════
-- Migration 095: Open Classroom — CRM Lead Tracking
-- Adds CRM lead/tenant context to open_classrooms so that when
-- a CRM-linked guest joins, stibe can fire a webhook back to
-- the CRM to progress the lead stage automatically.
-- ═══════════════════════════════════════════════════════════════

-- CRM lead context on the open_classroom record
ALTER TABLE open_classrooms ADD COLUMN IF NOT EXISTS crm_lead_id     TEXT;
ALTER TABLE open_classrooms ADD COLUMN IF NOT EXISTS crm_tenant_id   TEXT;
ALTER TABLE open_classrooms ADD COLUMN IF NOT EXISTS crm_lead_phone  TEXT;
ALTER TABLE open_classrooms ADD COLUMN IF NOT EXISTS crm_lead_name   TEXT;

-- Webhook tracking: avoid duplicate fires
ALTER TABLE open_classrooms ADD COLUMN IF NOT EXISTS crm_guest_joined_at TIMESTAMPTZ;

-- Fast lookup by CRM lead
CREATE INDEX IF NOT EXISTS idx_oc_crm_lead
  ON open_classrooms (crm_lead_id)
  WHERE crm_lead_id IS NOT NULL;
