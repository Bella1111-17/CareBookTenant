-- ToB tenant platform cleanup precheck.
-- Run this against the imported NEW database only, never against the original production database.

CREATE TEMP TABLE IF NOT EXISTS tob_cleanup_target_table (
  table_name text PRIMARY KEY
) ON COMMIT DROP;

TRUNCATE tob_cleanup_target_table;

INSERT INTO tob_cleanup_target_table (table_name) VALUES
  ('payment_refund_order'),
  ('payment_order'),
  ('care_daily_report'),
  ('care_relation'),
  ('care_offline_order'),
  ('care_online_order'),
  ('care_address'),
  ('care_recipient'),
  ('care_service_item'),
  ('care_service_category'),
  ('care_offline_source_org'),
  ('caregiver_profile')
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE IF NOT EXISTS tob_cleanup_precheck_result (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL
) ON COMMIT DROP;

TRUNCATE tob_cleanup_precheck_result;

DO $$
DECLARE
  target record;
  rows_count bigint;
BEGIN
  FOR target IN SELECT table_name FROM tob_cleanup_target_table ORDER BY table_name LOOP
    IF to_regclass(format('public.%I', target.table_name)) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', target.table_name) INTO rows_count;
      INSERT INTO tob_cleanup_precheck_result(table_name, row_count)
      VALUES (target.table_name, rows_count);
    ELSE
      INSERT INTO tob_cleanup_precheck_result(table_name, row_count)
      VALUES (target.table_name || ' (missing)', 0);
    END IF;
  END LOOP;
END $$;

SELECT table_name, row_count
FROM tob_cleanup_precheck_result
ORDER BY table_name;

SELECT count(*) AS obsolete_menu_count
FROM sys_menu
WHERE perms LIKE 'care:%'
   OR perms LIKE 'payment:%'
   OR perms LIKE 'wechat:%'
   OR perms LIKE 'system:caregiver:%'
   OR component LIKE 'care/%'
   OR component LIKE 'payment/%'
   OR component LIKE 'wechat/%'
   OR component LIKE 'system/caregiver/%'
   OR path IN ('care', 'payment', 'wechat', 'dashboard');

SELECT count(*) AS tob_kept_business_rows
FROM (
  SELECT 'badge_device' AS table_name, count(*) AS row_count FROM badge_device
  UNION ALL SELECT 'device_user_binding', count(*) FROM device_user_binding
  UNION ALL SELECT 'audio_record', count(*) FROM audio_record
  UNION ALL SELECT 'device_event_log', count(*) FROM device_event_log
  UNION ALL SELECT 'device_gps_log', count(*) FROM device_gps_log
  UNION ALL SELECT 'nurse_daily_report', count(*) FROM nurse_daily_report
  UNION ALL SELECT 'tenant_org_unit', count(*) FROM tenant_org_unit
  UNION ALL SELECT 'tenant_caregiver', count(*) FROM tenant_caregiver
  UNION ALL SELECT 'tenant_badge_binding', count(*) FROM tenant_badge_binding
  UNION ALL SELECT 'tenant_daily_report', count(*) FROM tenant_daily_report
) kept;

