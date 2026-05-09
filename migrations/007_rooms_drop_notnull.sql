-- Migration 007: Drop NOT NULL from optional rooms columns
-- coordinator_email, open_at, expires_at should all be nullable
-- (grade and subject already fixed in migration 006)
ALTER TABLE rooms ALTER COLUMN coordinator_email DROP NOT NULL;
ALTER TABLE rooms ALTER COLUMN open_at DROP NOT NULL;
ALTER TABLE rooms ALTER COLUMN expires_at DROP NOT NULL;
