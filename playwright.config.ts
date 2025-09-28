/** Unified Playwright config
 * - Runs tests in tests/playwright
 * - Starts WebSSH2 via webServer
 * - If ENABLE_E2E_SSH=1, starts containerized sshd in global setup and stops in teardown
 */
import { defineConfig, devices } from '@playwright/test'
import { WEB_PORT, BASE_URL, TIMEOUTS } from './tests/playwright/constants.js'

const enableE2E = process.env.ENABLE_E2E_SSH === '1'

export default defineConfig({
  testDir: './tests/playwright',
  testIgnore: '**/debug/**',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: TIMEOUTS.ACTION,
    navigationTimeout: TIMEOUTS.NAVIGATION,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Keep server logs quiet by default; opt-in with E2E_DEBUG
    command: `WEBSSH2_LISTEN_PORT=${WEB_PORT} node dist/index.js`,
    url: `${BASE_URL}/ssh`,
    reuseExistingServer: true,
    timeout: TIMEOUTS.WEB_SERVER,
    env: {
      DEBUG: process.env.E2E_DEBUG ?? '',
      WEBSSH2_SSH_READY_TIMEOUT: '10000' // Faster timeout for test suite
    },
  },
  ...(enableE2E
    ? {
        globalSetup: './tests/playwright/global-setup.ts',
        globalTeardown: './tests/playwright/global-teardown.ts',
      }
    : {}),
})
