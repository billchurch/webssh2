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
  connectWithBasicAuth,
  executeAndVerifyCommand,
  connectAndWaitForTerminal,
  fillFormDirectly,
  validCredentials,
  invalidCredentials,
  credentialsWithPort
} from './v2-helpers.js'

test.describe('V2 WebSocket Interactive Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
  })

  test('should connect successfully with valid credentials', async ({ page }) => {
    // Use shared helper to connect and wait
    await connectAndWaitForTerminal(page, validCredentials())

    // Verify terminal is functional
    await executeAndVerifyCommand(page, 'whoami', TEST_CONFIG.validUsername)
  })

  test('should show error with invalid credentials', async ({ page }) => {
    // Use shared helper to connect
    await connectV2(page, invalidCredentials())

    // Use shared helper to check for errors
    const errorFound = await checkForV2AuthError(page)
    expect(errorFound).toBeTruthy()

    // Click "Try Again" to dismiss error modal and show login form
    await page.click('button:has-text("Try Again")')

    // Verify form is visible for retry
    await expect(page.locator('[name="username"]')).toBeVisible()
  })

  test('should show connection error for wrong port', async ({ page }) => {
    // Use shared helper to connect with wrong port
    await connectV2(page, credentialsWithPort(TEST_CONFIG.invalidPort))

    // V2 should show connection error
    await expect(page.locator('text=/Authentication failed|Connection refused|ECONNREFUSED/').first()).toBeVisible({ timeout: TIMEOUTS.DEFAULT })
  })

  test('should handle page refresh gracefully', async ({ page }) => {
    // First, establish a connection
    await connectAndWaitForTerminal(page, validCredentials())

    // Disable beforeunload handler and refresh
    await page.evaluate(() => {
      // eslint-disable-next-line no-undef
      window.onbeforeunload = null
    })
    await page.reload()

    // Verify login form appears again
    await expect(page.locator('[name="username"]')).toBeVisible()

    // Re-authenticate
    await connectAndWaitForTerminal(page, validCredentials())
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

  test('should show auth error modal for invalid Basic Auth credentials', async ({ page }) => {
    // With client-side error handling, server returns 200 and shows error modal
    const authPrefix = `://${TEST_CONFIG.invalidUsername}:${TEST_CONFIG.invalidPassword}@`
    const baseUrlWithAuth = TEST_CONFIG.baseUrl.replace('://', authPrefix)
    const url = `${baseUrlWithAuth}/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`
    await page.goto(url)

    // Wait for the error modal to appear with authentication failure
    await expect(page.locator('text=/Authentication Failed/i').first()).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
  })

  test('should show connection error modal for Basic Auth with non-existent host', async ({ page }) => {
    // With client-side error handling, server returns 200 and shows error modal
    const authPrefix = `://${TEST_CONFIG.validUsername}:${TEST_CONFIG.validPassword}@`
    const baseUrlWithAuth = TEST_CONFIG.baseUrl.replace('://', authPrefix)
    const url = `${baseUrlWithAuth}/ssh/host/${TEST_CONFIG.nonExistentHost}?port=${TEST_CONFIG.sshPort}`
    await page.goto(url)

    // Wait for the error modal to appear with connection failure
    await expect(page.locator('text=/Connection Failed|ENOTFOUND|getaddrinfo/i').first()).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
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