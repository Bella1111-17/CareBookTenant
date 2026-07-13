import { config } from 'dotenv';
import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { join } from 'path';

// 加载根目录的 .env 文件
config({ path: join(process.cwd(), '.env') });
config({ path: join(__dirname, '../../../../.env'), override: false });

const configFileNameObj = {
  development: 'dev',
  test: 'test',
  production: 'prod',
};

const env = process.env.NODE_ENV;

console.log(env);

export default () => {
  const rawConfig = readFileSync(join(__dirname, `./${configFileNameObj[env]}.yml`), 'utf8');
  const resolvedConfig = rawConfig.replace(/\$\{([A-Z0-9_]+)\}/g, (_, key) => process.env[key] || '');
  return yaml.load(resolvedConfig) as Record<string, any>;
};
