import { test } from '@playwright/test'
import { TEST_CONFIG } from './constants.js'
import { connectWithBasicAuth, waitForV2Prompt, executeAndVerifyCommand } from './v2-helpers.js'

const E2E_ENABLED = process.env.ENABLE_E2E_SSH === '1'

test.describe('Config SSH port fallback', () => {
  test.skip(!E2E_ENABLED, 'Set ENABLE_E2E_SSH=1 to run this test')

  test('uses configured ssh.port when Basic Auth URL omits port parameter', async ({ page }) => {
    await connectWithBasicAuth(
      page,
      TEST_CONFIG.baseUrl,
      TEST_CONFIG.validUsername,
      TEST_CONFIG.validPassword,
      TEST_CONFIG.sshHost
    )

    await waitForV2Prompt(page)
    await executeAndVerifyCommand(page, 'whoami', TEST_CONFIG.validUsername)
  })
})
