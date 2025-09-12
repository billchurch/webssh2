/**
 * Debug Event Flow Test
 * 
 * This test captures both client-side and server-side debug logs
 * to map out the complete event flow between webssh2_client and webssh2 server
 */

import { test, expect } from '@playwright/test'

const TEST_CONFIG = {
  baseUrl: 'http://localhost:2222',
  clientUrl: 'http://localhost:3000', // webssh2_client dev server
  sshHost: 'localhost',
  sshPort: '2244',
  validUsername: 'testuser',
  validPassword: 'testpassword',
}

test.describe('Event Flow Analysis', () => {
  test('map client-server event flow during authentication', async ({ page }) => {
    // Go directly to webssh2 server and enable debug logging there
    await page.goto(TEST_CONFIG.baseUrl + '/ssh')
    
    // Set localStorage.debug to capture all debug messages on the webssh2 client
    await page.evaluate(() => {
      localStorage.debug = '*'
      // Also enable specific webssh2 debug namespaces
      localStorage.setItem('debug', 'webssh2*,socket.io*')
    })
    
    // Capture console logs from client
    const clientLogs: Array<{timestamp: string, type: string, level: string, text: string}> = []
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'debug') {
        clientLogs.push({
          timestamp: new Date().toISOString(),
          type: 'CLIENT',
          level: msg.type(),
          text: msg.text()
        })
      }
    })
    
    // Reload to apply debug settings
    await page.reload()
    await page.waitForTimeout(1000)
    
    console.log('=== STARTING EVENT FLOW CAPTURE ===')
    console.log('Server URL:', TEST_CONFIG.baseUrl)
    console.log('Note: Server debug logs available in background process')
    console.log('')
    
    // Fill in SSH connection form
    console.log('🔧 Filling SSH connection form...')
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    
    console.log('🔘 Clicking Connect button')
    await page.click('button:has-text("Connect")')
    
    // Wait for connection to complete
    await page.waitForTimeout(5000)
    
    // Check for connection status
    try {
      await page.waitForSelector('text=Connected', { timeout: 8000 })
      console.log('✅ Connection established')
    } catch (e) {
      console.log('❌ Connection may have failed or timed out')
    }
    
    // Execute a simple command to see data flow
    try {
      const terminal = page.locator('.xterm-helper-textarea')
      if (await terminal.isVisible({ timeout: 3000 })) {
        console.log('💻 Executing test command: whoami')
        await terminal.click()
        await page.keyboard.type('whoami')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(2000)
        
        console.log('💻 Executing second command: echo "Event flow test"')
        await page.keyboard.type('echo "Event flow test"')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(2000)
      }
    } catch (e) {
      console.log('⚠️ Terminal interaction failed:', e.message)
    }
    
    // Output captured client logs
    console.log('\n=== CLIENT-SIDE EVENT LOGS ===')
    clientLogs.forEach(log => {
      console.log(`[${log.timestamp}] ${log.type}: ${log.text}`)
    })
    
    console.log('\n=== EVENT FLOW CAPTURE COMPLETE ===')
    console.log(`Captured ${clientLogs.length} client-side log entries`)
  })
  
  test('capture server-side events during connection', async ({ page }) => {
    // This test focuses on server-side event capture
    // We'll use the existing webssh2 server with debug enabled
    
    console.log('=== SERVER-SIDE EVENT CAPTURE ===')
    console.log('Note: Run webssh2 server with DEBUG=webssh2:* for full server logs')
    
    // Connect to webssh2 server directly
    await page.goto(`${TEST_CONFIG.baseUrl}/ssh`)
    
    // Fill form and connect
    await page.fill('[name="host"]', TEST_CONFIG.sshHost)
    await page.fill('[name="port"]', TEST_CONFIG.sshPort)
    await page.fill('[name="username"]', TEST_CONFIG.validUsername)
    await page.fill('[name="password"]', TEST_CONFIG.validPassword)
    
    console.log('🔘 Initiating server connection')
    await page.click('button:has-text("Connect")')
    
    // Wait for connection
    await page.waitForTimeout(3000)
    
    // Check for connection status
    try {
      await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 })
      console.log('✅ Server connection established')
    } catch (e) {
      console.log('❌ Server connection failed')
    }
    
    console.log('=== SERVER EVENT CAPTURE COMPLETE ===')
  })
})