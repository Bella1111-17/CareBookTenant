-- Add GPS and device event pages to the tenant-care smart care menu.
-- Safe to run repeatedly on PostgreSQL.

INSERT INTO sys_menu
  (menu_id, menu_name, parent_id, order_num, path, component, query, is_frame, is_cache, visible, menu_type, perms, icon, status, create_by, remark)
VALUES
  (235, 'GPS定位', 230, 5, 'gps', 'tenant-care/gps/index', '', '1', '0', '0', 'C', 'tenant-care:gps:list', 'map', '0', 'admin', '按设备归属隔离的GPS定位数据'),
  (236, '设备事件', 230, 6, 'event', 'tenant-care/event/index', '', '1', '0', '0', 'C', 'tenant-care:event:list', 'log', '0', 'admin', '按设备归属隔离的设备事件数据'),
  (3350, 'GPS定位查询', 235, 1, '', '', '', '1', '0', '0', 'F', 'tenant-care:gps:query', '#', '0', 'admin', ''),
  (3360, '设备事件查询', 236, 1, '', '', '', '1', '0', '0', 'F', 'tenant-care:event:query', '#', '0', 'admin', '')
ON CONFLICT (menu_id) DO UPDATE SET
  menu_name = EXCLUDED.menu_name,
  parent_id = EXCLUDED.parent_id,
  order_num = EXCLUDED.order_num,
  path = EXCLUDED.path,
  component = EXCLUDED.component,
  query = EXCLUDED.query,
  is_frame = EXCLUDED.is_frame,
  is_cache = EXCLUDED.is_cache,
  visible = EXCLUDED.visible,
  menu_type = EXCLUDED.menu_type,
  perms = EXCLUDED.perms,
  icon = EXCLUDED.icon,
  status = EXCLUDED.status,
  remark = EXCLUDED.remark;

INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r
CROSS JOIN (
  VALUES
    (235),
    (236),
    (3350),
    (3360)
) AS m(menu_id)
WHERE r.role_key = 'tenant_admin'
  AND r.del_flag = '0'
ON CONFLICT (role_id, menu_id) DO NOTHING;
