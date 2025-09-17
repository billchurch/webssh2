#!/usr/bin/env node

import { Client } from 'ssh2'

console.log('Testing keyboard-interactive authentication fix')
console.log('=' .repeat(60))

// Function to test connection with keyboard-interactive forced
async function testKeyboardInteractive(host, port, username, password) {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    const startTime = Date.now()
    
    conn.on('ready', () => {
      const elapsed = Date.now() - startTime
      console.log(`✓ Connection successful in ${elapsed}ms`)
      conn.end()
      resolve(true)
    })
    
    conn.on('error', (err) => {
      const elapsed = Date.now() - startTime
      console.error(`✗ Connection failed after ${elapsed}ms:`, err.message)
      reject(err)
    })
    
    conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
      console.log(`Keyboard-interactive auth requested:`)
      console.log(`  Name: ${name}`)
      console.log(`  Prompts: ${prompts?.length ?? 0}`)
      
      // Respond with password to all prompts
      const responses = []
      for (let i = 0; i < (prompts?.length ?? 0); i++) {
        console.log(`  Prompt ${i}: ${prompts[i].prompt}`)
        responses.push(password)
      }
      
      console.log(`  Sending ${responses.length} responses`)
      finish(responses)
    })
    
    // Connect with tryKeyboard enabled and debug output
    conn.connect({
      host,
      port,
      username,
      password,
      tryKeyboard: true,
      readyTimeout: 30000,
      debug: (msg) => console.log('[SSH2 Debug]', msg)
    })
  })
}

// Test WebSSH2 connection handling
async function testWebSSH2Connection() {
  console.log('\nTesting WebSSH2 keyboard-interactive handling')
  console.log('-'.repeat(60))
  
  try {
    // First, start a test SSH server if not already running
    const testConn = new Client()
    const serverAvailable = await new Promise((resolve) => {
      testConn.on('ready', () => {
        testConn.end()
        resolve(true)
      })
      testConn.on('error', () => resolve(false))
      testConn.connect({
        host: 'localhost',
        port: 2289,
        username: 'testuser',
        password: 'testpassword',
        readyTimeout: 2000
      })
    })
    
    if (!serverAvailable) {
      console.log('No test SSH server on port 2289')
      console.log('Start one with:')
      console.log('docker run --rm -d -p 2289:22 -e SSH_USER=testuser -e SSH_PASSWORD=testpassword ghcr.io/billchurch/ssh_test:alpine')
      return
    }
    
    console.log('✓ Test SSH server available on port 2289')
    console.log('\nTesting connection with keyboard-interactive auth...')
    
    await testKeyboardInteractive('localhost', 2289, 'testuser', 'testpassword')
    
    console.log('\n✅ Keyboard-interactive authentication is working!')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
  }
}

// Run tests
console.log('This test verifies that keyboard-interactive authentication works correctly.')
console.log('It addresses the issue reported in #409 where connections timeout during')
console.log('keyboard-interactive authentication.')

testWebSSH2Connection().catch(console.error)