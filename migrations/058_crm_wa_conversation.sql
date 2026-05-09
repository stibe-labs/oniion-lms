-- ═══════════════════════════════════════════════════════════════
-- Migration 058: Add wa_conversation_id for WhatsApp lead dedup
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS wa_conversation_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_leads_wa_conversation
  ON crm_leads (wa_conversation_id)
  WHERE wa_conversation_id IS NOT NULL;
