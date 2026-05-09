-- Migration 086: Teacher app APK release management
-- Allows Academic Operators / Owners to upload versioned Android APKs
-- for the stibe Teacher screen-sharing app.

CREATE TABLE IF NOT EXISTS teacher_app_releases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform        TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('android')),
  version_name    TEXT NOT NULL,
  version_code    INT NOT NULL CHECK (version_code > 0),
  file_url        TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_size       BIGINT NOT NULL DEFAULT 0,
  mime_type       TEXT,
  release_notes   TEXT,
  uploaded_by     TEXT NOT NULL,
  is_latest       BOOLEAN NOT NULL DEFAULT FALSE,
  is_force_update BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_app_releases_latest
  ON teacher_app_releases (platform, is_latest, is_active, version_code DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_app_releases_version_code
  ON teacher_app_releases (platform, version_code DESC);

DROP TRIGGER IF EXISTS trg_teacher_app_releases_updated_at ON teacher_app_releases;
CREATE TRIGGER trg_teacher_app_releases_updated_at
BEFORE UPDATE ON teacher_app_releases
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
