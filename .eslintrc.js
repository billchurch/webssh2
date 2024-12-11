// ESLint configuration for Node.js 22.12.0 LTS
export default {
    "env": {
        "es2024": true, // Enables ES2024 globals and syntax
        "node": true,  // Enables Node.js global variables and Node.js scoping
        "jest": true   // Keep jest environment for legacy tests during migration
    },
    "extends": [
        "eslint:recommended",
        "plugin:node/recommended",
        "plugin:security/recommended",
        "plugin:prettier/recommended"
    ],
    "plugins": [
        "node",
        "security",
        "prettier"
    ],
    "parserOptions": {
        "ecmaVersion": 2024,
        "sourceType": "module", // Enable ES modules
        "ecmaFeatures": {
            "impliedStrict": true // Enable strict mode automatically
        }
    },
    "rules": {
        // Modern JavaScript
        "no-var": "error",
        "prefer-const": "error",
        "prefer-rest-params": "error",
        "prefer-spread": "error",
        "prefer-template": "error",
        "template-curly-spacing": ["error", "never"],

        // ES Modules
        "node/exports-style": ["error", "exports"],
        "node/file-extension-in-import": ["error", "always"],
        "node/prefer-global/buffer": ["error", "always"],
        "node/prefer-global/console": ["error", "always"],
        "node/prefer-global/process": ["error", "always"],
        "node/prefer-global/url-search-params": ["error", "always"],
        "node/prefer-global/url": ["error", "always"],
        "node/prefer-promises/dns": "error",
        "node/prefer-promises/fs": "error",

        // Async patterns
        "no-promise-executor-return": "error",
        "require-atomic-updates": "error",
        "max-nested-callbacks": ["error", 3],

        // Security
        "security/detect-buffer-noassert": "error",
        "security/detect-child-process": "warn",
        "security/detect-disable-mustache-escape": "error",
        "security/detect-eval-with-expression": "error",
        "security/detect-new-buffer": "error",
        "security/detect-no-csrf-before-method-override": "error",
        "security/detect-non-literal-fs-filename": "warn",
        "security/detect-non-literal-regexp": "warn",
        "security/detect-non-literal-require": "warn",
        "security/detect-object-injection": "warn",
        "security/detect-possible-timing-attacks": "warn",
        "security/detect-pseudoRandomBytes": "warn",

        // Best practices
        "no-console": ["warn", { "allow": ["warn", "error", "info", "debug"] }],
        "curly": ["error", "all"],
        "eqeqeq": ["error", "always", { "null": "ignore" }],
        "no-return-await": "error",
        "require-await": "error",

        // Style (with Prettier compatibility)
        "prettier/prettier": ["error", {
            "singleQuote": true,
            "trailingComma": "es5",
            "printWidth": 100,
            "semi": false
        }]
    },
    "overrides": [
        {
            "files": ["**/*.test.js", "**/*.spec.js"],
            "env": {
                "jest": true,
                "node": true
            },
            "rules": {
                "node/no-unpublished-require": "off",
                "node/no-missing-require": "off"
            }
        }
    ],
    "settings": {
        "node": {
            "version": ">=22.12.0",
            "tryExtensions": [".js", ".json", ".node"]
        }
    }
}