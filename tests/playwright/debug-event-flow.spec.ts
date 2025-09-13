/**
 * Debug Event Flow Test
 * 
 * This test captures both client-side and server-side debug logs
 * to map out the complete event flow between webssh2_client and webssh2 server
 */

import { test, expect } from '@playwright/test'
import { BASE_URL, CLIENT_DEV_URL, SSH_HOST, SSH_PORT, USERNAME, PASSWORD, TIMEOUTS } from './constants.js'

test.describe('Event Flow Analysis', () => {
  test('map client-server event flow during authentication', async ({ page }) => {
    // Go directly to webssh2 server and enable debug logging there
    await page.goto(BASE_URL + '/ssh')
    
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
    await page.waitForTimeout(TIMEOUTS.SHORT_WAIT)
    
    console.log('=== STARTING EVENT FLOW CAPTURE ===')
    console.log('Server URL:', BASE_URL)
    console.log('Note: Server debug logs available in background process')
    console.log('')
    
    // Fill in SSH connection form
    console.log('🔧 Filling SSH connection form...')
    await page.fill('[name="host"]', SSH_HOST)
    await page.fill('[name="port"]', String(SSH_PORT))
    await page.fill('[name="username"]', USERNAME)
    await page.fill('[name="password"]', PASSWORD)
    
    console.log('🔘 Clicking Connect button')
    await page.click('button:has-text("Connect")')
    
    // Wait for connection to complete
    await page.waitForTimeout(TIMEOUTS.LONG_WAIT)
    
    // Check for connection status
    try {
      await page.waitForSelector('text=Connected', { timeout: TIMEOUTS.ACTION })
      console.log('✅ Connection established')
    } catch (e) {
      console.log('❌ Connection may have failed or timed out')
    }
    
    // Execute a simple command to see data flow
    try {
      const terminal = page.locator('.xterm-helper-textarea')
      if (await terminal.isVisible({ timeout: TIMEOUTS.MEDIUM_WAIT })) {
        console.log('💻 Executing test command: whoami')
        await terminal.click()
        await page.keyboard.type('whoami')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)
        
        console.log('💻 Executing second command: echo "Event flow test"')
        await page.keyboard.type('echo "Event flow test"')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)
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
    await page.goto(`${BASE_URL}/ssh`)
    
    // Fill form and connect
    await page.fill('[name="host"]', SSH_HOST)
    await page.fill('[name="port"]', String(SSH_PORT))
    await page.fill('[name="username"]', USERNAME)
    await page.fill('[name="password"]', PASSWORD)
    
    console.log('🔘 Initiating server connection')
    await page.click('button:has-text("Connect")')
    
    // Wait for connection
    await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)
    
    // Check for connection status
    try {
      await expect(page.locator('text=Connected')).toBeVisible({ timeout: TIMEOUTS.CONNECTION })
      console.log('✅ Server connection established')
    } catch (e) {
      console.log('❌ Server connection failed')
    }
    
    console.log('=== SERVER EVENT CAPTURE COMPLETE ===')
  })
})