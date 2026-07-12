-- Optional compatibility patch for tenant-care audio attribution.
-- Current code no longer requires this column for listing or report generation.
-- Run this only if you want to keep tenant caregiver attribution directly on audio_record.

ALTER TABLE audio_record
  ADD COLUMN IF NOT EXISTS tenant_caregiver_id integer NULL;

COMMENT ON COLUMN audio_record.tenant_caregiver_id IS '租户护工ID';
