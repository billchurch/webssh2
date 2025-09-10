/**
 * Playwright Configuration for WebSSH2 WebSocket Tests
 * This config uses an existing server instead of starting a new one
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/playwright',

  // Maximum time one test can run for
  timeout: 30 * 1000,

  // Test execution settings
  fullyParallel: false, // Run tests sequentially to avoid port conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid concurrent SSH connections

  // Reporter configuration
  reporter: [['list']],

  // Shared settings for all projects
  use: {
    // Base URL for the application
    baseURL: 'http://localhost:2222',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Timeout for actions
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No web server - use existing one
})
