// Sonar-only ESLint config: runs eslint-plugin-sonarjs in isolation so
// contributors can preview the kinds of findings SonarCloud will flag without
// the noise of the full lint config. Mirrors the test/script overrides from
// eslint.config.mjs so the output matches what `npm run lint` produces for
// sonarjs rules.
//
// Plugins from the main config are registered (with no rules enabled) so that
// inline `eslint-disable-next-line` directives targeting those rules don't
// produce "rule not found" errors.

import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import nPlugin from 'eslint-plugin-n'
import securityPlugin from 'eslint-plugin-security'
import unicornPlugin from 'eslint-plugin-unicorn'
import sonarjsPlugin from 'eslint-plugin-sonarjs'
import playwrightPlugin from 'eslint-plugin-playwright'

const sharedPlugins = {
  '@typescript-eslint': tsPlugin,
  n: nPlugin,
  security: securityPlugin,
  unicorn: unicornPlugin,
  playwright: playwrightPlugin,
}

export default [
  sonarjsPlugin.configs.recommended,
  {
    ignores: [
      'dist/**',
      'build/**',
      'coverage/**',
      'node_modules/**',
      '**/*{.,-}min.js',
      '*.d.ts',
      '.tsbuild/**',
      'tsconfig.tsbuildinfo',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    plugins: sharedPlugins,
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: {
        // Several sonarjs rules (e.g. void-use) need TS type info to
        // distinguish intentional patterns from real bugs.
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: new URL('.', import.meta.url).pathname,
      },
    },
    rules: {
      'sonarjs/cognitive-complexity': 'warn',
      'sonarjs/function-return-type': 'warn',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
    rules: {
      'sonarjs/no-hardcoded-passwords': 'off',
      'sonarjs/no-hardcoded-ip': 'off',
      'sonarjs/no-os-command-from-path': 'off',
      'sonarjs/no-clear-text-protocols': 'off',
      'sonarjs/assertions-in-tests': 'off',
      'sonarjs/constructor-for-side-effects': 'off',
      'sonarjs/os-command': 'off',
      'sonarjs/publicly-writable-directories': 'off',
      'sonarjs/prefer-regexp-exec': 'warn',
      'sonarjs/slow-regex': 'warn',
    },
  },
  {
    files: ['scripts/**/*.{ts,js}'],
    rules: {
      'sonarjs/no-os-command-from-path': 'off',
    },
  },
]
