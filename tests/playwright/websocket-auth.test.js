/**
 * WebSocket Authentication Tests for WebSSH2
 * 
 * Tests both interactive authentication and Basic Auth scenarios
 */

import { test, expect } from '@playwright/test'
import { TEST_CONFIG, TIMEOUTS, waitForPrompt, executeCommand } from './constants.js'

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
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
    await expect(page.locator(`text=ssh://${TEST_CONFIG.sshHost}:${TEST_CONFIG.sshPort}`)).toBeVisible()
    
    // Verify terminal is functional
    await waitForPrompt(page)
    await executeCommand(page, 'whoami')
    // Check that whoami output appears (use first() to avoid strict mode violations)
    await expect(page.locator(`text=${TEST_CONFIG.validUsername}`).first()).toBeVisible()
  })

  test('should show error with invalid credentials', async ({ page }) => {
    // Fill in the form with invalid credentials
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.invalidUsername)
    await page.fill('[name="password"]', TEST_CONFIG.invalidPassword)
    
    // Click connect
    await page.click('button:has-text("Connect")')
    
    // Verify error message appears - check for various possible auth error messages
    const errorMessageLocator = page.locator('text=/Authentication failed|SSH connection error|All authentication methods failed/')
    await expect(errorMessageLocator.first()).toBeVisible({ timeout: TIMEOUTS.DEFAULT })
    
    // Verify form is still visible for retry
    await expect(page.locator('[name="username"]')).toBeVisible()
  })

  test.skip('should show connection error for non-existent host', async ({ page }) => {
    // Fill in the form with non-existent host
    await page.fill('[name="host"]', TEST_CONFIG.nonExistentHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    
    // Click connect
    await page.click('button:has-text("Connect")')
    
    // Verify connection error message
    await expect(page.locator('text=/Authentication failed.*Connection failed|ENOTFOUND|getaddrinfo ENOTFOUND/').first()).toBeVisible({ timeout: TIMEOUTS.DEFAULT })
  })

  test('should show connection error for wrong port', async ({ page }) => {
    // Fill in the form with wrong port
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.invalidPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    
    // Click connect
    await page.click('button:has-text("Connect")')
    
    // Verify connection error message - looking for "Authentication failed:" in the footer
    await expect(page.locator('text=/Authentication failed/').first()).toBeVisible({ timeout: TIMEOUTS.DEFAULT })
  })

  test('should handle page refresh gracefully', async ({ page }) => {
    // First, establish a connection
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    await page.click('button:has-text("Connect")')
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
    
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
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
    await waitForPrompt(page)
  })
})

test.describe('WebSocket Basic Authentication', () => {
  test('should connect automatically with valid Basic Auth credentials', async ({ page }) => {
    // Navigate with Basic Auth credentials
    const basicAuth = `${TEST_CONFIG.validUsername}:${TEST_CONFIG.validPassword}`
    const url = `${TEST_CONFIG.baseUrl.replace('://', `://${basicAuth}@`)}/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`
    await page.goto(url)
    
    // Verify automatic connection
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
    await expect(page.locator(`text=ssh://${TEST_CONFIG.sshHost}:${TEST_CONFIG.sshPort}`)).toBeVisible()
    
    // Verify terminal is functional
    await waitForPrompt(page)
    await executeCommand(page, 'echo "Basic Auth works!"')
    await expect(page.locator('text=Basic Auth works!').first()).toBeVisible()
  })

  test('should return 401 for invalid Basic Auth credentials', async ({ page }) => {
    // Navigate with invalid Basic Auth credentials
    const badAuth = `${TEST_CONFIG.invalidUsername}:${TEST_CONFIG.invalidPassword}`
    const url = `${TEST_CONFIG.baseUrl.replace('://', `://${badAuth}@`)}/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`
    
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
    const url = `${TEST_CONFIG.baseUrl.replace('://', `://${basicAuth}@`)}/ssh/host/${TEST_CONFIG.nonExistentHost}?port=${TEST_CONFIG.sshPort}`
    
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
    const url = `${TEST_CONFIG.baseUrl.replace('://', `://${basicAuth}@`)}/ssh/host/${TEST_CONFIG.sshHost}?port=${TEST_CONFIG.sshPort}`
    await page.goto(url)
    
    // Wait for connection
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
    await waitForPrompt(page)
    
    // Execute multiple commands
    await executeCommand(page, 'pwd')
    await expect(page.locator('text=/home/testuser/').first()).toBeVisible()
    
    await executeCommand(page, 'ls -la')
    await expect(page.locator('text=.ssh').first()).toBeVisible()
    
    await executeCommand(page, 'uname -a')
    await expect(page.locator('text=Linux').first()).toBeVisible()
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
      await expect(page.locator('text=Connected')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
      
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
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
    await waitForPrompt(page)
    
    // Create a file
    const testFile = `test_${Date.now()}.txt`
    await executeCommand(page, `echo "test content" > ${testFile}`)
    
    // Verify file exists
    await executeCommand(page, `cat ${testFile}`)
    await expect(page.locator('text=test content').first()).toBeVisible()
    
    // Clean up
    await executeCommand(page, `rm ${testFile}`)
    await executeCommand(page, `ls ${testFile}`)
    await expect(page.locator('text=No such file')).toBeVisible()
  })
})
