-- Remove obsolete System Management features:
-- - notice announcement
-- - ad/banner management legacy carousel entries
--
-- PostgreSQL only. Review and back up the target database before running.
-- This script intentionally does not touch shared upload/file/user/role
-- infrastructure beyond deleting the obsolete menu relationships.

BEGIN;

WITH RECURSIVE obsolete_menu AS (
  SELECT menu_id
  FROM sys_menu
  WHERE del_flag = '0'
    AND (
      COALESCE(perms, '') LIKE 'system:notice:%'
      OR COALESCE(component, '') = 'system/notice/index'
      OR COALESCE(path, '') = 'notice'
      OR COALESCE(perms, '') LIKE 'system:carousel:%'
      OR COALESCE(component, '') LIKE 'system/carousel/%'
      OR COALESCE(path, '') = 'carousel'
    )
  UNION ALL
  SELECT child.menu_id
  FROM sys_menu child
  INNER JOIN obsolete_menu parent ON child.parent_id = parent.menu_id
  WHERE child.del_flag = '0'
)
DELETE FROM sys_role_menu rm
WHERE rm.menu_id IN (SELECT DISTINCT menu_id FROM obsolete_menu);

WITH RECURSIVE obsolete_menu AS (
  SELECT menu_id
  FROM sys_menu
  WHERE del_flag = '0'
    AND (
      COALESCE(perms, '') LIKE 'system:notice:%'
      OR COALESCE(component, '') = 'system/notice/index'
      OR COALESCE(path, '') = 'notice'
      OR COALESCE(perms, '') LIKE 'system:carousel:%'
      OR COALESCE(component, '') LIKE 'system/carousel/%'
      OR COALESCE(path, '') = 'carousel'
    )
  UNION ALL
  SELECT child.menu_id
  FROM sys_menu child
  INNER JOIN obsolete_menu parent ON child.parent_id = parent.menu_id
  WHERE child.del_flag = '0'
)
DELETE FROM sys_menu m
WHERE m.menu_id IN (SELECT DISTINCT menu_id FROM obsolete_menu);

DELETE FROM sys_dict_data
WHERE dict_type IN ('sys_notice_type', 'sys_notice_status');

DELETE FROM sys_dict_type
WHERE dict_type IN ('sys_notice_type', 'sys_notice_status');

DROP TABLE IF EXISTS sys_notice;
DROP TABLE IF EXISTS sys_carousel;

COMMIT;
