/**
 * Basic WebSocket Tests for WebSSH2
 * 
 * Simple tests to verify WebSocket functionality
 */

import { test, expect } from '@playwright/test'
import { TEST_CONFIG, TIMEOUTS, TERMINAL, waitForPrompt, executeCommand } from './constants.js'

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
    
    console.log('✓ WebSocket connection established successfully')
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
      const terminalContent = document.querySelector('.xterm-rows')?.textContent || ''
      return terminalContent.includes('WebSocket Test OK')
    }, { timeout: TIMEOUTS.CONNECTION })
    
    console.log('✓ Command execution over WebSocket successful')
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
    
    // Should show disconnected state
    await page.waitForFunction(() => {
      const terminalContent = document.querySelector('.xterm-rows')?.textContent || ''
      return terminalContent.includes('DISCONNECTED') || 
             terminalContent.includes('Connection closed') ||
             terminalContent.includes('closed')
    }, { timeout: TIMEOUTS.CONNECTION })
    
    console.log('✓ Disconnection handled gracefully')
  })

  test('should measure WebSocket latency', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    await page.click('button:has-text("Connect")')
    
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
    
    const connectionTime = Date.now() - startTime
    console.log(`✓ WebSocket connection established in ${connectionTime}ms`)
    
    // Connection should be fast
    expect(connectionTime).toBeLessThan(3000)
  })
})