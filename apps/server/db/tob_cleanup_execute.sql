-- ToB tenant platform cleanup execution.
-- REQUIRED: backup carebook_tob_admin before running this file.
-- This script removes self-operated CareBook business data and stale menus from the imported NEW database.

BEGIN;

CREATE TEMP TABLE tob_cleanup_target_table (
  table_name text PRIMARY KEY,
  delete_order int NOT NULL
) ON COMMIT DROP;

INSERT INTO tob_cleanup_target_table (table_name, delete_order) VALUES
  ('payment_refund_order', 10),
  ('payment_order', 20),
  ('care_daily_report', 30),
  ('care_relation', 40),
  ('care_offline_order', 50),
  ('care_online_order', 60),
  ('care_address', 70),
  ('care_recipient', 80),
  ('care_service_item', 90),
  ('care_service_category', 100),
  ('care_offline_source_org', 110),
  ('caregiver_profile', 120),
  ('sys_carousel', 130);

CREATE TEMP TABLE tob_cleanup_before (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  target record;
  rows_count bigint;
BEGIN
  FOR target IN SELECT table_name FROM tob_cleanup_target_table ORDER BY delete_order LOOP
    IF to_regclass(format('public.%I', target.table_name)) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', target.table_name) INTO rows_count;
      INSERT INTO tob_cleanup_before(table_name, row_count)
      VALUES (target.table_name, rows_count);
    END IF;
  END LOOP;
END $$;

SELECT table_name, row_count AS rows_before_delete
FROM tob_cleanup_before
ORDER BY table_name;

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN SELECT table_name FROM tob_cleanup_target_table ORDER BY delete_order LOOP
    IF to_regclass(format('public.%I', target.table_name)) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I', target.table_name);
    END IF;
  END LOOP;
END $$;

CREATE TEMP TABLE tob_obsolete_menu AS
SELECT menu_id
FROM sys_menu
WHERE perms LIKE 'care:%'
   OR perms LIKE 'payment:%'
   OR perms LIKE 'wechat:%'
   OR perms LIKE 'system:carousel:%'
   OR perms LIKE 'system:caregiver:%'
   OR component LIKE 'care/%'
   OR component LIKE 'payment/%'
   OR component LIKE 'wechat/%'
   OR component LIKE 'system/carousel/%'
   OR component LIKE 'system/caregiver/%'
   OR path IN ('care', 'payment', 'wechat', 'dashboard', 'carousel');

WITH RECURSIVE menu_tree AS (
  SELECT menu_id FROM tob_obsolete_menu
  UNION
  SELECT child.menu_id
  FROM sys_menu child
  INNER JOIN menu_tree parent ON child.parent_id = parent.menu_id
)
DELETE FROM sys_role_menu
WHERE menu_id IN (SELECT menu_id FROM menu_tree);

WITH RECURSIVE menu_tree AS (
  SELECT menu_id FROM tob_obsolete_menu
  UNION
  SELECT child.menu_id
  FROM sys_menu child
  INNER JOIN menu_tree parent ON child.parent_id = parent.menu_id
)
DELETE FROM sys_menu
WHERE menu_id IN (SELECT menu_id FROM menu_tree);

-- Optional: start ToB business data from a clean slate. Comment these DELETEs if imported ToB tenant data must be kept.
DELETE FROM tenant_daily_report;
DELETE FROM tenant_badge_binding;
DELETE FROM tenant_caregiver;
DELETE FROM tenant_org_unit;
DELETE FROM nurse_daily_report;
DELETE FROM audio_record;
DELETE FROM device_gps_log;
DELETE FROM device_event_log;
DELETE FROM device_user_binding;
DELETE FROM badge_device;

-- Keep operational tables but clear imported logs.
DELETE FROM sys_logininfor;
DELETE FROM sys_oper_log;
DELETE FROM sys_job_log;

COMMIT;
