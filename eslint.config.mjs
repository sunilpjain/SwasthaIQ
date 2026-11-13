// Flat ESLint config for the whole monorepo.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      'legacy-demo/**',
      '**/dist/**',
      '**/cdk.out/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/*.d.ts',
      'android-app/babel.config.js',
      'android-app/metro.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // Never log raw objects that may carry patient data — use the redacting logger.
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts', '**/scripts/**/*.ts', 'infra/bin/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  prettier,
);
