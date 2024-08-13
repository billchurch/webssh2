const a11yOff = Object.keys(require('eslint-plugin-jsx-a11y').rules)
	.reduce((acc, rule) => { acc[`jsx-a11y/${rule}`] = 'off'; return acc }, {})

module.exports = {
    extends: ['airbnb', 'prettier', 'plugin:node/recommended'],
    plugins: ['pretftier'],
    rules: {
      ...a11yOff,
      'prettier/prettier': 'error',
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'func-names': 'off',
      'no-process-exit': 'off',
      'object-shorthand': 'off',
      'class-methods-use-this': 'off',
      "semi": [2, "never"]
    },
  };