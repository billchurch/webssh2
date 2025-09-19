import { test, expect } from '@playwright/test'
import { SSH_PORT, USERNAME, PASSWORD, TIMEOUTS } from './constants.js'
const E2E_ENABLED = process.env.ENABLE_E2E_SSH === '1'

test.describe('E2E: AcceptEnv via containerized SSHD', () => {
  test.skip(!E2E_ENABLED, 'Set ENABLE_E2E_SSH=1 to run this test')

  test('forwards FOO=bar to SSH session', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      httpCredentials: { username: USERNAME, password: PASSWORD },
    })
    const page = await context.newPage()

    await page.goto(`${baseURL}/ssh/host/localhost?port=${SSH_PORT}&env=FOO:bar`)

    // Focus terminal and query the env var
    await page.locator('.xterm-helper-textarea').click()
    await page.keyboard.type('printenv FOO')
    await page.keyboard.press('Enter')

    // Wait for terminal to render the value
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
    const content = await page.$eval('.xterm-screen', (el) => el.textContent)
    expect(content).toContain('bar')

    // Capture a screenshot for artifacts/debugging
    const shotPath = test.info().outputPath('e2e-ssh-acceptenv.png')
    await page.screenshot({ path: shotPath, fullPage: true })
    await test.info().attach('screenshot', { path: shotPath, contentType: 'image/png' })

    await context.close()
  })
})
