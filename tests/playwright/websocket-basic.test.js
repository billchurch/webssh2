/**
 * Basic WebSocket Tests for WebSSH2
 * 
 * Simple tests to verify WebSocket functionality
 */

import { test, expect } from '@playwright/test'

const TEST_CONFIG = {
  baseUrl: 'http://localhost:2222',
  sshHost: 'localhost',
  sshPort: '2244',
  validUsername: 'testuser',
  validPassword: 'testpassword'
}

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
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    
    // Wait for terminal to be ready
    await page.waitForFunction(() => {
      const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
      return terminalContent.includes('$') || terminalContent.includes('#')
    }, { timeout: 10000 })
    
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
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    
    // Wait for prompt
    await page.waitForFunction(() => {
      const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
      return terminalContent.includes('$') || terminalContent.includes('#')
    }, { timeout: 10000 })
    
    // Execute a simple command
    const terminal = page.getByRole('textbox', { name: 'Terminal input' })
    await terminal.fill('echo "WebSocket Test OK"')
    await terminal.press('Enter')
    
    // Wait for output
    await page.waitForFunction(() => {
      const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
      return terminalContent.includes('WebSocket Test OK')
    }, { timeout: 5000 })
    
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
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    
    // Wait for prompt
    await page.waitForFunction(() => {
      const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
      return terminalContent.includes('$') || terminalContent.includes('#')
    }, { timeout: 10000 })
    
    // Type exit command
    const terminal = page.getByRole('textbox', { name: 'Terminal input' })
    await terminal.fill('exit')
    await terminal.press('Enter')
    
    // Should show disconnected state
    await page.waitForFunction(() => {
      const terminalContent = document.querySelector('.xterm-screen')?.textContent || ''
      return terminalContent.includes('DISCONNECTED') || 
             terminalContent.includes('Connection closed') ||
             terminalContent.includes('closed')
    }, { timeout: 5000 })
    
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
    
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
    
    const connectionTime = Date.now() - startTime
    console.log(`✓ WebSocket connection established in ${connectionTime}ms`)
    
    // Connection should be fast
    expect(connectionTime).toBeLessThan(3000)
  })
})