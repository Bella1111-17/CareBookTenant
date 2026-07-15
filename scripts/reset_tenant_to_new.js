const path = require('path');
const { createRequire } = require('module');

const serverRequire = createRequire(path.resolve(__dirname, '..', 'apps', 'server', 'package.json'));
const dotenv = serverRequire('dotenv');
const { Client } = serverRequire('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const tenantId = process.argv[2];
const shouldExecute = process.argv.includes('--execute');

if (!tenantId) {
  console.error('Usage: node scripts/reset_tenant_to_new.js <tenantId> [--execute]');
  process.exit(1);
}

const client = new Client({
  host: process.env.TOB_POSTGRES_HOST || '101.133.170.55',
  port: Number(process.env.TOB_POSTGRES_PORT || 5432),
  database: process.env.TOB_POSTGRES_DATABASE || 'carebook_tenant',
  user: process.env.TOB_POSTGRES_USER || 'tenant_admin',
  password: process.env.TOB_POSTGRES_PASSWORD,
});

const countSql = [
  ['sys_tenant', 'SELECT count(*)::int AS count FROM sys_tenant WHERE tenant_id = $1'],
  ['sys_user_kept', "SELECT count(*)::int AS count FROM sys_user WHERE tenant_id = $1 AND del_flag = '0'"],
  ['sys_role_kept', "SELECT count(*)::int AS count FROM sys_role WHERE tenant_id = $1 AND del_flag = '0'"],
  ['tenant_org_unit', 'SELECT count(*)::int AS count FROM tenant_org_unit WHERE tenant_id = $1'],
  ['tenant_caregiver', 'SELECT count(*)::int AS count FROM tenant_caregiver WHERE tenant_id = $1'],
  ['tenant_badge_binding', 'SELECT count(*)::int AS count FROM tenant_badge_binding WHERE tenant_id = $1'],
  ['tenant_daily_report', 'SELECT count(*)::int AS count FROM tenant_daily_report WHERE tenant_id = $1'],
  ['badge_device', 'SELECT count(*)::int AS count FROM badge_device WHERE tenant_id = $1'],
  ['device_user_binding', 'SELECT count(*)::int AS count FROM device_user_binding WHERE tenant_id = $1'],
  ['audio_record', 'SELECT count(*)::int AS count FROM audio_record WHERE tenant_id = $1'],
  ['device_gps_log', 'SELECT count(*)::int AS count FROM device_gps_log WHERE tenant_id = $1'],
  ['device_event_log', 'SELECT count(*)::int AS count FROM device_event_log WHERE tenant_id = $1'],
  [
    'nurse_daily_report',
    `
      SELECT count(*)::int AS count
        FROM nurse_daily_report
       WHERE device_no IN (
         SELECT device_no FROM badge_device WHERE tenant_id = $1
         UNION
         SELECT device_no FROM tenant_badge_binding WHERE tenant_id = $1
       )
    `,
  ],
];

async function tableExists(tableName) {
  const result = await client.query('SELECT to_regclass($1) AS regclass', [`public.${tableName}`]);
  return Boolean(result.rows[0]?.regclass);
}

async function safeCount([tableName, sql]) {
  if (!(await tableExists(tableName.replace('_kept', '')))) {
    return { table: tableName, count: 0, note: 'missing' };
  }
  const result = await client.query(sql, [tenantId]);
  return { table: tableName, count: result.rows[0].count };
}

async function printCounts(title) {
  const rows = [];
  for (const item of countSql) rows.push(await safeCount(item));
  console.log(title);
  console.table(rows);
}

async function executeReset() {
  await client.query('BEGIN');
  try {
    const targetDevices = await client.query(
      `
        CREATE TEMP TABLE reset_tenant_devices AS
        SELECT DISTINCT device_no
          FROM (
            SELECT device_no FROM badge_device WHERE tenant_id = $1
            UNION
            SELECT device_no FROM tenant_badge_binding WHERE tenant_id = $1
            UNION
            SELECT device_no FROM audio_record WHERE tenant_id = $1
            UNION
            SELECT device_no FROM device_gps_log WHERE tenant_id = $1
            UNION
            SELECT device_no FROM device_event_log WHERE tenant_id = $1
          ) d
         WHERE device_no IS NOT NULL AND device_no <> ''
      `,
      [tenantId],
    );
    void targetDevices;

    await client.query('DELETE FROM tenant_daily_report WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM nurse_daily_report WHERE device_no IN (SELECT device_no FROM reset_tenant_devices)');
    await client.query('DELETE FROM tenant_badge_binding WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM tenant_caregiver WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM tenant_org_unit WHERE tenant_id = $1', [tenantId]);

    await client.query('DELETE FROM audio_record WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM device_gps_log WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM device_event_log WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM device_user_binding WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM badge_device WHERE tenant_id = $1', [tenantId]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

(async () => {
  await client.connect();
  await printCounts('Before reset');

  const tenant = await client.query('SELECT tenant_id, tenant_code, tenant_name FROM sys_tenant WHERE tenant_id = $1 AND del_flag = $2', [tenantId, '0']);
  if (!tenant.rowCount) {
    throw new Error(`Tenant not found or deleted: ${tenantId}`);
  }
  console.log('Tenant kept:', tenant.rows[0]);

  if (!shouldExecute) {
    console.log('Precheck only. Re-run with --execute to reset this tenant business data.');
    await client.end();
    return;
  }

  await executeReset();
  await printCounts('After reset');
  await client.end();
})().catch(async (error) => {
  console.error(error);
  try {
    await client.end();
  } catch {}
  process.exit(1);
});
