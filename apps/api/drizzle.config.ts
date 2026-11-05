import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit is used only to GENERATE SQL from the schema. Generated files land in ./drizzle,
 * are reviewed, and are then moved into src/db/migrations with the next sequence number. Our own
 * forward-only runner (src/db/migrate.ts) applies them. drizzle-kit never connects to a database.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
});
