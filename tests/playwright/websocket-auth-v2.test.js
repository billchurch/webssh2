/**
 * WebSocket Authentication Tests for WebSSH2 V2
 *
 * Tests both interactive authentication and Basic Auth scenarios
 * Rewritten for V2's improved architecture and async patterns
 */

import { test, expect } from '@playwright/test'
import { TEST_CONFIG, TIMEOUTS } from './constants.js'

// V2-specific helper functions
async function waitForV2Connection(page, timeout = TIMEOUTS.CONNECTION) {
  // V2 might emit different events or have different timing
  // Wait for either "Connected" status or successful socket connection
  try {
    await expect(page.locator('text=Connected')).toBeVisible({ timeout })
  } catch {
    // Fallback: check if terminal is ready (V2 might not show "Connected")
    await expect(page.locator('.xterm-helper-textarea')).toBeVisible({ timeout })
  }
}

async function waitForV2Terminal(page, timeout = TIMEOUTS.CONNECTION) {
  // Wait for terminal to be ready and visible
  await expect(page.locator('.xterm-helper-textarea')).toBeVisible({ timeout })

  // Wait for terminal to be actually interactive (V2 improvement)
  await page.waitForFunction(() => {
    const textarea = document.querySelector('.xterm-helper-textarea')
    return textarea && !textarea.disabled &&
           getComputedStyle(textarea).visibility !== 'hidden' &&
           getComputedStyle(textarea).display !== 'none'
  }, { timeout })
}

async function executeV2Command(page, command) {
  await page.locator('.xterm-helper-textarea').click()
  await page.keyboard.type(command)
  await page.keyboard.press('Enter')
  // V2 might need different timing
  await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
}

async function waitForV2Prompt(page, timeout = TIMEOUTS.PROMPT_WAIT) {
  // V2 might have different prompt patterns
  await page.waitForFunction(
    () => {
      const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
      // Look for common shell prompts
      return /[$#%>]\s*$/.test(terminalContent) ||
             /testuser@.*[$#%>]/.test(terminalContent)
    },
    { timeout }
  )
}

test.describe('V2 WebSocket Interactive Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
  })

  test('should connect successfully with valid credentials', async ({ page }) => {
    // Fill in the form
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)

    // Click connect
    await page.click('button:has-text("Connect")')

    // Wait for V2 connection
    await waitForV2Connection(page)
    await waitForV2Terminal(page)

    // Verify terminal is functional
    await waitForV2Prompt(page)
    await executeV2Command(page, 'whoami')

    // Check that whoami output appears
    await expect(page.locator('.xterm-screen').filter({ hasText: TEST_CONFIG.validUsername })).toBeVisible()
  })

  test('should show error with invalid credentials', async ({ page }) => {
    // Fill in the form with invalid credentials
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.invalidUsername)
    await page.fill('[name="password"]', TEST_CONFIG.invalidPassword)

    // Click connect
    await page.click('button:has-text("Connect")')

    // V2 might show errors differently - check multiple possible locations
    const possibleErrors = [
      page.locator('text=/Authentication failed/'),
      page.locator('text=/Invalid credentials/'),
      page.locator('text=/SSH connection error/'),
      page.locator('text=/Connection failed/'),
      page.locator('[role="status"]').filter({ hasText: /Authentication failed|Invalid credentials/ })
    ]

    // Wait for any error to appear
    let errorFound = false
    for (const errorLocator of possibleErrors) {
      try {
        await expect(errorLocator.first()).toBeVisible({ timeout: TIMEOUTS.DEFAULT })
        errorFound = true
        break
      } catch {
        // Continue to next error type
      }
    }

    expect(errorFound).toBeTruthy()

    // Verify form is still visible for retry
    await expect(page.locator('[name="username"]')).toBeVisible()
  })

  test('should show connection error for wrong port', async ({ page }) => {
    // Fill in the form with wrong port
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.invalidPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)

    // Click connect
    await page.click('button:has-text("Connect")')

    // V2 should show connection error
    await expect(page.locator('text=/Authentication failed|Connection refused|ECONNREFUSED/').first()).toBeVisible({ timeout: TIMEOUTS.DEFAULT })
  })

  test('should handle page refresh gracefully', async ({ page }) => {
    // First, establish a connection
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    await page.click('button:has-text("Connect")')

    await waitForV2Connection(page)

    // Disable beforeunload handler and refresh
    await page.evaluate(() => {
      window.onbeforeunload = null
    })
    await page.reload()

    // Verify login form appears again
    await expect(page.locator('[name="username"]')).toBeVisible()

    // Re-authenticate
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    await page.click('button:has-text("Connect")')

    // Verify reconnection works
    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await waitForV2Prompt(page)
  })
})

test.describe('V2 WebSocket Basic Authentication', () => {
  test('should connect automatically with valid Basic Auth credentials', async ({ page }) => {
    // Navigate with Basic Auth credentials
    const basicAuth = `${TEST_CONFIG.validUsername}:${TEST_CONFIG.validPassword}`
    const baseUrlWithAuth = TEST_CONFIG.baseUrl.replace('://', `://${basicAuth}@`)
    const url = `${baseUrlWithAuth}/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`
    await page.goto(url)

    // V2 should auto-connect with basic auth
    await waitForV2Connection(page)
    await waitForV2Terminal(page)

    // Verify terminal is functional
    await waitForV2Prompt(page)
    await executeV2Command(page, 'echo "V2 Basic Auth works!"')
    await expect(page.locator('.xterm-screen').filter({ hasText: 'V2 Basic Auth works!' })).toBeVisible()
  })

  test('should return 401 for invalid Basic Auth credentials', async ({ page }) => {
    // Navigate with invalid Basic Auth credentials
    const badAuth = `${TEST_CONFIG.invalidUsername}:${TEST_CONFIG.invalidPassword}`
    const baseUrlWithAuth = TEST_CONFIG.baseUrl.replace('://', `://${badAuth}@`)
    const url = `${baseUrlWithAuth}/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`

    // Expect navigation to fail with 401 due to immediate SSH validation
    const response = await page.goto(url, { waitUntil: 'commit' })

    // Verify we get a 401 Unauthorized response
    expect(response?.status()).toBe(401)

    // Verify the WWW-Authenticate header is set for proper HTTP Basic Auth behavior
    const wwwAuthHeader = response?.headers()['www-authenticate']
    expect(wwwAuthHeader).toContain('Basic')
  })

  test('should return 502 for Basic Auth with non-existent host', async ({ page }) => {
    // Navigate with Basic Auth to non-existent host
    const basicAuth = `${TEST_CONFIG.validUsername}:${TEST_CONFIG.validPassword}`
    const baseUrlWithAuth = TEST_CONFIG.baseUrl.replace('://', `://${basicAuth}@`)
    const url = `${baseUrlWithAuth}/ssh/host/${TEST_CONFIG.nonExistentHost}?port=${TEST_CONFIG.sshPort}`

    // Expect navigation to fail with 502 Bad Gateway (network/connectivity issue)
    const response = await page.goto(url, { waitUntil: 'commit' })

    // Verify we get a 502 Bad Gateway response (SSH connection to non-existent host is a network issue)
    expect(response?.status()).toBe(502)

    // Response body should indicate it's a connectivity issue
    const responseText = await response?.text()
    expect(responseText).toContain('Bad Gateway')
  })

  test('should execute multiple commands with Basic Auth session', async ({ page }) => {
    // Navigate with Basic Auth credentials
    const basicAuth = `${TEST_CONFIG.validUsername}:${TEST_CONFIG.validPassword}`
    const baseUrlWithAuth = TEST_CONFIG.baseUrl.replace('://', `://${basicAuth}@`)
    const url = `${baseUrlWithAuth}/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`
    await page.goto(url)

    // Wait for V2 connection
    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await waitForV2Prompt(page)

    // Execute multiple commands
    await executeV2Command(page, 'pwd')
    await expect(page.locator('.xterm-screen').filter({ hasText: '/home/testuser' })).toBeVisible()

    await executeV2Command(page, 'ls -la')
    await expect(page.locator('.xterm-screen').filter({ hasText: '.ssh' })).toBeVisible()

    await executeV2Command(page, 'uname -a')
    await expect(page.locator('.xterm-screen').filter({ hasText: 'Linux' })).toBeVisible()
  })
})

test.describe('V2 WebSocket Connection Resilience', () => {
  test('should maintain terminal state during session', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)

    // Connect
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    await page.click('button:has-text("Connect")')

    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await waitForV2Prompt(page)

    // Create a file
    const testFile = `test_v2_${Date.now()}.txt`
    await executeV2Command(page, `echo "V2 test content" > ${testFile}`)

    // Verify file exists
    await executeV2Command(page, `cat ${testFile}`)
    await expect(page.locator('.xterm-screen').filter({ hasText: 'V2 test content' })).toBeVisible()

    // Clean up
    await executeV2Command(page, `rm ${testFile}`)
    await executeV2Command(page, `ls ${testFile}`)
    await expect(page.locator('.xterm-screen').filter({ hasText: 'No such file' })).toBeVisible()
  })
})