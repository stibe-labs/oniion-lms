-- Migration 073: Allow internal enrollment links (not just CRM-originated)
-- AO can create enrollment links directly from the portal dashboard.

ALTER TABLE enrollment_links
  ALTER COLUMN crm_lead_id DROP NOT NULL,
  ALTER COLUMN crm_tenant_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES portal_users(email) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'crm' CHECK (source IN ('crm', 'portal'));
