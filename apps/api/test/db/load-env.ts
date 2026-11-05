import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Database tests read the repository-root .env (written by `npm run env:init`) when it exists.
// In CI the variables come from the workflow instead.
const envFile = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const required = ['TEST_DATABASE_URL', 'TEST_MIGRATION_DATABASE_URL'] as const;
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Database tests need ${missing.join(' and ')} (see the root .env.example).`);
}
