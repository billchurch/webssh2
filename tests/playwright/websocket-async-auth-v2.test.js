/**
 * V2 Async/Await Authentication Tests for WebSSH2
 *
 * Tests async patterns with V2's improved architecture
 * Focuses on proper async handling and timing for V2
 */

import { test, expect } from '@playwright/test'
import { TEST_CONFIG, TIMEOUTS } from './constants.js'

// V2 async helpers
async function waitForV2Terminal(page, timeout = TIMEOUTS.CONNECTION) {
  await expect(page.locator('.xterm-helper-textarea')).toBeVisible({ timeout })

  await page.waitForFunction(() => {
    const textarea = document.querySelector('.xterm-helper-textarea')
    return textarea && !textarea.disabled &&
           getComputedStyle(textarea).visibility !== 'hidden' &&
           getComputedStyle(textarea).display !== 'none'
  }, { timeout })
}

async function waitForV2Connection(page, timeout = TIMEOUTS.CONNECTION) {
  try {
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: timeout / 2 })
  } catch {
    await waitForV2Terminal(page, timeout)
  }
}

async function waitForV2Prompt(page, timeout = TIMEOUTS.PROMPT_WAIT) {
  await page.waitForFunction(
    () => {
      const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
      return /[$#%>]\s*$/.test(terminalContent) ||
             /testuser@.*[$#%>]/.test(terminalContent) ||
             terminalContent.includes('$') || terminalContent.includes('#')
    },
    { timeout }
  )
}

async function executeV2Command(page, command) {
  await page.locator('.xterm-helper-textarea').click()
  await page.keyboard.type(command)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
}

async function verifyV2TerminalFunctionality(page, username) {
  await waitForV2Prompt(page)
  await executeV2Command(page, 'whoami')

  // Wait for username to appear in terminal
  await page.waitForFunction(
    (expectedUser) => {
      const content = document.querySelector('.xterm-screen')?.textContent || ''
      return content.includes(expectedUser)
    },
    username,
    { timeout: TIMEOUTS.CONNECTION }
  )

  await executeV2Command(page, 'echo "V2 Async test successful"')

  await page.waitForFunction(
    () => {
      const content = document.querySelector('.xterm-screen')?.textContent || ''
      return content.includes('V2 Async test successful')
    },
    { timeout: TIMEOUTS.CONNECTION }
  )
}

test.describe('V2 Async/Await Modal Login Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
  })

  test('should handle async connect with valid credentials (V2)', async ({ page }) => {
    // Fill in the form
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)

    // Click connect and verify async operation
    await page.click('button:has-text("Connect")')

    // Verify successful async connection with V2
    await waitForV2Connection(page)

    // Verify terminal functionality with async operations
    await verifyV2TerminalFunctionality(page, TEST_CONFIG.validUsername)
  })

  test('should handle async authentication error properly (V2)', async ({ page }) => {
    // Fill in invalid credentials
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.invalidUsername)
    await page.fill('[name="password"]', TEST_CONFIG.invalidPassword)

    // Attempt async authentication
    await page.click('button:has-text("Connect")')

    // V2 should handle async auth errors gracefully
    const possibleErrors = [
      page.locator('text=/Authentication failed/'),
      page.locator('text=/Invalid credentials/'),
      page.locator('text=/All authentication methods failed/'),
      page.locator('[role="status"]').filter({ hasText: /failed/i })
    ]

    let errorFound = false
    for (const errorLocator of possibleErrors) {
      try {
        await expect(errorLocator.first()).toBeVisible({ timeout: TIMEOUTS.DEFAULT })
        errorFound = true
        break
      } catch {
        continue
      }
    }

    expect(errorFound).toBeTruthy()

    // Form should remain available for retry
    await expect(page.locator('[name="username"]')).toBeVisible()
  })

  test('should handle async connection error for non-existent host (V2)', async ({ page }) => {
    // Fill in non-existent host
    await page.fill('[name="host"]', TEST_CONFIG.nonExistentHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)

    // Attempt async connection
    await page.click('button:has-text("Connect")')

    // V2 should handle network errors asynchronously
    await expect(
      page.locator('text=/Authentication failed|Connection failed|ENOTFOUND|getaddrinfo/').first()
    ).toBeVisible({ timeout: TIMEOUTS.DEFAULT })
  })

  test('should handle async shell creation and terminal operations (V2)', async ({ page }) => {
    // Connect first
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    await page.click('button:has-text("Connect")')

    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await waitForV2Prompt(page)

    // Test multiple async terminal operations
    const commands = [
      'pwd',
      'whoami',
      'echo "async test 1"',
      'echo "async test 2"',
      'date'
    ]

    for (const command of commands) {
      await executeV2Command(page, command)

      // Wait for each command to complete
      await page.waitForFunction(
        (cmd) => {
          const content = document.querySelector('.xterm-screen')?.textContent || ''
          // For echo commands, look for the output
          if (cmd.startsWith('echo ')) {
            const expectedOutput = cmd.match(/"([^"]+)"/)?.[1]
            return expectedOutput ? content.includes(expectedOutput) : true
          }
          return true
        },
        command,
        { timeout: TIMEOUTS.SHORT_WAIT * 2 }
      )
    }

    // Verify all commands executed
    const finalContent = await page.evaluate(() => document.querySelector('.xterm-screen')?.textContent || '')
    expect(finalContent).toContain('async test 1')
    expect(finalContent).toContain('async test 2')
  })

  test('should handle terminal resize with async operations (V2)', async ({ page }) => {
    // Connect first
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    await page.click('button:has-text("Connect")')

    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await waitForV2Prompt(page)

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
        const content = document.querySelector('.xterm-screen')?.textContent || ''
        return content.includes('resize test')
      },
      { timeout: TIMEOUTS.CONNECTION }
    )

    const content = await page.evaluate(() => document.querySelector('.xterm-screen')?.textContent || '')
    expect(content).toContain('resize test')
  })
})

test.describe('V2 Async/Await HTTP Basic Authentication', () => {
  test('should handle async auto-connect with valid Basic Auth (V2)', async ({ page }) => {
    // Navigate with Basic Auth credentials
    const basicAuth = `${TEST_CONFIG.validUsername}:${TEST_CONFIG.validPassword}`
    const baseUrlWithAuth = TEST_CONFIG.baseUrl.replace('://', `://${basicAuth}@`)
    const url = `${baseUrlWithAuth}/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`

    console.log('V2 Basic Auth URL:', url)
    await page.goto(url)

    // V2 should handle async auto-connection
    await waitForV2Connection(page)

    // Verify terminal functionality
    await verifyV2TerminalFunctionality(page, TEST_CONFIG.validUsername)
  })

  test('should handle async auth failure with invalid Basic Auth (V2)', async ({ page }) => {
    // Navigate with invalid Basic Auth credentials
    const badAuth = `${TEST_CONFIG.invalidUsername}:${TEST_CONFIG.invalidPassword}`
    const baseUrlWithAuth = TEST_CONFIG.baseUrl.replace('://', `://${badAuth}@`)
    const url = `${baseUrlWithAuth}/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`

    // Expect navigation to fail with 401
    const response = await page.goto(url, { waitUntil: 'commit' })

    expect(response?.status()).toBe(401)
    const wwwAuthHeader = response?.headers()['www-authenticate']
    expect(wwwAuthHeader).toContain('Basic')
  })

  test('should return 502 for async connection with Basic Auth to non-existent host (V2)', async ({ page }) => {
    // Navigate with Basic Auth to non-existent host
    const basicAuth = `${TEST_CONFIG.validUsername}:${TEST_CONFIG.validPassword}`
    const baseUrlWithAuth = TEST_CONFIG.baseUrl.replace('://', `://${basicAuth}@`)
    const url = `${baseUrlWithAuth}/ssh/host/${TEST_CONFIG.nonExistentHost}?port=${TEST_CONFIG.sshPort}`

    // Expect 502 for network connectivity issues
    const response = await page.goto(url, { waitUntil: 'commit' })

    expect(response?.status()).toBe(502)
    const responseText = await response?.text()
    expect(responseText).toContain('Bad Gateway')
  })

  test('should handle multiple async commands with Basic Auth session (V2)', async ({ page }) => {
    // Navigate with Basic Auth credentials
    const basicAuth = `${TEST_CONFIG.validUsername}:${TEST_CONFIG.validPassword}`
    const baseUrlWithAuth = TEST_CONFIG.baseUrl.replace('://', `://${basicAuth}@`)
    const url = `${baseUrlWithAuth}/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`
    await page.goto(url)

    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await waitForV2Prompt(page)

    // Execute multiple async commands
    const commands = [
      { cmd: 'pwd', expect: '/home/testuser' },
      { cmd: 'ls -la', expect: '.ssh' },
      { cmd: 'uname -a', expect: 'Linux' }
    ]

    for (const { cmd, expect: expectedText } of commands) {
      await executeV2Command(page, cmd)

      await page.waitForFunction(
        (expected) => {
          const content = document.querySelector('.xterm-screen')?.textContent || ''
          return content.includes(expected)
        },
        expectedText,
        { timeout: TIMEOUTS.CONNECTION }
      )
    }

    const finalContent = await page.evaluate(() => document.querySelector('.xterm-screen')?.textContent || '')
    expect(finalContent).toContain('/home/testuser')
    expect(finalContent).toContain('.ssh')
    expect(finalContent).toContain('Linux')
  })

  test('should handle async session persistence with Basic Auth (V2)', async ({ page }) => {
    const basicAuth = `${TEST_CONFIG.validUsername}:${TEST_CONFIG.validPassword}`
    const baseUrlWithAuth = TEST_CONFIG.baseUrl.replace('://', `://${basicAuth}@`)
    const url = `${baseUrlWithAuth}/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`
    await page.goto(url)

    await waitForV2Connection(page)
    await waitForV2Terminal(page)
    await waitForV2Prompt(page)

    // Create a test file to verify session persistence
    const testFile = `v2_session_test_${Date.now()}.txt`
    await executeV2Command(page, `echo "V2 session persistence" > ${testFile}`)

    // Verify file was created
    await executeV2Command(page, `cat ${testFile}`)

    await page.waitForFunction(
      () => {
        const content = document.querySelector('.xterm-screen')?.textContent || ''
        return content.includes('V2 session persistence')
      },
      { timeout: TIMEOUTS.CONNECTION }
    )

    // Clean up
    await executeV2Command(page, `rm ${testFile}`)

    const content = await page.evaluate(() => document.querySelector('.xterm-screen')?.textContent || '')
    expect(content).toContain('V2 session persistence')
  })
})

test.describe('V2 Async Error Recovery and Edge Cases', () => {
  test('should handle async timeout gracefully (V2)', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)

    // Fill form with very slow/unresponsive host to test timeout
    await page.fill('[name="host"]', '192.0.2.1') // TEST-NET-1 (should not respond)
    await page.fill('[name="port"]', '22')
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)

    await page.click('button:has-text("Connect")')

    // V2 should handle timeout errors gracefully
    await expect(
      page.locator('text=/Authentication failed|Connection failed|timeout|ETIMEDOUT/').first()
    ).toBeVisible({ timeout: TIMEOUTS.TEST_EXTENDED })

    // Form should still be usable
    await expect(page.locator('[name="username"]')).toBeVisible()
  })
})