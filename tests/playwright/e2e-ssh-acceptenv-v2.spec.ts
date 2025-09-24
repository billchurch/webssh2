import { test, expect } from '@playwright/test'
import { SSH_PORT, USERNAME, PASSWORD, TIMEOUTS } from './constants.js'
import { waitForV2Terminal, waitForV2Connection, waitForV2Prompt, executeV2Command, waitForCommandOutput } from './v2-helpers.js'

const E2E_ENABLED = process.env.ENABLE_E2E_SSH === '1'

test.describe('V2 E2E: AcceptEnv via containerized SSHD', () => {
  test.skip(!E2E_ENABLED, 'Set ENABLE_E2E_SSH=1 to run this test')

  test('forwards FOO=bar to SSH session (V2)', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      httpCredentials: { username: USERNAME, password: PASSWORD },
    })
    const page = await context.newPage()

    // Navigate to SSH with environment variable
    await page.goto(`${baseURL}/ssh/host/localhost?port=${SSH_PORT}&env=FOO:bar`)

    // Wait for V2 auto-connection to complete
    await waitForV2Connection(page)
    await waitForV2Terminal(page)

    // Wait for shell prompt to be ready
    await waitForV2Prompt(page)

    // Focus terminal and query the env var
    await executeV2Command(page, 'printenv FOO')

    // Check terminal content for the environment variable value
    await waitForCommandOutput(page, 'bar')

    const content = await page.$eval('.xterm-screen', (el) => el.textContent)
    expect(content).toContain('bar')

    // Capture a screenshot for artifacts/debugging
    const shotPath = test.info().outputPath('e2e-ssh-acceptenv-v2.png')
    await page.screenshot({ path: shotPath, fullPage: true })
    await test.info().attach('screenshot', { path: shotPath, contentType: 'image/png' })

    await context.close()
  })

  test('handles multiple environment variables (V2)', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      httpCredentials: { username: USERNAME, password: PASSWORD },
    })
    const page = await context.newPage()

    // Navigate with multiple environment variables (using multiple env params as per V2 implementation)
    await page.goto(`${baseURL}/ssh/host/localhost?port=${SSH_PORT}&env=VAR1:value1&env=VAR2:value2`)

    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await waitForV2Prompt(page)

    // Test first variable
    await executeV2Command(page, 'printenv VAR1')
    await waitForCommandOutput(page, 'value1')

    // Test second variable
    await executeV2Command(page, 'printenv VAR2')
    await waitForCommandOutput(page, 'value2')

    const content = await page.$eval('.xterm-screen', (el) => el.textContent)
    expect(content).toContain('value1')
    expect(content).toContain('value2')

    await context.close()
  })

  test('environment variables work with special characters (V2)', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      httpCredentials: { username: USERNAME, password: PASSWORD },
    })
    const page = await context.newPage()

    // Test with special characters (URL encoded)
    const specialValue = 'hello world with spaces'
    const encodedValue = encodeURIComponent(specialValue)
    await page.goto(`${baseURL}/ssh/host/localhost?port=${SSH_PORT}&env=SPECIAL:${encodedValue}`)

    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await waitForV2Prompt(page)

    await executeV2Command(page, 'printenv SPECIAL')
    await waitForCommandOutput(page, 'hello world with spaces')

    const content = await page.$eval('.xterm-screen', (el) => el.textContent)
    expect(content).toContain('hello world with spaces')

    await context.close()
  })
})