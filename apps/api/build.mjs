// Production build: bundles the server and operator commands into plain JavaScript under dist/,
// so a Windows installation runs `node dist/server.js` with no npm install and no tsx.
// Folder layout mirrors src/ because the server and migration runner find their SQL files
// relative to their own location (dist/db/migrations).
import { cpSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const out = join(here, 'dist');

const entryPoints = [
  'server.ts',
  'db/migrate-cli.ts',
  'cli/bootstrap-admin.ts',
  'cli/reset-password.ts',
  'cli/seed.ts',
  'cli/seed-demo.ts',
  'cli/stop-server.ts',
].map((file) => join(src, file));

rmSync(out, { recursive: true, force: true });

await build({
  entryPoints,
  outbase: src,
  outdir: out,
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  sourcemap: true,
  legalComments: 'linked',
  logLevel: 'warning',
  // Bundled CommonJS dependencies (Express, pg) call require() for Node built-ins.
  banner: {
    js: "import { createRequire as __hosCreateRequire } from 'node:module'; const require = __hosCreateRequire(import.meta.url);",
  },
  // pg's optional native binding is never used; pg falls back to pure JavaScript.
  external: ['pg-native'],
});

const migrations = join(src, 'db', 'migrations');
cpSync(migrations, join(out, 'db', 'migrations'), {
  recursive: true,
  filter: (path) => path === migrations || path.endsWith('.sql'),
});

const count = readdirSync(join(out, 'db', 'migrations')).length;
process.stdout.write(
  `API build written to dist/ (${entryPoints.length} entry points, ${count} migrations)\n`,
);
