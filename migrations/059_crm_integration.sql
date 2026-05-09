-- ═══════════════════════════════════════════════════════════════
-- Migration 059: CRM Integration
-- Adds CRM tracking columns to demo_requests for Stibe CRM webhook callbacks.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Add CRM tracking columns to demo_requests ────────────

ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS crm_lead_id TEXT;
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS crm_tenant_id TEXT;

-- Index for reverse lookups (stibe needs to find demo_request by crm_lead_id)
CREATE INDEX IF NOT EXISTS idx_demo_requests_crm_lead
  ON demo_requests (crm_lead_id)
  WHERE crm_lead_id IS NOT NULL;

-- ── 2. Add interest field to demo feedback ──────────────────
-- Track student interest response after demo completion

ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS student_interest BOOLEAN;
