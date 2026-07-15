const path = require('path');
const { createRequire } = require('module');
const serverDir = path.resolve(__dirname, '..', 'apps', 'server');
const serverRequire = createRequire(path.resolve(serverDir, 'package.json'));

process.chdir(serverDir);
process.env.TS_NODE_PROJECT = path.resolve(serverDir, 'tsconfig.json');

serverRequire('ts-node/register');
serverRequire('tsconfig-paths/register');

const { NestFactory } = serverRequire('@nestjs/core');
const { AppModule } = require(path.resolve(serverDir, 'src/app.module'));
const { TaskService } = require(path.resolve(serverDir, 'src/module/monitor/job/task.service'));

async function main() {
  const dateStr = process.argv[2] || '';
  const invokeTarget = dateStr ? `task.nurseDailyReport('${dateStr}')` : 'task.nurseDailyReport';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  try {
    const task = app.get(TaskService);
    const ok = await task.executeTask(invokeTarget, 'manual-test-tenant-ai-report', 'SYSTEM');
    console.log('TASK_RESULT', ok);
    console.log('WAITING_FOR_ASYNC_AI_FILL_MS', 150000);
    await new Promise((resolve) => setTimeout(resolve, 150000));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
