/**
 * WebSocket Authentication Tests for WebSSH2
 *
 * Tests both interactive authentication and Basic Auth scenarios
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
  invalidPort: '9999',
}
// Helper function to wait for terminal prompt
async function waitForPrompt(page, timeout = 10000) {
  // Wait for the prompt in the actual terminal content, not the measure element
  await page.waitForFunction(
    () => {
      const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
      return /[$#]\s*$/.test(terminalContent)
    },
    { timeout }
  )
}
// Helper function to execute command in terminal
async function executeCommand(page, command) {
  const terminal = page.getByRole('textbox', { name: 'Terminal input' })
  await terminal.fill(command)
  await terminal.press('Enter')
  await page.waitForTimeout(500) // Wait for command execution
}
test.describe('WebSocket Interactive Authentication', () => {
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
    // Verify connection
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    await expect(
      page.locator(`text=ssh://${TEST_CONFIG.sshHost}:${TEST_CONFIG.sshPort}`)
    ).toBeVisible()
    // Verify terminal is functional
    await waitForPrompt(page)
    await executeCommand(page, 'whoami')
    await expect(page.locator(`text=${TEST_CONFIG.validUsername}`)).toBeVisible()
  })
  test('should show error with invalid credentials', async ({ page }) => {
    // Fill in the form with invalid credentials
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.invalidUsername)
    await page.fill('[name="password"]', TEST_CONFIG.invalidPassword)
    // Click connect
    await page.click('button:has-text("Connect")')
    // Verify error message
    await expect(
      page.locator('text=Authentication failed: All authentication methods failed')
    ).toBeVisible({ timeout: 10000 })
    // Verify form is still visible for retry
    await expect(page.locator('[name="username"]')).toBeVisible()
  })
  test('should show connection error for non-existent host', async ({ page }) => {
    // Fill in the form with non-existent host
    await page.fill('[name="host"]', TEST_CONFIG.nonExistentHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    // Click connect
    await page.click('button:has-text("Connect")')
    // Verify connection error message
    await expect(page.locator('text=/Connection failed.*ENOTFOUND/')).toBeVisible({
      timeout: 10000,
    })
  })
  test('should show connection error for wrong port', async ({ page }) => {
    // Fill in the form with wrong port
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.invalidPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    // Click connect
    await page.click('button:has-text("Connect")')
    // Verify connection error message
    await expect(page.locator('text=/Connection failed.*ECONNREFUSED/')).toBeVisible({
      timeout: 10000,
    })
  })
  test('should handle page refresh gracefully', async ({ page }) => {
    // First, establish a connection
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    await page.click('button:has-text("Connect")')
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
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
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    await waitForPrompt(page)
  })
})
test.describe('WebSocket Basic Authentication', () => {
  test('should connect automatically with valid Basic Auth credentials', async ({ page }) => {
    // Navigate with Basic Auth credentials
    const url = `http://${TEST_CONFIG.validUsername}:${TEST_CONFIG.validPassword}@localhost:2222/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`
    await page.goto(url)
    // Verify automatic connection
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    await expect(
      page.locator(`text=ssh://${TEST_CONFIG.sshHost}:${TEST_CONFIG.sshPort}`)
    ).toBeVisible()
    // Verify terminal is functional
    await waitForPrompt(page)
    await executeCommand(page, 'echo "Basic Auth works!"')
    await expect(page.locator('text=Basic Auth works!')).toBeVisible()
  })
  test('should fail and show login form with invalid Basic Auth credentials', async ({ page }) => {
    // Navigate with invalid Basic Auth credentials
    const url = `http://${TEST_CONFIG.invalidUsername}:${TEST_CONFIG.invalidPassword}@localhost:2222/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`
    await page.goto(url)
    // Wait for authentication to fail
    await page.waitForTimeout(3000)
    // Verify error message
    await expect(
      page.locator('text=Authentication failed: All authentication methods failed')
    ).toBeVisible({ timeout: 10000 })
    // Verify login form appears
    await expect(page.locator('[name="username"]')).toBeVisible()
    await expect(page.locator('[name="host"]')).toHaveValue(TEST_CONFIG.sshHost)
    await expect(page.locator('[name="port"]')).toHaveValue(TEST_CONFIG.sshPort)
  })
  test('should handle Basic Auth with non-existent host', async ({ page }) => {
    // Navigate with Basic Auth to non-existent host
    const url = `http://${TEST_CONFIG.validUsername}:${TEST_CONFIG.validPassword}@localhost:2222/ssh/host/${TEST_CONFIG.nonExistentHost}?port=${TEST_CONFIG.sshPort}`
    await page.goto(url)
    // Wait for connection attempt
    await page.waitForTimeout(3000)
    // Verify connection error
    await expect(page.locator('text=/Connection failed.*ENOTFOUND/')).toBeVisible({
      timeout: 10000,
    })
  })
  test('should execute multiple commands with Basic Auth session', async ({ page }) => {
    // Navigate with Basic Auth credentials
    const url = `http://${TEST_CONFIG.validUsername}:${TEST_CONFIG.validPassword}@localhost:2222/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`
    await page.goto(url)
    // Wait for connection
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    await waitForPrompt(page)
    // Execute multiple commands
    await executeCommand(page, 'pwd')
    await expect(page.locator('text=/home/testuser')).toBeVisible()
    await executeCommand(page, 'ls -la')
    await expect(page.locator('text=.ssh')).toBeVisible()
    await executeCommand(page, 'uname -a')
    await expect(page.locator('text=Linux')).toBeVisible()
  })
})
test.describe('WebSocket Connection Resilience', () => {
  test('should handle rapid connect/disconnect cycles', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
    // Connect and disconnect multiple times
    for (let i = 0; i < 3; i++) {
      // Fill and connect
      await page.fill('[name="host"]', TEST_CONFIG.sshHost)
      await page.fill('[name="port"]', TEST_CONFIG.sshPort)
      await page.fill('[name="username"]', TEST_CONFIG.validUsername)
      await page.fill('[name="password"]', TEST_CONFIG.validPassword)
      await page.click('button:has-text("Connect")')
      // Verify connection
      await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
      // Refresh to disconnect
      await page.evaluate(() => {
        window.onbeforeunload = null
      })
      await page.reload()
      // Verify disconnection
      await expect(page.locator('[name="username"]')).toBeVisible()
    }
  })
  test('should maintain terminal state during session', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
    // Connect
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    await page.click('button:has-text("Connect")')
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    await waitForPrompt(page)
    // Create a file
    const testFile = `test_${Date.now()}.txt`
    await executeCommand(page, `echo "test content" > ${testFile}`)
    // Verify file exists
    await executeCommand(page, `cat ${testFile}`)
    await expect(page.locator('text=test content')).toBeVisible()
    // Clean up
    await executeCommand(page, `rm ${testFile}`)
    await executeCommand(page, `ls ${testFile}`)
    await expect(page.locator('text=No such file')).toBeVisible()
  })
})
//# sourceMappingURL=websocket-auth.test.js.map
