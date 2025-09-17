#!/usr/bin/env node

import { promises as fs } from 'fs'
import { readConfigFile } from '../dist/app/config/config-loader.js'
import { processConfig, createDefaultConfig, parseConfigJson } from '../dist/app/config/config-processor.js'

async function testConfigLoading() {
  console.log('Testing Issue #409 - Config Loading with allowedSubnets')
  console.log('=' .repeat(60))
  
  try {
    // Read the test config file
    const configPath = './test-configs/issue-409-config.json'
    const result = await readConfigFile(configPath)
    
    if (!result.ok) {
      console.error('Failed to read config file:', result.error)
      return
    }
    
    console.log('✓ Config file loaded successfully')
    
    // Parse the config
    const parseResult = parseConfigJson(result.value)
    if (!parseResult.ok) {
      console.error('Failed to parse config:', parseResult.error)
      return
    }
    
    console.log('✓ Config parsed successfully')
    
    // Process the config with defaults
    const defaultConfig = createDefaultConfig()
    const processResult = processConfig(defaultConfig, parseResult.value)
    
    if (!processResult.ok) {
      console.error('Failed to process config:', processResult.error)
      return
    }
    
    const config = processResult.value
    console.log('✓ Config processed successfully')
    console.log('\nSSH Config:')
    console.log('  - readyTimeout:', config.ssh.readyTimeout, 'ms')
    console.log('  - keepaliveInterval:', config.ssh.keepaliveInterval, 'ms')
    console.log('  - keepaliveCountMax:', config.ssh.keepaliveCountMax)
    console.log('  - allowedSubnets:', config.ssh.allowedSubnets)
    console.log('  - term:', config.ssh.term)
    
    // Verify the values match what was in the config file
    if (config.ssh.readyTimeout === 30000) {
      console.log('\n✓ readyTimeout correctly set to 30000ms')
    } else {
      console.error('\n✗ readyTimeout incorrect:', config.ssh.readyTimeout)
    }
    
    if (config.ssh.allowedSubnets && 
        config.ssh.allowedSubnets.length === 2 &&
        config.ssh.allowedSubnets.includes('10.0.0.0/8')) {
      console.log('✓ allowedSubnets correctly loaded')
    } else {
      console.error('✗ allowedSubnets incorrect:', config.ssh.allowedSubnets)
    }
    
    console.log('\n' + '=' .repeat(60))
    console.log('Test completed successfully!')
    
  } catch (error) {
    console.error('Test failed:', error)
    process.exit(1)
  }
}

testConfigLoading()