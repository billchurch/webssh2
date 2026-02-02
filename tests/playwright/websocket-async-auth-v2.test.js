/**
 * V2 Async/Await Authentication Tests for WebSSH2
 *
 * Tests async patterns with V2's improved architecture
 * Focuses on proper async handling and timing for V2
 */

import { test, expect } from '@playwright/test'
import { TEST_CONFIG, TIMEOUTS } from './constants.js'
import {
  waitForV2Connection,
  waitForV2Prompt,
  executeV2Command,
  verifyV2TerminalFunctionality,
  connectV2,
  checkForV2AuthError,
  buildBasicAuthUrl,
  connectWithBasicAuth,
  executeAndVerifyCommand,
  connectAndWaitForTerminal,
  fillFormDirectly,
  executeCommandsWithExpectedOutput,
  executeCommandList,
  getTerminalContent
} from './v2-helpers.js'

test.describe('V2 Async Error Recovery and Edge Cases', () => {
  test('should handle async timeout gracefully (V2)', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)

    // Fill form with very slow/unresponsive host to test timeout
    await fillFormDirectly(page, '192.0.2.1', '22', TEST_CONFIG.validUsername, TEST_CONFIG.validPassword)

    // V2 should handle timeout errors gracefully via error modal
    // SSH timeout is 10s (WEBSSH2_SSH_READY_TIMEOUT), so 15s is plenty
    await expect(
      page.locator('text=/Authentication Failed|Connection Failed|timeout|ETIMEDOUT/i').first()
    ).toBeVisible({ timeout: 15000 })

    // Click "Try Again" to dismiss error modal and show login form
    await page.click('button:has-text("Try Again")')

    // Form should still be usable
    await expect(page.locator('[name="username"]')).toBeVisible()
  })
})

test.describe('V2 Async/Await Modal Login Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
  })

  test('should handle async connect with valid credentials (V2)', async ({ page }) => {
    // Use shared helper to connect
    await connectV2(page, {
      host: TEST_CONFIG.sshHost,
      port: TEST_CONFIG.sshPort,
      username: TEST_CONFIG.validUsername,
      password: TEST_CONFIG.validPassword
    })

    // Verify successful async connection with V2
    await waitForV2Connection(page)

    // Verify terminal functionality with async operations
    await verifyV2TerminalFunctionality(page, TEST_CONFIG.validUsername)
  })

  test('should handle async authentication error properly (V2)', async ({ page }) => {
    // Use shared helper to connect with invalid credentials
    await connectV2(page, {
      host: TEST_CONFIG.sshHost,
      port: TEST_CONFIG.sshPort,
      username: TEST_CONFIG.invalidUsername,
      password: TEST_CONFIG.invalidPassword
    })

    // Use shared helper to check for errors
    const errorFound = await checkForV2AuthError(page)
    expect(errorFound).toBeTruthy()

    // Click "Try Again" to dismiss error modal and show login form
    await page.click('button:has-text("Try Again")')

    // Form should remain available for retry
    await expect(page.locator('[name="username"]')).toBeVisible()
  })

  test('should handle async connection error for non-existent host (V2)', async ({ page }) => {
    // Use shared helper with non-existent host
    await connectV2(page, {
      host: TEST_CONFIG.nonExistentHost,
      port: TEST_CONFIG.sshPort,
      username: TEST_CONFIG.validUsername,
      password: TEST_CONFIG.validPassword
    })

    // V2 should handle network errors asynchronously
    await expect(
      page.locator('text=/Authentication failed|Connection failed|ENOTFOUND|getaddrinfo/').first()
    ).toBeVisible({ timeout: TIMEOUTS.DEFAULT })
  })

  test('should handle async shell creation and terminal operations (V2)', async ({ page }) => {
    // Connect and wait for terminal
    await connectAndWaitForTerminal(page, {
      host: TEST_CONFIG.sshHost,
      port: TEST_CONFIG.sshPort,
      username: TEST_CONFIG.validUsername,
      password: TEST_CONFIG.validPassword
    })

    // Test multiple async terminal operations
    const commands = [
      'pwd',
      'whoami',
      'echo "async test 1"',
      'echo "async test 2"',
      'date'
    ]

    await executeCommandList(page, commands)

    // Verify all commands executed
    const finalContent = await getTerminalContent(page)
    expect(finalContent).toContain('async test 1')
    expect(finalContent).toContain('async test 2')
  })

  test('should handle terminal resize with async operations (V2)', async ({ page }) => {
    // Connect using helper
    await connectAndWaitForTerminal(page, {
      host: TEST_CONFIG.sshHost,
      port: TEST_CONFIG.sshPort,
      username: TEST_CONFIG.validUsername,
      password: TEST_CONFIG.validPassword
    })

    // Get initial terminal size
    await executeV2Command(page, 'stty size')
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)

    // Resize viewport and test async resize handling
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)

    // Test that terminal still works after resize
    await executeV2Command(page, 'echo "resize test"')

    await page.waitForFunction(
      () => {
        // eslint-disable-next-line no-undef
        const content = document.querySelector('.xterm-screen')?.textContent || ''
        return content.includes('resize test')
      },
      { timeout: TIMEOUTS.CONNECTION }
    )

    const content = await getTerminalContent(page)
    expect(content).toContain('resize test')
  })
})

test.describe('V2 Async/Await HTTP Basic Authentication', () => {
  test('should handle async auto-connect with valid Basic Auth (V2)', async ({ page }) => {
    // Use helper to build URL
    const url = buildBasicAuthUrl(
      TEST_CONFIG.baseUrl,
      TEST_CONFIG.validUsername,
      TEST_CONFIG.validPassword,
      TEST_CONFIG.sshHost,
      TEST_CONFIG.sshPort
    )

    // Navigate to V2 Basic Auth URL
    await page.goto(url)

    // V2 should handle async auto-connection
    await waitForV2Connection(page)

    // Verify terminal functionality
    await verifyV2TerminalFunctionality(page, TEST_CONFIG.validUsername)
  })

  test('should show async auth error modal with invalid Basic Auth (V2)', async ({ page }) => {
    // With client-side error handling, server returns 200 and shows error modal
    const url = buildBasicAuthUrl(
      TEST_CONFIG.baseUrl,
      TEST_CONFIG.invalidUsername,
      TEST_CONFIG.invalidPassword,
      TEST_CONFIG.sshHost,
      TEST_CONFIG.sshPort
    )
    await page.goto(url)

    // Wait for the error modal to appear with authentication failure
    await expect(page.locator('text=/Authentication Failed/i').first()).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
  })

  test('should show async connection error modal for Basic Auth to non-existent host (V2)', async ({ page }) => {
    // With client-side error handling, server returns 200 and shows error modal
    const url = buildBasicAuthUrl(
      TEST_CONFIG.baseUrl,
      TEST_CONFIG.validUsername,
      TEST_CONFIG.validPassword,
      TEST_CONFIG.nonExistentHost,
      TEST_CONFIG.sshPort
    )
    await page.goto(url)

    // Wait for the error modal to appear with connection failure
    await expect(page.locator('text=/Connection Failed|ENOTFOUND|getaddrinfo/i').first()).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
  })

  test('should handle multiple async commands with Basic Auth session (V2)', async ({ page }) => {
    // Use helper to connect with Basic Auth
    await connectWithBasicAuth(
      page,
      TEST_CONFIG.baseUrl,
      TEST_CONFIG.validUsername,
      TEST_CONFIG.validPassword,
      TEST_CONFIG.sshHost,
      TEST_CONFIG.sshPort
    )
    await waitForV2Prompt(page)

    // Execute multiple async commands
    const commands = [
      { cmd: 'pwd', expect: '/home/testuser' },
      { cmd: 'ls -la', expect: '.ssh' },
      { cmd: 'uname -a', expect: 'Linux' }
    ]

    await executeCommandsWithExpectedOutput(page, commands)

    const finalContent = await getTerminalContent(page)
    expect(finalContent).toContain('/home/testuser')
    expect(finalContent).toContain('.ssh')
    expect(finalContent).toContain('Linux')
  })

  test('should handle async session persistence with Basic Auth (V2)', async ({ page }) => {
    // Use helper to connect with Basic Auth
    await connectWithBasicAuth(
      page,
      TEST_CONFIG.baseUrl,
      TEST_CONFIG.validUsername,
      TEST_CONFIG.validPassword,
      TEST_CONFIG.sshHost,
      TEST_CONFIG.sshPort
    )
    await waitForV2Prompt(page)

    // Create a test file to verify session persistence
    const testFile = `v2_session_test_${Date.now()}.txt`
    await executeV2Command(page, `echo "V2 session persistence" > ${testFile}`)

    // Verify file was created
    await executeAndVerifyCommand(page, `cat ${testFile}`, 'V2 session persistence')

    // Clean up
    await executeV2Command(page, `rm ${testFile}`)

    const content = await getTerminalContent(page)
    expect(content).toContain('V2 session persistence')
  })
})