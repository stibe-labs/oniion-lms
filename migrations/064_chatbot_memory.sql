-- ═══════════════════════════════════════════════════════════════
-- Migration 064: Chatbot Memory Table
-- Persistent memory for Buji AI chatbot — stores learned facts,
-- preferences, and insights per student across conversations.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chatbot_memory (
  id            BIGSERIAL PRIMARY KEY,
  user_email    TEXT NOT NULL,
  key           TEXT NOT NULL,
  value         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_email, key)
);

CREATE INDEX IF NOT EXISTS idx_chatbot_memory_user
  ON chatbot_memory (user_email);

COMMENT ON TABLE chatbot_memory IS 'Persistent memory storage for the Buji AI chatbot. Stores per-student learned facts, preferences, and conversation insights.';
