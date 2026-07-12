-- Compatibility patch for tenant isolation fields on audio_record.
-- Fixes: QueryFailedError: column a.isolation_status does not exist

ALTER TABLE audio_record
  ADD COLUMN IF NOT EXISTS isolation_status varchar(32) NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS isolation_reason varchar(500) NULL;

COMMENT ON COLUMN audio_record.isolation_status IS 'Tenant isolation status';
COMMENT ON COLUMN audio_record.isolation_reason IS 'Tenant isolation exception reason';
