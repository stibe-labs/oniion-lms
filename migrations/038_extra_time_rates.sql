-- Migration 038: Extra Time Fee Rates
-- Owner-configurable fee tiers for session extension requests (30/60/120 min)
-- These rates are used when students request extra time during live sessions.
-- Falls back to pro-rata session rate if no explicit extra time rate is configured.

CREATE TABLE IF NOT EXISTS extra_time_rates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duration_minutes INT NOT NULL CHECK (duration_minutes IN (30, 60, 120)),
  rate_paise       INT NOT NULL CHECK (rate_paise >= 0),
  currency         TEXT NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR','AED','SAR','QAR','KWD','OMR','BHD','USD')),
  label            TEXT,  -- e.g. "30 Minutes", "1 Hour", "2 Hours"
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one rate per duration per currency
CREATE UNIQUE INDEX IF NOT EXISTS idx_extra_time_rates_dur_cur
  ON extra_time_rates(duration_minutes, currency) WHERE is_active = true;
