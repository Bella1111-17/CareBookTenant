-- Tenant-care GPS and device event isolation migration.
-- Scope: tenant -> device -> GPS/event, tenant -> caregiver/staff -> device.
-- Do not add elder/care receiver fields and do not backfill from elder relations.
-- Safe to run repeatedly on PostgreSQL.

BEGIN;

ALTER TABLE badge_device
  ADD COLUMN IF NOT EXISTS tenant_id varchar(64);

ALTER TABLE device_gps_log
  ADD COLUMN IF NOT EXISTS tenant_id varchar(64);

ALTER TABLE device_gps_log
  ADD COLUMN IF NOT EXISTS user_id integer NULL;

ALTER TABLE device_event_log
  ADD COLUMN IF NOT EXISTS tenant_id varchar(64);

ALTER TABLE device_event_log
  ADD COLUMN IF NOT EXISTS user_id integer NULL;

ALTER TABLE tenant_badge_binding
  ADD COLUMN IF NOT EXISTS tenant_id varchar(64);

-- Backfill GPS/event tenant_id only from device ownership.
-- Rows whose device cannot be matched remain nullable and must be handled by the exception check below.
UPDATE device_gps_log g
SET tenant_id = d.tenant_id
FROM badge_device d
WHERE g.device_no = d.device_no
  AND d.tenant_id IS NOT NULL
  AND (g.tenant_id IS NULL OR g.tenant_id <> d.tenant_id);

UPDATE device_event_log e
SET tenant_id = d.tenant_id
FROM badge_device d
WHERE e.device_no = d.device_no
  AND d.tenant_id IS NOT NULL
  AND (e.tenant_id IS NULL OR e.tenant_id <> d.tenant_id);

-- Compatibility for databases imported from older/camelCase schemas.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'device_gps_log'
      AND column_name = 'userId'
  ) THEN
    EXECUTE 'UPDATE device_gps_log SET user_id = "userId" WHERE user_id IS NULL AND "userId" IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'device_event_log'
      AND column_name = 'userId'
  ) THEN
    EXECUTE 'UPDATE device_event_log SET user_id = "userId" WHERE user_id IS NULL AND "userId" IS NOT NULL';
  END IF;
END $$;

-- Keep binding tenant_id aligned with the owned device and tenant caregiver.
-- This only fills missing tenant_id when both sides agree or one side is available.
UPDATE tenant_badge_binding b
SET tenant_id = COALESCE(c.tenant_id, d.tenant_id)
FROM badge_device d
LEFT JOIN tenant_caregiver c ON c.id = b.tenant_caregiver_id AND c.del_flag = '0'
WHERE b.device_no = d.device_no
  AND COALESCE(c.tenant_id, d.tenant_id) IS NOT NULL
  AND (b.tenant_id IS NULL OR b.tenant_id = '' OR b.tenant_id = COALESCE(c.tenant_id, d.tenant_id));

-- Indexes for the first-stage tenant platform access paths.
CREATE INDEX IF NOT EXISTS idx_badge_device_tenant_device_no
  ON badge_device (tenant_id, device_no)
  WHERE del_flag = '0';

CREATE INDEX IF NOT EXISTS idx_device_gps_tenant_device_report
  ON device_gps_log (tenant_id, device_no, report_time DESC)
  WHERE del_flag = '0';

CREATE INDEX IF NOT EXISTS idx_device_gps_device_report
  ON device_gps_log (device_no, report_time DESC)
  WHERE del_flag = '0';

CREATE INDEX IF NOT EXISTS idx_device_gps_user_created
  ON device_gps_log (user_id, created_at DESC)
  WHERE del_flag = '0';

CREATE INDEX IF NOT EXISTS idx_device_event_tenant_device_created
  ON device_event_log (tenant_id, device_no, created_at DESC)
  WHERE del_flag = '0';

CREATE INDEX IF NOT EXISTS idx_device_event_tenant_type_created
  ON device_event_log (tenant_id, event_type, created_at DESC)
  WHERE del_flag = '0';

CREATE INDEX IF NOT EXISTS idx_device_event_user_created
  ON device_event_log (user_id, created_at DESC)
  WHERE del_flag = '0';

CREATE INDEX IF NOT EXISTS idx_tenant_badge_binding_tenant_caregiver_device
  ON tenant_badge_binding (tenant_id, tenant_caregiver_id, device_no)
  WHERE del_flag = '0';

CREATE INDEX IF NOT EXISTS idx_tenant_badge_binding_tenant_device_current
  ON tenant_badge_binding (tenant_id, device_no, unbind_at)
  WHERE del_flag = '0';

COMMIT;

-- Exception checks: these rows must not be exposed as ordinary tenant data.
-- Handle them by fixing device ownership, moving to a quarantine table, or deleting only after business approval.
SELECT g.id, g.device_no, g.created_at
FROM device_gps_log g
LEFT JOIN badge_device d ON d.device_no = g.device_no
WHERE g.del_flag = '0'
  AND (d.id IS NULL OR d.tenant_id IS NULL OR g.tenant_id IS NULL)
ORDER BY g.id
LIMIT 200;

SELECT e.id, e.device_no, e.event_type, e.created_at
FROM device_event_log e
LEFT JOIN badge_device d ON d.device_no = e.device_no
WHERE e.del_flag = '0'
  AND (d.id IS NULL OR d.tenant_id IS NULL OR e.tenant_id IS NULL)
ORDER BY e.id
LIMIT 200;

SELECT b.id, b.tenant_id, b.tenant_caregiver_id, b.device_no
FROM tenant_badge_binding b
LEFT JOIN tenant_caregiver c ON c.id = b.tenant_caregiver_id AND c.del_flag = '0'
LEFT JOIN badge_device d ON d.device_no = b.device_no AND d.del_flag = '0'
WHERE b.del_flag = '0'
  AND (
    b.tenant_id IS NULL
    OR c.id IS NULL
    OR d.id IS NULL
    OR c.tenant_id <> b.tenant_id
    OR d.tenant_id <> b.tenant_id
  )
ORDER BY b.id
LIMIT 200;

-- Rollback notes:
-- 1. Drop the indexes above if the migration must be reverted.
-- 2. Do not blindly drop tenant_id columns after data backfill; they may already be used by application code.
-- 3. If rollback is required before code deploy, restore reads to the previous /hardware/badge endpoints.
