import { test, expect } from '@playwright/test'
import { SSH_PORT, USERNAME, PASSWORD, TIMEOUTS } from './constants.js'

const E2E_ENABLED = process.env.ENABLE_E2E_SSH === '1'

// V2-specific helpers
async function waitForV2Terminal(page, timeout = TIMEOUTS.CONNECTION) {
  // Wait for terminal to be ready and visible
  await expect(page.locator('.xterm-helper-textarea')).toBeVisible({ timeout })

  // Wait for terminal to be actually interactive
  await page.waitForFunction(() => {
    const textarea = document.querySelector('.xterm-helper-textarea')
    return textarea && !textarea.disabled &&
           getComputedStyle(textarea).visibility !== 'hidden' &&
           getComputedStyle(textarea).display !== 'none'
  }, { timeout })
}

async function waitForV2Connection(page, timeout = TIMEOUTS.CONNECTION) {
  // V2 might not show "Connected" status immediately
  // Instead, wait for terminal to be ready
  try {
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: timeout / 2 })
  } catch {
    // Fallback: if no "Connected" status, just wait for terminal
    await waitForV2Terminal(page, timeout)
  }
}

async function waitForV2Prompt(page, timeout = TIMEOUTS.PROMPT_WAIT) {
  await page.waitForFunction(
    () => {
      const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
      // Look for shell prompt patterns
      return /[$#%>]\s*$/.test(terminalContent) ||
             /testuser@.*[$#%>]/.test(terminalContent) ||
             terminalContent.includes('$') || terminalContent.includes('#')
    },
    { timeout }
  )
}

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
    await page.locator('.xterm-helper-textarea').click()
    await page.keyboard.type('printenv FOO')
    await page.keyboard.press('Enter')

    // Wait for command to execute and output to appear
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)

    // Check terminal content for the environment variable value
    await page.waitForFunction(
      () => {
        const content = document.querySelector('.xterm-screen')?.textContent || ''
        return content.includes('bar')
      },
      { timeout: TIMEOUTS.CONNECTION }
    )

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
    await page.locator('.xterm-helper-textarea').click()
    await page.keyboard.type('printenv VAR1')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)

    await page.waitForFunction(
      () => {
        const content = document.querySelector('.xterm-screen')?.textContent || ''
        return content.includes('value1')
      },
      { timeout: TIMEOUTS.CONNECTION }
    )

    // Test second variable
    await page.keyboard.type('printenv VAR2')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)

    await page.waitForFunction(
      () => {
        const content = document.querySelector('.xterm-screen')?.textContent || ''
        return content.includes('value2')
      },
      { timeout: TIMEOUTS.CONNECTION }
    )

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

    await page.locator('.xterm-helper-textarea').click()
    await page.keyboard.type('printenv SPECIAL')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)

    await page.waitForFunction(
      () => {
        const content = document.querySelector('.xterm-screen')?.textContent || ''
        return content.includes('hello world with spaces')
      },
      { timeout: TIMEOUTS.CONNECTION }
    )

    const content = await page.$eval('.xterm-screen', (el) => el.textContent)
    expect(content).toContain('hello world with spaces')

    await context.close()
  })
})