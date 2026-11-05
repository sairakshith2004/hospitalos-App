// Shared ESLint rules for the API and packages workspaces (the mobile app has its own config).
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/** @param {string} tsconfigRootDir */
export function baseConfig(tsconfigRootDir) {
  return defineConfig(
    { ignores: ['node_modules/**', 'dist/**', 'coverage/**'] },
    tseslint.configs.strictTypeChecked,
    {
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      rules: {
        // No unsafe casts: `as const` is allowed, other `as X` / `<X>` assertions are not.
        '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/no-non-null-assertion': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
        // Unused parameters are allowed only when deliberately marked with a leading underscore
        // (Express needs all four parameters to recognise an error handler).
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'all' },
        ],
      },
    },
    {
      files: ['**/*.js', '**/*.mjs'],
      extends: [tseslint.configs.disableTypeChecked],
    },
  );
}
