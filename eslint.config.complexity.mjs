import baseConfig from './eslint.config.mjs'

// Create a new configuration that extends the base with stricter complexity rules
export default [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      // Complexity rules with more practical thresholds
      'complexity': ['warn', { max: 12 }],           // Warning at 12, allows some complex logic
      'max-depth': ['error', 4],                     // Error at 4 levels deep
      'max-lines-per-function': ['warn', {
        max: 75,                                      // 75 lines is more practical
        skipBlankLines: true,
        skipComments: true
      }],
      'max-statements': ['warn', 20],                // 20 statements for complex functions
      'max-params': ['warn', 5],                     // 5 params for complex configs
      'max-nested-callbacks': ['error', 3],          // Keep at 3 to avoid callback hell
      'max-classes-per-file': ['warn', 2],           // Warning at 2, allows error classes together
      'max-lines': ['warn', {
        max: 400,                                     // 400 lines for complex modules
        skipBlankLines: true,
        skipComments: true
      }]
    }
  }
]