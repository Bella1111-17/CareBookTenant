INSERT INTO sys_job (
  job_name,
  job_group,
  invoke_target,
  cron_expression,
  misfire_policy,
  concurrent,
  status,
  create_by,
  update_by,
  remark
)
SELECT
  '租户AI日报生成',
  'SYSTEM',
  'task.nurseDailyReport',
  '0 0 6,18 * * ?',
  '3',
  '1',
  '0',
  'system',
  'system',
  '每天 06:00 和 18:00 为当前绑定护工的租户设备生成AI日报'
WHERE NOT EXISTS (
  SELECT 1 FROM sys_job WHERE invoke_target = 'task.nurseDailyReport'
);

UPDATE sys_job
   SET job_name = '租户AI日报生成',
       job_group = 'SYSTEM',
       cron_expression = '0 0 6,18 * * ?',
       misfire_policy = '3',
       concurrent = '1',
       status = '0',
       update_by = 'system',
       update_time = CURRENT_TIMESTAMP,
       remark = '每天 06:00 和 18:00 为当前绑定护工的租户设备生成AI日报'
 WHERE invoke_target = 'task.nurseDailyReport';
