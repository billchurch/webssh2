/**
 * Debug Basic Auth Event Flow Test
 * 
 * This test captures both client-side and server-side debug logs
 * for the Basic Auth flow using /ssh/host/:host route
 */

import { test, expect } from '@playwright/test'
import { BASE_URL, SSH_HOST, SSH_PORT, USERNAME, PASSWORD, TIMEOUTS } from './constants.js'

test.describe('Basic Auth Event Flow Analysis', () => {
  test('map Basic Auth auto-connect event flow', async ({ page }) => {
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
    
    console.log('=== STARTING BASIC AUTH FLOW CAPTURE ===')
    console.log('Server URL:', BASE_URL)
    console.log('Basic Auth URL pattern: /ssh/host/:host')
    console.log('')
    
    // Navigate with Basic Auth credentials embedded in URL
    const basicAuthUrl = `http://${USERNAME}:${PASSWORD}@localhost:2222/ssh/host/${SSH_HOST}?port=${SSH_PORT}`
    console.log('🔗 Navigating to Basic Auth URL:', basicAuthUrl.replace(PASSWORD, '****'))
    
    // Set debug before navigation
    await page.goto(BASE_URL + '/ssh')
    await page.evaluate(() => {
      localStorage.debug = '*'
      localStorage.setItem('debug', 'webssh2*,socket.io*')
    })
    
    // Now navigate to the Basic Auth URL
    await page.goto(basicAuthUrl)
    
    // Wait for auto-connection to complete
    await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)
    
    // Check for connection status
    try {
      await page.waitForSelector('text=Connected', { timeout: TIMEOUTS.ACTION })
      console.log('✅ Basic Auth auto-connection established')
    } catch (e) {
      console.log('❌ Basic Auth connection may have failed or timed out')
    }
    
    // Execute a test command to verify terminal functionality
    try {
      const terminal = page.locator('.xterm-helper-textarea')
      if (await terminal.isVisible({ timeout: TIMEOUTS.MEDIUM_WAIT })) {
        console.log('💻 Executing test command via Basic Auth session: whoami')
        await terminal.click()
        await page.keyboard.type('whoami')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)
        
        console.log('💻 Executing second command: echo "Basic Auth test successful"')
        await page.keyboard.type('echo "Basic Auth test successful"')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)
      }
    } catch (e) {
      console.log('⚠️ Terminal interaction failed:', e.message)
    }
    
    // Output captured client logs
    console.log('\n=== CLIENT-SIDE EVENT LOGS (Basic Auth) ===')
    clientLogs.forEach(log => {
      console.log(`[${log.timestamp}] ${log.type}: ${log.text}`)
    })
    
    console.log('\n=== BASIC AUTH EVENT FLOW CAPTURE COMPLETE ===')
    console.log(`Captured ${clientLogs.length} client-side log entries`)
  })
  
  test('map Basic Auth with query parameters', async ({ page }) => {
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
    
    console.log('=== BASIC AUTH WITH QUERY PARAMETERS ===')
    
    // Set debug
    await page.goto(BASE_URL + '/ssh')
    await page.evaluate(() => {
      localStorage.debug = 'webssh2*,socket.io*'
    })
    
    // Basic Auth URL with additional parameters
    const paramUrl = `http://${USERNAME}:${PASSWORD}@localhost:2222/ssh/host/${SSH_HOST}?port=${SSH_PORT}&sshterm=xterm-256color&rows=50&cols=120`
    console.log('🔗 Basic Auth with params:', paramUrl.replace(PASSWORD, '****'))
    
    await page.goto(paramUrl)
    await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)
    
    try {
      await page.waitForSelector('text=Connected', { timeout: TIMEOUTS.ACTION })
      console.log('✅ Basic Auth with parameters successful')
      
      // Test TERM environment variable
      const terminal = page.locator('.xterm-helper-textarea')
      if (await terminal.isVisible({ timeout: TIMEOUTS.MEDIUM_WAIT })) {
        console.log('💻 Testing TERM variable: echo $TERM')
        await terminal.click()
        await page.keyboard.type('echo $TERM')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)
      }
    } catch (e) {
      console.log('❌ Basic Auth with parameters failed')
    }
    
    console.log('\n=== CLIENT LOGS (Basic Auth + Params) ===')
    clientLogs.slice(-10).forEach(log => {
      console.log(`[${log.timestamp}] ${log.type}: ${log.text}`)
    })
  })
})