-- Patch tenant admin navigation to the tenant-care business experience.
-- Safe to run repeatedly on PostgreSQL.

INSERT INTO sys_menu
  (menu_id, menu_name, parent_id, order_num, path, component, query, is_frame, is_cache, visible, menu_type, perms, icon, status, create_by, remark)
VALUES
  (230, '智能护理', 0, 4, 'tenant-care', NULL, '', '1', '0', '0', 'M', '', 'peoples', '0', 'admin', '养老院智能护理目录'),
  (231, '护工管理', 230, 1, 'caregiver', 'tenant-care/caregiver/index', '', '1', '0', '0', 'C', 'tenant-care:caregiver:list', 'people', '0', 'admin', '护工档案和护理单元'),
  (232, '设备管理', 230, 2, 'device', 'tenant-care/device/index', '', '1', '0', '0', 'C', 'tenant-care:badge:list', 'monitor', '0', 'admin', '工牌绑定解绑'),
  (233, '录音管理', 230, 3, 'record', 'tenant-care/record/index', '', '1', '0', '0', 'C', 'tenant-care:record:list', 'message', '0', 'admin', '租户录音和隔离状态'),
  (234, 'AI日报', 230, 4, 'report', 'tenant-care/report/index', '', '1', '0', '0', 'C', 'tenant-care:report:list', 'chart', '0', 'admin', '租户AI日报和质检风险分析'),
  (235, 'GPS定位', 230, 5, 'gps', 'tenant-care/gps/index', '', '1', '0', '0', 'C', 'tenant-care:gps:list', 'map', '0', 'admin', '按设备归属隔离的GPS定位数据'),
  (236, '设备事件', 230, 6, 'event', 'tenant-care/event/index', '', '1', '0', '0', 'C', 'tenant-care:event:list', 'log', '0', 'admin', '按设备归属隔离的设备事件数据'),
  (3300, '租户护工查询', 231, 1, '', '', '', '1', '0', '0', 'F', 'tenant-care:caregiver:query', '#', '0', 'admin', ''),
  (3301, '租户护工新增', 231, 2, '', '', '', '1', '0', '0', 'F', 'tenant-care:caregiver:add', '#', '0', 'admin', ''),
  (3302, '租户护工修改', 231, 3, '', '', '', '1', '0', '0', 'F', 'tenant-care:caregiver:edit', '#', '0', 'admin', ''),
  (3303, '租户护工删除', 231, 4, '', '', '', '1', '0', '0', 'F', 'tenant-care:caregiver:remove', '#', '0', 'admin', ''),
  (3310, '护理单元新增', 231, 5, '', '', '', '1', '0', '0', 'F', 'tenant-care:org-unit:add', '#', '0', 'admin', ''),
  (3311, '护理单元修改', 231, 6, '', '', '', '1', '0', '0', 'F', 'tenant-care:org-unit:edit', '#', '0', 'admin', ''),
  (3320, '工牌绑定', 232, 1, '', '', '', '1', '0', '0', 'F', 'tenant-care:badge:bind', '#', '0', 'admin', ''),
  (3321, '工牌解绑', 232, 2, '', '', '', '1', '0', '0', 'F', 'tenant-care:badge:unbind', '#', '0', 'admin', ''),
  (3322, '设备新增', 232, 3, '', '', '', '1', '0', '0', 'F', 'tenant-care:badge:add', '#', '0', 'admin', ''),
  (3323, '设备修改', 232, 4, '', '', '', '1', '0', '0', 'F', 'tenant-care:badge:edit', '#', '0', 'admin', ''),
  (3324, '设备删除', 232, 5, '', '', '', '1', '0', '0', 'F', 'tenant-care:badge:remove', '#', '0', 'admin', ''),
  (3330, '租户录音查询', 233, 1, '', '', '', '1', '0', '0', 'F', 'tenant-care:record:query', '#', '0', 'admin', ''),
  (3340, '租户日报查询', 234, 1, '', '', '', '1', '0', '0', 'F', 'tenant-care:report:query', '#', '0', 'admin', ''),
  (3341, '单设备日报生成', 234, 2, '', '', '', '1', '0', '0', 'F', 'tenant-care:report:generate', '#', '0', 'admin', ''),
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

DELETE FROM sys_role_menu rm
USING sys_role r
WHERE r.role_key = 'tenant_admin'
  AND r.role_id = rm.role_id
  AND r.del_flag = '0'
  AND rm.menu_id NOT IN (230, 231, 232, 233, 234, 235, 236, 3300, 3301, 3302, 3303, 3310, 3311, 3320, 3321, 3322, 3323, 3324, 3330, 3340, 3341, 3350, 3360);

INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r
CROSS JOIN (
  VALUES
    (230),
    (231),
    (232),
    (233),
    (234),
    (235),
    (236),
    (3300),
    (3301),
    (3302),
    (3303),
    (3310),
    (3311),
    (3320),
    (3321),
    (3322),
    (3323),
    (3324),
    (3330),
    (3340),
    (3341),
    (3350),
    (3360)
) AS m(menu_id)
WHERE r.role_key = 'tenant_admin'
  AND r.del_flag = '0'
ON CONFLICT (role_id, menu_id) DO NOTHING;
