/**
 * WebSocket Authentication Tests for WebSSH2 V2
 *
 * Tests both interactive authentication and Basic Auth scenarios
 * Rewritten for V2's improved architecture and async patterns
 */

import { test, expect } from '@playwright/test'
import { TEST_CONFIG, TIMEOUTS } from './constants.js'
import {
  waitForV2Connection,
  waitForV2Terminal,
  executeV2Command,
  waitForV2Prompt,
  checkForV2AuthError,
  fillV2LoginForm,
  connectV2,
  getTerminalContent
} from './v2-helpers.js'

test.describe('V2 WebSocket Interactive Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
  })

  test('should connect successfully with valid credentials', async ({ page }) => {
    // Use shared helper to connect
    await connectV2(page, {
      host: TEST_CONFIG.sshHost,
      port: TEST_CONFIG.sshPort,
      username: TEST_CONFIG.validUsername,
      password: TEST_CONFIG.validPassword
    })

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
    // Use shared helper to connect
    await connectV2(page, {
      host: TEST_CONFIG.sshHost,
      port: TEST_CONFIG.sshPort,
      username: TEST_CONFIG.invalidUsername,
      password: TEST_CONFIG.invalidPassword
    })

    // Use shared helper to check for errors
    const errorFound = await checkForV2AuthError(page)
    expect(errorFound).toBeTruthy()

    // Verify form is still visible for retry
    await expect(page.locator('[name="username"]')).toBeVisible()
  })

  test('should show connection error for wrong port', async ({ page }) => {
    // Use shared helper to connect with wrong port
    await connectV2(page, {
      host: TEST_CONFIG.sshHost,
      port: TEST_CONFIG.invalidPort,
      username: TEST_CONFIG.validUsername,
      password: TEST_CONFIG.validPassword
    })

    // V2 should show connection error
    await expect(page.locator('text=/Authentication failed|Connection refused|ECONNREFUSED/').first()).toBeVisible({ timeout: TIMEOUTS.DEFAULT })
  })

  test('should handle page refresh gracefully', async ({ page }) => {
    // First, establish a connection
    await connectV2(page, {
      host: TEST_CONFIG.sshHost,
      port: TEST_CONFIG.sshPort,
      username: TEST_CONFIG.validUsername,
      password: TEST_CONFIG.validPassword
    })

    await waitForV2Connection(page)

    // Disable beforeunload handler and refresh
    await page.evaluate(() => {
      window.onbeforeunload = null
    })
    await page.reload()

    // Verify login form appears again
    await expect(page.locator('[name="username"]')).toBeVisible()

    // Re-authenticate
    await connectV2(page, {
      host: TEST_CONFIG.sshHost,
      port: TEST_CONFIG.sshPort,
      username: TEST_CONFIG.validUsername,
      password: TEST_CONFIG.validPassword
    })

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