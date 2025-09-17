#!/usr/bin/env node

/**
 * Simple config test for Issue #409
 * Verifies the configuration loads correctly with allowedSubnets
 */

import { getConfig } from '../dist/app/config.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function testConfig() {
  console.log('=' .repeat(60))
  console.log('Configuration Test for Issue #409')
  console.log('=' .repeat(60))
  console.log()

  // Set the config path
  process.env.CONFIG_PATH = path.join(__dirname, '..', 'test-configs', 'issue-409-config.json')
  process.env.PORT = '2288'
  
  try {
    console.log('Loading configuration...')
    const config = await getConfig()
    
    console.log('\n✅ Configuration loaded successfully!\n')
    
    console.log('SSH Configuration:')
    console.log('  - host:', config.ssh.host)
    console.log('  - port:', config.ssh.port)
    console.log('  - term:', config.ssh.term)
    console.log('  - readyTimeout:', config.ssh.readyTimeout, 'ms')
    console.log('  - keepaliveInterval:', config.ssh.keepaliveInterval, 'ms')
    console.log('  - keepaliveCountMax:', config.ssh.keepaliveCountMax)
    console.log('  - allowedSubnets:', config.ssh.allowedSubnets)
    console.log('  - alwaysSendKeyboardInteractivePrompts:', config.ssh.alwaysSendKeyboardInteractivePrompts)
    console.log('  - disableInteractiveAuth:', config.ssh.disableInteractiveAuth)
    
    console.log('\nListen Configuration:')
    console.log('  - ip:', config.listen.ip)
    console.log('  - port:', config.listen.port)
    
    // Verify the values from issue #409 config
    console.log('\n' + '=' .repeat(60))
    console.log('Verification:')
    
    const checks = [
      {
        name: 'readyTimeout is 30000ms',
        pass: config.ssh.readyTimeout === 30000
      },
      {
        name: 'keepaliveInterval is 120000ms',
        pass: config.ssh.keepaliveInterval === 120000
      },
      {
        name: 'keepaliveCountMax is 10',
        pass: config.ssh.keepaliveCountMax === 10
      },
      {
        name: 'allowedSubnets contains 10.0.0.0/8',
        pass: config.ssh.allowedSubnets?.includes('10.0.0.0/8')
      },
      {
        name: 'allowedSubnets contains 172.16.0.0/12',
        pass: config.ssh.allowedSubnets?.includes('172.16.0.0/12')
      },
      {
        name: 'listen port overridden to 2288',
        pass: config.listen.port === 2288
      }
    ]
    
    let allPassed = true
    for (const check of checks) {
      const icon = check.pass ? '✅' : '❌'
      console.log(`  ${icon} ${check.name}`)
      if (!check.pass) allPassed = false
    }
    
    console.log('\n' + '=' .repeat(60))
    if (allPassed) {
      console.log('✅ All configuration checks passed!')
      console.log('\nThe configuration from issue #409 loads correctly.')
      console.log('The allowedSubnets field is properly parsed and available.')
    } else {
      console.log('❌ Some configuration checks failed!')
      process.exit(1)
    }
    
  } catch (error) {
    console.error('❌ Failed to load configuration:', error.message)
    console.error('\nStack trace:', error.stack)
    process.exit(1)
  }
}

testConfig().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})