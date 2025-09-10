/**
 * Async/Await Authentication Tests for WebSSH2
 * 
 * Tests both modal login and HTTP Basic Auth with the newly refactored async/await patterns
 * Ensures proper error handling and session management with async operations
 * 
 * Requires Docker test SSH server to be running:
 * docker run -d --name webssh2-test-ssh -p 4444:22 \
 *   -e SSH_USER=testuser -e SSH_PASSWORD=testpassword \
 *   ghcr.io/billchurch/ssh_test:alpine
 */

import { test, expect } from '@playwright/test'

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:2222',
  sshHost: 'localhost',
  sshPort: '4444',
  validUsername: 'testuser',
  validPassword: 'testpassword',
  invalidUsername: 'wronguser',
  invalidPassword: 'wrongpass',
  nonExistentHost: 'nonexistent.invalid.host',
  invalidPort: '9999'
}

// Helper function to wait for terminal prompt
async function waitForPrompt(page, timeout = 10000) {
  await page.waitForFunction(() => {
    const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
    return /[$#]\s*$/.test(terminalContent)
  }, { timeout })
}

// Helper function to execute command in terminal
async function executeCommand(page, command) {
  const terminal = page.getByRole('textbox', { name: 'Terminal input' })
  await terminal.fill(command)
  await terminal.press('Enter')
  await page.waitForTimeout(500)
}

// Helper to check if terminal is functional
async function verifyTerminalFunctionality(page, username) {
  await waitForPrompt(page)
  await executeCommand(page, 'whoami')
  await expect(page.locator(`text=${username}`)).toBeVisible({ timeout: 5000 })
  await executeCommand(page, 'echo "Async test successful"')
  await expect(page.locator('text=Async test successful')).toBeVisible({ timeout: 5000 })
}

test.describe('Async/Await Modal Login Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
  })

  test('should handle async connect with valid credentials', async ({ page }) => {
    // Fill in the form
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    
    // Click connect and verify async operation
    await page.click('button:has-text("Connect")')
    
    // Verify successful async connection
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    await expect(page.locator(`text=ssh://${TEST_CONFIG.sshHost}:${TEST_CONFIG.sshPort}`)).toBeVisible()
    
    // Verify terminal functionality with async operations
    await verifyTerminalFunctionality(page, TEST_CONFIG.validUsername)
  })

  test('should handle async authentication error properly', async ({ page }) => {
    // Fill in invalid credentials
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.invalidUsername)
    await page.fill('[name="password"]', TEST_CONFIG.invalidPassword)
    
    // Click connect
    await page.click('button:has-text("Connect")')
    
    // Verify async error handling
    await expect(page.locator('text=Authentication failed: All authentication methods failed')).toBeVisible({ timeout: 10000 })
    
    // Verify form is still available for retry
    await expect(page.locator('[name="username"]')).toBeVisible()
    await expect(page.locator('[name="password"]')).toBeVisible()
  })

  test('should handle async connection error for non-existent host', async ({ page }) => {
    // Fill in non-existent host
    await page.fill('[name="host"]', TEST_CONFIG.nonExistentHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    
    // Click connect
    await page.click('button:has-text("Connect")')
    
    // Verify async error handling for connection failure
    await expect(page.locator('text=/Connection failed.*ENOTFOUND/')).toBeVisible({ timeout: 10000 })
  })

  test('should handle async shell creation and terminal operations', async ({ page }) => {
    // Connect successfully
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    await page.click('button:has-text("Connect")')
    
    // Wait for async shell creation
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    await waitForPrompt(page)
    
    // Test multiple async terminal operations
    await executeCommand(page, 'pwd')
    await expect(page.locator('text=/home')).toBeVisible({ timeout: 5000 })
    
    await executeCommand(page, 'ls -la')
    await expect(page.locator('text=total')).toBeVisible({ timeout: 5000 })
    
    await executeCommand(page, 'date')
    await expect(page.locator('text=UTC')).toBeVisible({ timeout: 5000 })
  })

  test('should handle terminal resize with async operations', async ({ page }) => {
    // Connect successfully
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    await page.click('button:has-text("Connect")')
    
    // Wait for connection
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    await waitForPrompt(page)
    
    // Resize the window and verify terminal adapts
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.waitForTimeout(500)
    
    // Execute command to verify terminal still works after resize
    await executeCommand(page, 'echo "Resize test"')
    await expect(page.locator('text=Resize test')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Async/Await HTTP Basic Authentication', () => {
  test('should handle async auto-connect with valid Basic Auth', async ({ page }) => {
    // Navigate with Basic Auth credentials
    const url = `http://${TEST_CONFIG.validUsername}:${TEST_CONFIG.validPassword}@localhost:2222/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`
    await page.goto(url)
    
    // Verify async auto-connection
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    await expect(page.locator(`text=ssh://${TEST_CONFIG.sshHost}:${TEST_CONFIG.sshPort}`)).toBeVisible()
    
    // Verify terminal functionality
    await verifyTerminalFunctionality(page, TEST_CONFIG.validUsername)
  })

  test('should handle async auth failure with invalid Basic Auth', async ({ page }) => {
    // Navigate with invalid Basic Auth credentials
    const url = `http://${TEST_CONFIG.invalidUsername}:${TEST_CONFIG.invalidPassword}@localhost:2222/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`
    
    // Handle the auth challenge
    page.on('response', response => {
      if (response.status() === 401) {
        console.log('Received 401 Unauthorized as expected')
      }
    })
    
    await page.goto(url)
    
    // Should receive authentication challenge
    await expect(page.locator('text=/Authentication required|401/')).toBeVisible({ timeout: 10000 })
  })

  test('should handle async connection error with Basic Auth to non-existent host', async ({ page }) => {
    // Navigate with Basic Auth to non-existent host
    const url = `http://${TEST_CONFIG.validUsername}:${TEST_CONFIG.validPassword}@localhost:2222/ssh/host/${TEST_CONFIG.nonExistentHost}?port=${TEST_CONFIG.sshPort}`
    await page.goto(url)
    
    // Wait for async connection attempt
    await page.waitForTimeout(2000)
    
    // Verify async error handling
    await expect(page.locator('text=/Connection failed|Error|ENOTFOUND/')).toBeVisible({ timeout: 15000 })
  })

  test('should handle multiple async commands with Basic Auth session', async ({ page }) => {
    // Navigate with Basic Auth
    const url = `http://${TEST_CONFIG.validUsername}:${TEST_CONFIG.validPassword}@localhost:2222/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`
    await page.goto(url)
    
    // Wait for async connection
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    await waitForPrompt(page)
    
    // Execute multiple async commands
    const commands = [
      { cmd: 'uname -a', expect: 'Linux' },
      { cmd: 'echo $USER', expect: TEST_CONFIG.validUsername },
      { cmd: 'cat /etc/os-release | head -1', expect: 'NAME' },
      { cmd: 'ps aux | head -1', expect: 'PID' }
    ]
    
    for (const { cmd, expect: expectedText } of commands) {
      await executeCommand(page, cmd)
      await expect(page.locator(`text=/${expectedText}/`)).toBeVisible({ timeout: 5000 })
    }
  })

  test('should handle async session persistence with Basic Auth', async ({ page }) => {
    // First connection with Basic Auth
    const url = `http://${TEST_CONFIG.validUsername}:${TEST_CONFIG.validPassword}@localhost:2222/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`
    await page.goto(url)
    
    // Wait for async connection
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    await waitForPrompt(page)
    
    // Create a file to verify session persistence
    await executeCommand(page, 'echo "test async session" > /tmp/async_test.txt')
    await executeCommand(page, 'cat /tmp/async_test.txt')
    await expect(page.locator('text=test async session')).toBeVisible({ timeout: 5000 })
    
    // Refresh the page (simulating reconnection)
    await page.reload()
    
    // Should auto-reconnect with stored session
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    await waitForPrompt(page)
    
    // Verify file still exists (same session)
    await executeCommand(page, 'cat /tmp/async_test.txt')
    await expect(page.locator('text=test async session')).toBeVisible({ timeout: 5000 })
    
    // Cleanup
    await executeCommand(page, 'rm /tmp/async_test.txt')
  })
})

test.describe('Async Error Recovery and Edge Cases', () => {
  test('should handle async timeout gracefully', async ({ page }) => {
    // Use a host that will cause timeout
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
    await page.fill('[name="host"]', '240.0.0.0') // Non-routable IP
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    
    // Click connect
    await page.click('button:has-text("Connect")')
    
    // Should show timeout error
    await expect(page.locator('text=/timeout|timed out|Connection failed/i')).toBeVisible({ timeout: 30000 })
  })

  test('should handle rapid async reconnection attempts', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
    
    // First connection attempt with wrong password
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.invalidPassword)
    await page.click('button:has-text("Connect")')
    
    // Wait for error
    await expect(page.locator('text=Authentication failed')).toBeVisible({ timeout: 10000 })
    
    // Immediately retry with correct password
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    await page.click('button:has-text("Connect")')
    
    // Should connect successfully
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    await verifyTerminalFunctionality(page, TEST_CONFIG.validUsername)
  })

  test('should handle async keyboard-interactive auth prompts', async ({ page }) => {
    // This test would require a server configured for keyboard-interactive auth
    // For now, we'll test that the UI can handle such prompts
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    
    // Don't fill password to potentially trigger keyboard-interactive
    await page.click('button:has-text("Connect")')
    
    // Should either show error or prompt for password
    const result = await Promise.race([
      page.locator('text=/Authentication failed|Password|password/i').waitFor({ timeout: 10000 }).then(() => true),
      page.waitForTimeout(10000).then(() => false)
    ])
    
    expect(result).toBeTruthy()
  })
})