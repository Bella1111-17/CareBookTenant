-- Remove obsolete "智能工牌" navigation entries after the business moved to
-- tenant-care smart nursing.
--
-- Scope:
-- - sys_menu / sys_role_menu only
-- - legacy menu tree rooted at sys_menu.menu_id = 3000 when it is "智能工牌"
-- - legacy system/smart-badge pages and system:badge:* permissions
--
-- This does not touch tenant-care menus, business tables, table schemas,
-- migration history, or smart nursing data.

BEGIN;

WITH RECURSIVE obsolete_menu AS (
  SELECT menu_id
  FROM sys_menu
  WHERE del_flag = '0'
    AND (
      (menu_id = 3000 AND menu_name = '智能工牌' AND COALESCE(path, '') = 'badge')
      OR COALESCE(perms, '') LIKE 'system:badge:%'
      OR COALESCE(component, '') LIKE 'system/smart-badge/%'
      OR COALESCE(path, '') IN ('smart-badge', '/smart-badge', 'system/smart-badge', '/system/smart-badge')
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
      (menu_id = 3000 AND menu_name = '智能工牌' AND COALESCE(path, '') = 'badge')
      OR COALESCE(perms, '') LIKE 'system:badge:%'
      OR COALESCE(component, '') LIKE 'system/smart-badge/%'
      OR COALESCE(path, '') IN ('smart-badge', '/smart-badge', 'system/smart-badge', '/system/smart-badge')
    )
  UNION ALL
  SELECT child.menu_id
  FROM sys_menu child
  INNER JOIN obsolete_menu parent ON child.parent_id = parent.menu_id
  WHERE child.del_flag = '0'
)
DELETE FROM sys_menu m
WHERE m.menu_id IN (SELECT DISTINCT menu_id FROM obsolete_menu);

COMMIT;
