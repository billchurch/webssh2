/** Unified Playwright config
 * - Runs tests in tests/playwright
 * - Starts WebSSH2 via webServer
 * - If ENABLE_E2E_SSH=1, starts containerized sshd in global setup and stops in teardown
 */
import { defineConfig, devices } from '@playwright/test'

const enableE2E = process.env.ENABLE_E2E_SSH === '1'

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:2222',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'WEBSSH2_LISTEN_PORT=2222 DEBUG=webssh2:* node dist/index.js',
    url: 'http://localhost:2222/ssh',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  ...(enableE2E
    ? {
        globalSetup: './tests/playwright/global-setup.ts',
        globalTeardown: './tests/playwright/global-teardown.ts',
      }
    : {}),
})

