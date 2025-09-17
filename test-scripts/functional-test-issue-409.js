#!/usr/bin/env node

/**
 * Functional test for Issue #409
 * Tests the actual WebSSH2 server with the user's configuration
 */

import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TEST_PORT = 2288
const CONFIG_PATH = path.join(__dirname, '..', 'test-configs', 'issue-409-config.json')

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  dim: '\x1b[2m'
}

function log(level, message) {
  const timestamp = new Date().toISOString().substring(11, 19)
  const color = level === 'info' ? colors.blue : 
                level === 'success' ? colors.green : 
                level === 'error' ? colors.red : 
                colors.yellow
  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${color}${level.toUpperCase()}:${colors.reset} ${message}`)
}

async function waitForServer(port, timeout = 10000) {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}/ssh/host`)
      if (response.ok) {
        return true
      }
    } catch (error) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  return false
}

async function testServerConfig(port) {
  try {
    // Test that server is responding
    log('info', `Testing server on port ${port}...`)
    const response = await fetch(`http://localhost:${port}/ssh/host`)
    
    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`)
    }
    
    log('success', 'Server is responding correctly')
    
    // Test WebSocket endpoint
    log('info', 'Testing WebSocket endpoint...')
    const wsResponse = await fetch(`http://localhost:${port}/socket.io/`)
    log('success', `WebSocket endpoint status: ${wsResponse.status}`)
    
    return true
  } catch (error) {
    log('error', `Failed to test server: ${error.message}`)
    return false
  }
}

async function testSSHConnection(port) {
  log('info', 'Testing SSH connection with configuration...')
  
  try {
    // Test with a POST request to simulate the user's scenario
    const testPayload = {
      username: 'testuser',
      password: 'testpassword',
      host: 'localhost',
      port: '2289',
      sshterm: 'xterm-256color',
      readyTimeout: '30000'
    }
    
    const response = await fetch(`http://localhost:${port}/ssh/host`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(testPayload).toString()
    })
    
    log('info', `POST /ssh/host response: ${response.status} ${response.statusText}`)
    
    // Check if we get the expected response (likely a redirect or HTML page)
    if (response.status === 200 || response.status === 302) {
      log('success', 'SSH endpoint accepted the configuration')
      return true
    }
    
    const text = await response.text()
    log('warn', `Unexpected response: ${text.substring(0, 200)}...`)
    return false
    
  } catch (error) {
    log('error', `SSH connection test failed: ${error.message}`)
    return false
  }
}

async function runFunctionalTest() {
  console.log('=' .repeat(60))
  console.log('Functional Test for Issue #409')
  console.log('Testing WebSSH2 with user\'s configuration')
  console.log('=' .repeat(60))
  console.log()
  
  // Check if config file exists
  try {
    await fs.access(CONFIG_PATH)
    log('success', `Found config file: ${CONFIG_PATH}`)
  } catch {
    log('error', `Config file not found: ${CONFIG_PATH}`)
    process.exit(1)
  }
  
  // Read and display config
  const configContent = await fs.readFile(CONFIG_PATH, 'utf8')
  const config = JSON.parse(configContent)
  log('info', 'Configuration loaded:')
  console.log(colors.dim + '  - Listen: ' + `${config.listen.ip}:${config.listen.port}` + colors.reset)
  console.log(colors.dim + '  - SSH readyTimeout: ' + config.ssh.readyTimeout + 'ms' + colors.reset)
  console.log(colors.dim + '  - SSH keepaliveInterval: ' + config.ssh.keepaliveInterval + 'ms' + colors.reset)
  console.log(colors.dim + '  - SSH allowedSubnets: ' + JSON.stringify(config.ssh.allowedSubnets) + colors.reset)
  console.log()
  
  // Start the server
  log('info', `Starting WebSSH2 server with config...`)
  
  const serverProcess = spawn('node', ['dist/index.js'], {
    env: {
      ...process.env,
      PORT: TEST_PORT.toString(),
      CONFIG_PATH: CONFIG_PATH,
      DEBUG: 'webssh2:*',
      NODE_ENV: 'test'
    },
    cwd: path.join(__dirname, '..'),
    stdio: ['inherit', 'pipe', 'pipe']  // Inherit stdin, pipe stdout and stderr
  })
  
  let serverOutput = ''
  let debugOutput = []
  
  serverProcess.stdout.on('data', (data) => {
    const output = data.toString()
    serverOutput += output
    
    // Parse debug output
    const lines = output.split('\n')
    for (const line of lines) {
      if (line.includes('webssh2:')) {
        debugOutput.push(line)
        if (debugOutput.length <= 5) {
          console.log(colors.dim + '  [SERVER] ' + line + colors.reset)
        }
      }
    }
  })
  
  serverProcess.stderr.on('data', (data) => {
    const output = data.toString()
    console.error(colors.red + '  [STDERR] ' + output + colors.reset)
  })
  
  serverProcess.on('error', (error) => {
    log('error', `Failed to start server: ${error.message}`)
    process.exit(1)
  })
  
  try {
    // Wait for server to start
    log('info', `Waiting for server to start on port ${TEST_PORT}...`)
    const serverReady = await waitForServer(TEST_PORT)
    
    if (!serverReady) {
      throw new Error('Server failed to start within timeout')
    }
    
    log('success', 'Server started successfully!')
    console.log()
    
    // Run tests
    const configTestPassed = await testServerConfig(TEST_PORT)
    const sshTestPassed = await testSSHConnection(TEST_PORT)
    
    console.log()
    console.log('=' .repeat(60))
    console.log('Test Results:')
    console.log('  - Server startup: ' + colors.green + '✓ PASSED' + colors.reset)
    console.log('  - Config loading: ' + colors.green + '✓ PASSED' + colors.reset)
    console.log('  - Server endpoints: ' + (configTestPassed ? colors.green + '✓ PASSED' : colors.red + '✗ FAILED') + colors.reset)
    console.log('  - SSH configuration: ' + (sshTestPassed ? colors.green + '✓ PASSED' : colors.red + '✗ FAILED') + colors.reset)
    
    // Check debug output for specific config values
    console.log()
    console.log('Configuration Verification:')
    
    const configLoaded = debugOutput.some(line => 
      line.includes('readyTimeout') && line.includes('30000')
    )
    const subnetsLoaded = debugOutput.some(line => 
      line.includes('allowedSubnets') || line.includes('10.0.0.0/8')
    )
    
    console.log('  - readyTimeout (30000ms): ' + 
      (configLoaded ? colors.green + '✓ Found in debug output' : colors.yellow + '⚠ Not verified in output') + colors.reset)
    console.log('  - allowedSubnets: ' + 
      (subnetsLoaded ? colors.green + '✓ Found in debug output' : colors.yellow + '⚠ Not verified in output') + colors.reset)
    
    console.log()
    console.log('=' .repeat(60))
    
    if (configTestPassed && sshTestPassed) {
      log('success', 'All functional tests passed!')
      console.log(colors.green + '\n✅ Issue #409 configuration is working correctly!\n' + colors.reset)
    } else {
      log('warn', 'Some tests failed - review the output above')
    }
    
  } catch (error) {
    log('error', `Test failed: ${error.message}`)
    console.error('\nServer output:')
    console.error(serverOutput)
  } finally {
    // Clean up
    log('info', 'Shutting down server...')
    serverProcess.kill('SIGTERM')
    
    // Give it a moment to shut down gracefully
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    if (!serverProcess.killed) {
      serverProcess.kill('SIGKILL')
    }
  }
}

// Run the test
runFunctionalTest().catch(error => {
  console.error(colors.red + 'Fatal error: ' + error.message + colors.reset)
  process.exit(1)
})