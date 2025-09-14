/**
 * Debug HTTP POST Authentication Flow Test
 * 
 * This test captures the HTTP POST flow to /ssh/host/:host route
 * similar to how the SSO BIG-IP APM example works
 */

import { test } from '@playwright/test'
import { BASE_URL, SSH_HOST, SSH_PORT, USERNAME, PASSWORD, TIMEOUTS } from '../constants.js'

test.describe('HTTP POST Authentication Flow Analysis', () => {
  test('map HTTP POST form-based authentication flow', async ({ page }) => {
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
    
    console.log('=== STARTING HTTP POST AUTH FLOW CAPTURE ===')
    console.log('Server URL:', BASE_URL)
    console.log('Testing HTTP POST to /ssh/host/:host')
    console.log('')
    
    // First navigate to set up debug logging
    await page.goto(BASE_URL + '/ssh')
    await page.evaluate(() => {
      localStorage.debug = '*'
      localStorage.setItem('debug', 'webssh2*,socket.io*')
    })
    
    // Create a simple HTML page with a form (like the BIG-IP APM example)
    const formHTML = `
      <!DOCTYPE html>
      <html>
      <head><title>WebSSH2 POST Auth Test</title></head>
      <body>
        <h2>WebSSH2 HTTP POST Authentication Test</h2>
        <form id="postAuthForm" method="POST" action="${BASE_URL}/ssh/host/${SSH_HOST}">
          <input type="text" name="username" value="${USERNAME}">
          <input type="password" name="password" value="${PASSWORD}">
          <input type="hidden" name="host" value="${SSH_HOST}">
          <input type="hidden" name="port" value="${SSH_PORT}">
          <input type="hidden" name="header.name" value="HTTP POST Test Server">
          <input type="hidden" name="header.background" value="blue">
          <input type="hidden" name="sshterm" value="xterm-256color">
          <input type="hidden" name="allowreplay" value="true">
          <button type="submit">Connect via HTTP POST</button>
        </form>
        
        <script>
          // Enable debug logging
          localStorage.debug = 'webssh2*,socket.io*';
          
          // Auto-submit the form after a short delay
          setTimeout(() => {
            console.log('🔘 Auto-submitting HTTP POST form');
            document.getElementById('postAuthForm').submit();
          }, 1000);
        </script>
      </body>
      </html>
    `
    
    // Navigate to the form page
    await page.setContent(formHTML)
    console.log('📝 Created HTTP POST form page')
    
    // Wait for form to auto-submit and redirect
    console.log('⏳ Waiting for form submission and redirect...')
    await page.waitForURL(/\/ssh\/host\//, { timeout: TIMEOUTS.DEFAULT })
    console.log('✅ Redirected to WebSSH2 after POST')
    
    // Wait for connection to establish  
    await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)
    
    // Check for connection status
    try {
      await page.waitForSelector('text=Connected', { timeout: TIMEOUTS.ACTION })
      console.log('✅ HTTP POST authentication successful')
    } catch (e) {
      console.error('❌ HTTP POST authentication may have failed:', e)
    }
    
    // Execute a test command to verify functionality
    try {
      const terminal = page.locator('.xterm-helper-textarea')
      if (await terminal.isVisible({ timeout: TIMEOUTS.MEDIUM_WAIT })) {
        console.log('💻 Executing test command: echo "HTTP POST test successful"')
        await terminal.click()
        await page.keyboard.type('echo "HTTP POST test successful"')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)
        
        console.log('💻 Executing second command: whoami')
        await page.keyboard.type('whoami')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)
      }
    } catch (e) {
      console.error('⚠️ Terminal interaction failed:', e instanceof Error ? e.message : e)
    }
    
    // Output captured client logs
    console.log('\n=== CLIENT-SIDE EVENT LOGS (HTTP POST) ===')
    clientLogs.forEach(log => {
      console.log(`[${log.timestamp}] ${log.type}: ${log.text}`)
    })
    
    console.log('\n=== HTTP POST EVENT FLOW CAPTURE COMPLETE ===')
    console.log(`Captured ${clientLogs.length} client-side log entries`)
  })
  
  test('map HTTP POST with advanced parameters', async ({ page }) => {
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
    
    console.log('=== HTTP POST WITH ADVANCED PARAMETERS ===')
    
    // Set up debug logging first
    await page.goto(BASE_URL + '/ssh')
    await page.evaluate(() => {
      localStorage.debug = 'webssh2*,socket.io*'
    })
    
    // Create form with advanced parameters (like BIG-IP APM would send)
    const advancedFormHTML = `
      <!DOCTYPE html>
      <html>
      <head><title>WebSSH2 Advanced POST Test</title></head>
      <body>
        <h2>WebSSH2 HTTP POST - Advanced Parameters</h2>
        <form id="advancedPostForm" method="POST" action="${BASE_URL}/ssh/host/${SSH_HOST}">
          <input type="text" name="username" value="${USERNAME}">
          <input type="password" name="password" value="${PASSWORD}">
          <input type="hidden" name="host" value="${SSH_HOST}">
          <input type="hidden" name="port" value="${SSH_PORT}">
          <input type="hidden" name="header.name" value="🏢 Production Database Server">
          <input type="hidden" name="header.background" value="red">
          <input type="hidden" name="header.color" value="white">
          <input type="hidden" name="sshterm" value="xterm-256color">
          <input type="hidden" name="allowreplay" value="true">
          <input type="hidden" name="readyTimeout" value="30000">
          <button type="submit">Connect with Advanced Options</button>
        </form>
        
        <script>
          localStorage.debug = 'webssh2*,socket.io*';
          setTimeout(() => {
            console.log('🔘 Submitting advanced HTTP POST form');
            document.getElementById('advancedPostForm').submit();
          }, 1000);
        </script>
      </body>
      </html>
    `
    
    await page.setContent(advancedFormHTML)
    console.log('📝 Created advanced HTTP POST form')
    
    // Wait for redirect and connection
    await page.waitForURL(/\/ssh\/host\//, { timeout: TIMEOUTS.DEFAULT })
    await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)
    
    try {
      await page.waitForSelector('text=Connected', { timeout: TIMEOUTS.ACTION })
      console.log('✅ Advanced POST authentication successful')
      
      // Check if custom header is visible
      const headerText = await page.textContent('.header-container')
      if (headerText?.includes('🏢 Production Database Server')) {
        console.log('✅ Custom header text applied successfully')
      }
      
      // Test terminal with environment check
      const terminal = page.locator('.xterm-helper-textarea')
      if (await terminal.isVisible({ timeout: TIMEOUTS.MEDIUM_WAIT })) {
        console.log('💻 Testing TERM environment: echo $TERM')
        await terminal.click()
        await page.keyboard.type('echo $TERM')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.MEDIUM_WAIT)
      }
    } catch (e) {
      console.error('❌ Advanced POST authentication failed:', e)
    }
    
    console.log('\n=== ADVANCED POST CLIENT LOGS ===')
    clientLogs.slice(-15).forEach(log => {
      console.log(`[${log.timestamp}] ${log.type}: ${log.text}`)
    })
  })
})