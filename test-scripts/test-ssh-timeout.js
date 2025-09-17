#!/usr/bin/env node

import { Client } from 'ssh2'

console.log('Testing SSH connection with different timeout configurations')
console.log('=' .repeat(60))

// Test configurations
const configs = [
  {
    name: 'Default config (20 second timeout)',
    config: {
      host: 'localhost',
      port: 2289,
      username: 'testuser',
      password: 'testpassword',
      readyTimeout: 20000,
      debug: (msg) => console.log('[SSH2 Debug]', msg)
    }
  },
  {
    name: 'User config from issue (30 second timeout)',
    config: {
      host: 'localhost',
      port: 2289,
      username: 'testuser',
      password: 'testpassword',
      readyTimeout: 30000,
      keepaliveInterval: 120000,
      keepaliveCountMax: 10,
      debug: (msg) => console.log('[SSH2 Debug]', msg)
    }
  },
  {
    name: 'Short timeout (5 seconds) - should timeout',
    config: {
      host: 'localhost',
      port: 2289,
      username: 'testuser',
      password: 'testpassword',
      readyTimeout: 5000,
      debug: (msg) => console.log('[SSH2 Debug]', msg)
    }
  }
]

async function testConnection(name, config) {
  console.log('\n' + '-'.repeat(60))
  console.log(`Testing: ${name}`)
  console.log(`Config: readyTimeout=${config.readyTimeout}ms`)
  
  return new Promise((resolve) => {
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
      if (err.message.includes('Timed out') || err.message.includes('handshake')) {
        console.log('  → This appears to be a timeout during handshake')
      }
      resolve(false)
    })
    
    conn.on('close', () => {
      const elapsed = Date.now() - startTime
      console.log(`Connection closed after ${elapsed}ms`)
    })
    
    try {
      console.log('Connecting to SSH server...')
      conn.connect(config)
    } catch (err) {
      console.error('Failed to initiate connection:', err.message)
      resolve(false)
    }
  })
}

async function runTests() {
  console.log('\nNote: This test requires an SSH server running on localhost:2289')
  console.log('You can start one with:')
  console.log('docker run --rm -d -p 2289:22 -e SSH_USER=testuser -e SSH_PASSWORD=testpassword ghcr.io/billchurch/ssh_test:alpine')
  
  // Check if SSH server is available
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
      readyTimeout: 5000
    })
  })
  
  if (!serverAvailable) {
    console.log('\n⚠️  No SSH server found on localhost:2289')
    console.log('Skipping connection tests')
    return
  }
  
  console.log('\n✓ SSH server detected on localhost:2289')
  
  // Run tests sequentially
  for (const { name, config } of configs) {
    await testConnection(name, config)
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  console.log('\n' + '=' .repeat(60))
  console.log('Tests completed!')
}

runTests().catch(console.error)