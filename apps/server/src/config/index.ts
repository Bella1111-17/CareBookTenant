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

const env = process.env.NODE_ENV || 'development';
const requiredProductionEnv = ['TOB_POSTGRES_PASSWORD', 'TOB_JWT_SECRET'];

const resolveEnv = (_: string, key: string, defaultValue?: string) => process.env[key] ?? defaultValue ?? '';

export default () => {
  if (env === 'production') {
    const missingKeys = requiredProductionEnv.filter((key) => !process.env[key]);
    if (missingKeys.length > 0) {
      throw new Error(`Missing required production environment variables: ${missingKeys.join(', ')}`);
    }
  }

  const rawConfig = readFileSync(join(__dirname, `./${configFileNameObj[env]}.yml`), 'utf8');
  const resolvedConfig = rawConfig.replace(/\$\{([A-Z0-9_]+)(?::-(.*?))?\}/g, resolveEnv);
  return yaml.load(resolvedConfig) as Record<string, any>;
};
