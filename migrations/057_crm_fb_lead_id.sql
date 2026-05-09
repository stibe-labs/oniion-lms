-- ═══════════════════════════════════════════════════════════════
-- Migration 057: Add fb_lead_id for Facebook lead deduplication
-- and campaign_name for human-readable campaign tracking
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS fb_lead_id TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS campaign_name TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_leads_fb_lead_id
  ON crm_leads (fb_lead_id)
  WHERE fb_lead_id IS NOT NULL;
