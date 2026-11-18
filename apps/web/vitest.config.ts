import { defineConfig } from 'vitest/config';

// Unit tests for the browser app's logic; no browser or server needed.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
