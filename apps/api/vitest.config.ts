import { defineConfig } from 'vitest/config';

// Unit and HTTP tests: no database needed.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/db/**'],
  },
});
