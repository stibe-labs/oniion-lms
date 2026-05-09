-- Migration 065: Add CRM sales agent support for demo sessions
-- Allows a CRM agent to join demo sessions alongside teacher and student.

-- Agent columns on demo_requests
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS agent_email TEXT;
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS agent_phone TEXT;
