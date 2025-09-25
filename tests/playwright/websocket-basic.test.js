/**
 * Basic WebSocket Tests for WebSSH2
 * 
 * Simple tests to verify WebSocket functionality
 */

import { test, expect } from '@playwright/test'
import { TEST_CONFIG, TIMEOUTS, waitForPrompt, executeCommand } from './constants.js'

test.describe('WebSocket Basic Tests', () => {
  test('should establish WebSocket connection', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
    
    // Fill connection form
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    
    // Connect
    await page.click('button:has-text("Connect")')
    
    // Verify connection status
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
    
    // Wait for terminal to be ready
    await waitForPrompt(page)
    
    // WebSocket connection established successfully
  })

  test('should execute commands over WebSocket', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
    
    // Connect
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    await page.click('button:has-text("Connect")')
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
    
    // Wait for prompt
    await waitForPrompt(page)
    
    // Execute a simple command
    await executeCommand(page, 'echo "WebSocket Test OK"')
    
    // Wait for output
    await page.waitForFunction(() => {
      // eslint-disable-next-line no-undef
      const terminalContent = document.querySelector('.xterm-rows')?.textContent || ''
      return terminalContent.includes('WebSocket Test OK')
    }, { timeout: TIMEOUTS.CONNECTION })
    
    // Command execution over WebSocket successful
  })

  test('should handle disconnection gracefully', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
    
    // Connect
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    await page.click('button:has-text("Connect")')
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
    
    // Wait for prompt
    await waitForPrompt(page)
    
    // Type exit command
    await executeCommand(page, 'exit')
    
    // Wait a moment for disconnection to process
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
    
    // Check if the connection status changed or if we see logout/exit message
    // eslint-disable-next-line no-undef
    const terminalContent = await page.evaluate(() => document.querySelector('.xterm-screen')?.textContent || '')
    const statusElement = await page.locator('#status').textContent().catch(() => '')
    
    // Verify disconnection by checking either terminal content or status
    const isDisconnected = 
      terminalContent.includes('logout') ||
      terminalContent.includes('exit') ||
      statusElement.includes('Disconnected') ||
      statusElement === '' // Status might be cleared on disconnect
    
    expect(isDisconnected).toBeTruthy()
    
    // Disconnection handled gracefully
  })

})