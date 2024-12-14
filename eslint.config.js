import eslint from '@eslint/js';
import nodePlugin from 'eslint-plugin-node';
import securityPlugin from 'eslint-plugin-security';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
    eslint.configs.recommended,
    {
        ignores: ['**/*{.,-}min.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: {
                    impliedStrict: true
                }
            },
            globals: {
                ...nodePlugin.configs.recommended.globals,
            }
        },
        plugins: {
            node: nodePlugin,
            security: securityPlugin,
            prettier: prettierPlugin
        },
        rules: {
            // Modern JavaScript
            'no-var': 'error',
            'prefer-const': 'error',
            'prefer-rest-params': 'error',
            'prefer-spread': 'error',
            'prefer-template': 'error',
            'template-curly-spacing': ['error', 'never'],

            // Node.js specific rules
            // 'node/exports-style': ['error', 'exports'],
            'node/file-extension-in-import': ['error', 'always'],
            'node/prefer-global/buffer': ['error', 'always'],
            'node/prefer-global/console': ['error', 'always'],
            'node/prefer-global/process': ['error', 'always'],
            'node/prefer-global/url-search-params': ['error', 'always'],
            'node/prefer-global/url': ['error', 'always'],
            'node/prefer-promises/dns': 'error',
            'node/prefer-promises/fs': 'error',

            // Security rules
            'security/detect-buffer-noassert': 'error',
            'security/detect-child-process': 'warn',
            'security/detect-disable-mustache-escape': 'error',
            'security/detect-eval-with-expression': 'error',
            'security/detect-new-buffer': 'error',
            'security/detect-no-csrf-before-method-override': 'error',
            'security/detect-non-literal-fs-filename': 'warn',
            'security/detect-non-literal-regexp': 'warn',
            'security/detect-non-literal-require': 'warn',
            'security/detect-object-injection': 'warn',
            'security/detect-possible-timing-attacks': 'warn',
            'security/detect-pseudoRandomBytes': 'warn',

            // Best practices and style
            'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
            'curly': ['error', 'all'],
            'eqeqeq': ['error', 'always', { null: 'ignore' }],
            'no-return-await': 'error',
            'require-await': 'error',
            'prettier/prettier': ['error', {
                singleQuote: true,
                trailingComma: 'es5',
                printWidth: 100,
                semi: false
            }]
        }
    },
    {
        files: ['**/*.test.js', '**/*.spec.js'],
        languageOptions: {
            globals: {
                jest: true
            }
        },
        rules: {
            'node/no-unpublished-require': 'off',
            'node/no-missing-require': 'off'
        }
    }
];
