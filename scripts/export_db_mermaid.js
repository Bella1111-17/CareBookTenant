const path = require('path');
const { createRequire } = require('module');

const serverRequire = createRequire(path.resolve(__dirname, '..', 'apps', 'server', 'package.json'));
const dotenv = serverRequire('dotenv');
const { Client } = serverRequire('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const client = new Client({
  host: process.env.TOB_POSTGRES_HOST || '101.133.170.55',
  port: Number(process.env.TOB_POSTGRES_PORT || 5432),
  database: process.env.TOB_POSTGRES_DATABASE || 'carebook_tenant',
  user: process.env.TOB_POSTGRES_USER || 'tenant_admin',
  password: process.env.TOB_POSTGRES_PASSWORD,
});

const normalizeId = (name) => name.replace(/[^a-zA-Z0-9_]/g, '_');

const preferredTableForColumn = {
  tenant_id: 'sys_tenant',
  user_id: 'sys_user',
  role_id: 'sys_role',
  menu_id: 'sys_menu',
  dept_id: 'sys_dept',
  post_id: 'sys_post',
  dict_id: 'sys_dict_type',
  config_id: 'sys_config',
  job_id: 'sys_job',
  device_no: 'badge_device',
  tenant_caregiver_id: 'tenant_caregiver',
  org_unit_id: 'tenant_org_unit',
  parent_id: null,
};

async function main() {
  await client.connect();

  const tableRows = await client.query(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
     ORDER BY table_name
  `);
  const tables = tableRows.rows.map((row) => row.table_name);
  const tableSet = new Set(tables);

  const columnRows = await client.query(`
    SELECT table_name, column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position
  `);
  const columnsByTable = new Map();
  for (const row of columnRows.rows) {
    if (!columnsByTable.has(row.table_name)) columnsByTable.set(row.table_name, []);
    columnsByTable.get(row.table_name).push(row.column_name);
  }

  const fkRows = await client.query(`
    SELECT
      tc.table_name AS source_table,
      kcu.column_name AS source_column,
      ccu.table_name AS target_table,
      ccu.column_name AS target_column,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  `);

  const edges = [];
  const edgeKeys = new Set();
  const addEdge = (source, target, label, kind) => {
    if (!source || !target || source === target || !tableSet.has(source) || !tableSet.has(target)) return;
    const key = `${source}|${target}|${label}|${kind}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ source, target, label, kind });
  };

  for (const row of fkRows.rows) {
    addEdge(row.source_table, row.target_table, `${row.source_column} -> ${row.target_column}`, 'FK');
  }

  for (const [table, columns] of columnsByTable.entries()) {
    for (const column of columns) {
      let target = preferredTableForColumn[column];
      if (column === 'parent_id') target = table;
      if (!target && column.endsWith('_id')) {
        const prefix = column.slice(0, -3);
        const candidates = [prefix, `sys_${prefix}`, `tenant_${prefix}`];
        target = candidates.find((candidate) => tableSet.has(candidate));
      }
      if (target) addEdge(table, target, column, 'inferred');
    }
  }

  const fkCount = edges.filter((edge) => edge.kind === 'FK').length;
  const inferredCount = edges.filter((edge) => edge.kind === 'inferred').length;

  const lines = ['flowchart TD'];
  for (const table of tables) {
    lines.push(`  ${normalizeId(table)}["${table}"]`);
  }
  for (const edge of edges) {
    const style = edge.kind === 'FK' ? edge.label : `${edge.label} (推断)`;
    lines.push(`  ${normalizeId(edge.source)} -->|"${style}"| ${normalizeId(edge.target)}`);
  }

  console.log(JSON.stringify({ tableCount: tables.length, fkCount, inferredCount, mermaid: lines.join('\n') }, null, 2));
  await client.end();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await client.end();
  } catch {}
  process.exit(1);
});
