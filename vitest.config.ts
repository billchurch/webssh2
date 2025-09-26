import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.vitest.{js,ts,tsx}'],
    coverage: {
      provider: 'v8',
      all: false,
      include: ['dist/**/*.js'],
      exclude: ['**/node_modules/**', '**/test/**'],
    },
  },
  resolve: {
    alias: {
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
})

