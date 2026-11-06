import { defineConfig } from 'vitest/config';

// Database tests: run only against hospitalos_test (never the development database), one file
// at a time so they never race each other.
export default defineConfig({
  test: {
    include: ['test/db/**/*.db.test.ts'],
    globalSetup: ['test/db/global-setup.ts'],
    setupFiles: ['test/db/load-env.ts'],
    fileParallelism: false,
  },
});
