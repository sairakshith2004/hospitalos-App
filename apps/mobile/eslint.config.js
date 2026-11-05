// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

const SAMPLE_DATA_IMPORTS = {
  group: [
    '**/demo-data',
    '**/demo-data/**',
    '**/fixtures',
    '**/fixtures/**',
    '**/sample-data',
    '**/sample-data/**',
  ],
  message: 'Workflow screens must read data from the API, not from app-side sample data.',
};

const DEMO_DASHBOARD_IMPORTS = {
  group: ['**/demo-dashboard', '**/demo-dashboard/**'],
  message:
    'Only src/features/dashboard/dashboard-content.ts may use the development demo dashboard.',
};

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', 'coverage/*', 'android/*', 'ios/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // No unsafe casts: `as const` is still allowed, other `as X` / `<X>` assertions are not.
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  {
    // Workflow screens get their data from the API, never from app-side sample data
    // (docs/MOBILE-ARCHITECTURE.md §6.1, test DO-3). Only development tools and the component
    // showcase may hold sample content.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/features/dev/**', 'src/features/showcase/**', 'src/**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [SAMPLE_DATA_IMPORTS, DEMO_DASHBOARD_IMPORTS] },
      ],
    },
  },
  {
    // The single, reviewed entry point that may reach the development-only demo dashboard. It
    // returns demo figures only for a development demo session (dashboard-content.ts).
    files: ['src/features/dashboard/dashboard-content.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: [SAMPLE_DATA_IMPORTS] }],
    },
  },
]);
