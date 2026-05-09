-- ═══════════════════════════════════════════════════════════════
-- 082: AO Data Isolation — Track who created each user
-- Enables per-AO student isolation while CRM students remain shared
-- ═══════════════════════════════════════════════════════════════

-- Track which AO/admin created each user
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Index for fast lookups when filtering by creator
CREATE INDEX IF NOT EXISTS idx_portal_users_created_by ON portal_users(created_by) WHERE created_by IS NOT NULL;
