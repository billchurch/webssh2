import eslint from '@eslint/js'
import nPlugin from 'eslint-plugin-n'
import securityPlugin from 'eslint-plugin-security'
import prettierConfig from 'eslint-config-prettier'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import unicornPlugin from 'eslint-plugin-unicorn'
import sonarjsPlugin from 'eslint-plugin-sonarjs'
import playwrightPlugin from 'eslint-plugin-playwright'

export default [
  eslint.configs.recommended,
  sonarjsPlugin.configs.recommended,
  prettierConfig,
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
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          impliedStrict: true,
        },
      },
      globals: {
        ...nPlugin.configs['flat/recommended'].languageOptions.globals,
        structuredClone: 'readonly',
      },
    },
    plugins: {
      n: nPlugin,
      security: securityPlugin,
      unicorn: unicornPlugin,
    },
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'prefer-template': 'error',
      'no-duplicate-imports': 'error',
      'template-curly-spacing': ['error', 'never'],
      'n/file-extension-in-import': ['error', 'always'],
      'no-new': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-object-injection': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'warn',
      'security/detect-unsafe-regex': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
      'no-useless-catch': 'error',
      'prefer-regex-literals': 'error',
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-return-await': 'off',
      'require-await': 'off',
      'prefer-object-has-own': 'error',
      'prefer-object-spread': 'error',
      'no-nested-ternary': 'error',
      'no-template-curly-in-string': 'error',
      'unicorn/no-negated-condition': 'error',
      'unicorn/no-for-each': 'error',
      'unicorn/prefer-includes': 'error',
      'unicorn/prefer-string-slice': 'error',
      'unicorn/explicit-length-check': 'error',
      'unicorn/error-message': 'error',
      'unicorn/prefer-top-level-await': 'error',
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/prefer-modern-dom-apis': 'error',
      // S7744 parity: prevent useless fallback objects in spreads
      'unicorn/no-useless-fallback-in-spread': 'error',
      // S7780 parity: use String.raw to avoid escaping backslashes
      'unicorn/prefer-string-raw': 'error',
      // S7746 parity: return values directly instead of Promise.resolve/reject
      'unicorn/no-useless-promise-resolve-reject': 'error',
      // S7758 parity: codePointAt over charCodeAt
      'unicorn/prefer-code-point': 'error',
      // S7773 parity: Number.NaN, Number.parseInt, etc. over globals
      'unicorn/prefer-number-properties': 'error',
      // S7776 parity: use a Set for repeated membership checks
      'unicorn/prefer-set-has': 'error',
      'unicorn/consistent-function-scoping': 'warn',
      // sonarjs downgrades: existing functions exceed the threshold; refactors
      // are tracked separately (see SonarCloud project for canonical findings).
      // Keeping these visible as warnings so new violations are surfaced.
      'sonarjs/cognitive-complexity': 'warn',
      // The codebase uses `Result<T, E>` and discriminated-union returns by
      // design — this rule misreads those as inconsistent return types.
      'sonarjs/function-return-type': 'warn',
    },
  },
  {
    files: ['**/*.test.js', '**/*.spec.js'],
    rules: {
      'n/no-unpublished-require': 'off',
      'n/no-missing-require': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: new URL('.', import.meta.url).pathname,
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      'no-duplicate-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowString: false,
          allowNumber: false,
          allowNullableObject: false,
        },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-base-to-string': 'error',
      '@typescript-eslint/prefer-function-type': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
        },
        {
          selector: 'enum',
          format: ['PascalCase'],
        },
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        },
      ],
      // S1186 parity: avoid empty functions (constructors remain allowed for DI hooks)
      '@typescript-eslint/no-empty-function': [
        'error',
        {
          allow: ['constructors'],
        },
      ],
      '@typescript-eslint/prefer-optional-chain': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'validator',
              message:
                "Import only the functions you need via subpath, e.g. import isEmail from 'validator/lib/isEmail' — importing the whole 'validator' package pulls in every validator.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/unbound-method': 'off',
      'security/detect-object-injection': 'warn',
      '@typescript-eslint/no-empty-function': [
        'error',
        {
          allow: ['constructors', 'methods'],
        },
      ],
      // sonarjs overrides for tests, mirroring exclusions in
      // sonar-project.properties (S2068, S1313, S4036, S6290) plus rules
      // that fire on intentional test patterns.
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
      // Postinstall and CLI scripts legitimately resolve binaries from PATH.
      // Mirrors sonar-project.properties exclusion of typescript:S4036 for scripts/**.
      'sonarjs/no-os-command-from-path': 'off',
    },
  },
  {
    files: ['*.config.mjs', '*.config.js', 'eslint.config.mjs'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['tests/playwright/**'],
    plugins: { playwright: playwrightPlugin },
    rules: {
      // S2925 parity: fixed waits are flaky; prefer condition-based waits.
      'playwright/no-wait-for-timeout': 'error',
      // S1607 parity: conditional skips with reason strings remain allowed.
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
    },
  },

]
