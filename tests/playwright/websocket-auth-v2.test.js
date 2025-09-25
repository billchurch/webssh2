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
  connectV2,
  buildBasicAuthUrl,
  connectWithBasicAuth,
  executeAndVerifyCommand,
  connectAndWaitForTerminal,
  fillFormDirectly
} from './v2-helpers.js'

test.describe('V2 WebSocket Interactive Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
  })

  test('should connect successfully with valid credentials', async ({ page }) => {
    // Use shared helper to connect and wait
    await connectAndWaitForTerminal(page, {
      host: TEST_CONFIG.sshHost,
      port: TEST_CONFIG.sshPort,
      username: TEST_CONFIG.validUsername,
      password: TEST_CONFIG.validPassword
    })

    // Verify terminal is functional
    await executeAndVerifyCommand(page, 'whoami', TEST_CONFIG.validUsername)
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
    await connectAndWaitForTerminal(page, {
      host: TEST_CONFIG.sshHost,
      port: TEST_CONFIG.sshPort,
      username: TEST_CONFIG.validUsername,
      password: TEST_CONFIG.validPassword
    })

    // Disable beforeunload handler and refresh
    await page.evaluate(() => {
      window.onbeforeunload = null
    })
    await page.reload()

    // Verify login form appears again
    await expect(page.locator('[name="username"]')).toBeVisible()

    // Re-authenticate
    await connectAndWaitForTerminal(page, {
      host: TEST_CONFIG.sshHost,
      port: TEST_CONFIG.sshPort,
      username: TEST_CONFIG.validUsername,
      password: TEST_CONFIG.validPassword
    })
  })
})

test.describe('V2 WebSocket Basic Authentication', () => {
  test('should connect automatically with valid Basic Auth credentials', async ({ page }) => {
    // Connect with Basic Auth and wait
    await connectWithBasicAuth(
      page,
      TEST_CONFIG.baseUrl,
      TEST_CONFIG.validUsername,
      TEST_CONFIG.validPassword,
      TEST_CONFIG.sshHost,
      TEST_CONFIG.sshPort
    )

    // Verify terminal is functional
    await waitForV2Prompt(page)
    await executeAndVerifyCommand(page, 'echo "V2 Basic Auth works!"', 'V2 Basic Auth works!')
  })

  test('should return 401 for invalid Basic Auth credentials', async ({ page }) => {
    // Build URL with invalid credentials
    const url = buildBasicAuthUrl(
      TEST_CONFIG.baseUrl,
      TEST_CONFIG.invalidUsername,
      TEST_CONFIG.invalidPassword,
      TEST_CONFIG.sshHost,
      TEST_CONFIG.sshPort
    )

    // Expect navigation to fail with 401 due to immediate SSH validation
    const response = await page.goto(url, { waitUntil: 'commit' })

    // Verify we get a 401 Unauthorized response
    expect(response?.status()).toBe(401)

    // Verify the WWW-Authenticate header is set for proper HTTP Basic Auth behavior
    const wwwAuthHeader = response?.headers()['www-authenticate']
    expect(wwwAuthHeader).toContain('Basic')
  })

  test('should return 502 for Basic Auth with non-existent host', async ({ page }) => {
    // Build URL with non-existent host
    const url = buildBasicAuthUrl(
      TEST_CONFIG.baseUrl,
      TEST_CONFIG.validUsername,
      TEST_CONFIG.validPassword,
      TEST_CONFIG.nonExistentHost,
      TEST_CONFIG.sshPort
    )

    // Expect navigation to fail with 502 Bad Gateway (network/connectivity issue)
    const response = await page.goto(url, { waitUntil: 'commit' })

    // Verify we get a 502 Bad Gateway response (SSH connection to non-existent host is a network issue)
    expect(response?.status()).toBe(502)

    // Response body should indicate it's a connectivity issue
    const responseText = await response?.text()
    expect(responseText).toContain('Bad Gateway')
  })

  test('should execute multiple commands with Basic Auth session', async ({ page }) => {
    // Connect with Basic Auth and wait
    await connectWithBasicAuth(
      page,
      TEST_CONFIG.baseUrl,
      TEST_CONFIG.validUsername,
      TEST_CONFIG.validPassword,
      TEST_CONFIG.sshHost,
      TEST_CONFIG.sshPort
    )
    await waitForV2Prompt(page)

    // Execute multiple commands
    await executeAndVerifyCommand(page, 'pwd', '/home/testuser')
    await executeAndVerifyCommand(page, 'ls -la', '.ssh')
    await executeAndVerifyCommand(page, 'uname -a', 'Linux')
  })
})

test.describe('V2 WebSocket Connection Resilience', () => {
  test('should maintain terminal state during session', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)

    // Connect using helper
    await fillFormDirectly(page, TEST_CONFIG.sshHost, TEST_CONFIG.sshPort, TEST_CONFIG.validUsername, TEST_CONFIG.validPassword)
    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await waitForV2Prompt(page)

    // Create a file
    const testFile = `test_v2_${Date.now()}.txt`
    await executeV2Command(page, `echo "V2 test content" > ${testFile}`)

    // Verify file exists
    await executeAndVerifyCommand(page, `cat ${testFile}`, 'V2 test content')

    // Clean up
    await executeV2Command(page, `rm ${testFile}`)
    await executeAndVerifyCommand(page, `ls ${testFile}`, 'No such file')
  })
})