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

// External navigation (AD-M-017): nothing in the app may open a URL outside it until a reviewed
// feature needs it. Incoming links go through src/features/links/link-guard.ts instead.
// One zod: the app uses the instance the shared contracts are built with.
const ZOD_IMPORT = {
  name: 'zod',
  message: "Import { z } from '@hospitalos/contracts' so the app and the contracts share one zod.",
};

const EXTERNAL_NAVIGATION_IMPORTS = [
  {
    name: 'react-native',
    importNames: ['Linking'],
    message: 'Opening URLs outside the app needs a reviewed exception (AD-M-017).',
  },
  {
    name: 'expo-linking',
    message: 'Opening URLs outside the app needs a reviewed exception (AD-M-017).',
  },
  {
    name: 'expo-web-browser',
    message: 'Opening URLs outside the app needs a reviewed exception (AD-M-017).',
  },
];

const URL_WITH_SCHEME = '/^[a-zA-Z][a-zA-Z0-9+.-]*:/';
const EXTERNAL_NAVIGATION_SYNTAX = [
  {
    selector: `JSXAttribute[name.name='href'] Literal[value=${URL_WITH_SCHEME}]`,
    message: 'Links must stay inside the app; external URLs need a reviewed exception (AD-M-017).',
  },
  {
    selector: `CallExpression[callee.property.name=/^(push|replace|navigate|dismissTo)$/] > Literal[value=${URL_WITH_SCHEME}]`,
    message:
      'Navigation must stay inside the app; external URLs need a reviewed exception (AD-M-017).',
  },
];

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
        {
          paths: [...EXTERNAL_NAVIGATION_IMPORTS, ZOD_IMPORT],
          patterns: [SAMPLE_DATA_IMPORTS, DEMO_DASHBOARD_IMPORTS],
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/**/__tests__/**'],
    rules: {
      'no-restricted-syntax': ['error', ...EXTERNAL_NAVIGATION_SYNTAX],
    },
  },
  {
    // The single, reviewed entry point that may reach the development-only demo dashboard. It
    // returns demo figures only for a development demo session (dashboard-content.ts).
    files: ['src/features/dashboard/dashboard-content.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { paths: [...EXTERNAL_NAVIGATION_IMPORTS, ZOD_IMPORT], patterns: [SAMPLE_DATA_IMPORTS] },
      ],
    },
  },
]);
