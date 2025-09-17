import { describe, it, expect } from 'vitest'
import { createDefaultConfig, processConfig, parseConfigJson } from '../../../app/config/config-processor.js'
import type { Config } from '../../../app/types/config.js'
import { TEST_SUBNETS, TEST_IPS } from '../../test-constants.js'

describe('SSH Config - Allowed Subnets and Network Settings', () => {
  it('should load config with allowedSubnets field', () => {
    const jsonConfig = JSON.stringify({
      listen: {
        ip: TEST_IPS.ANY,
        port: 2222
      },
      ssh: {
        host: null,
        port: 22,
        term: 'xterm-color',
        readyTimeout: 30000,
        keepaliveInterval: 120000,
        keepaliveCountMax: 10,
        allowedSubnets: [
          TEST_SUBNETS.PRIVATE_10,
          TEST_SUBNETS.PRIVATE_172
        ]
      }
    })
    
    const parseResult = parseConfigJson(jsonConfig)
    expect(parseResult.ok).toBe(true)
    
    if (parseResult.ok) {
      const defaultConfig = createDefaultConfig()
      const processResult = processConfig(defaultConfig, parseResult.value)
      
      expect(processResult.ok).toBe(true)
      
      if (processResult.ok) {
        const config = processResult.value
        
        // Verify SSH config values
        expect(config.ssh.readyTimeout).toBe(30000)
        expect(config.ssh.keepaliveInterval).toBe(120000)
        expect(config.ssh.keepaliveCountMax).toBe(10)
        expect(config.ssh.term).toBe('xterm-color')
        
        // Verify allowedSubnets is properly loaded
        expect(config.ssh.allowedSubnets).toBeDefined()
        expect(config.ssh.allowedSubnets).toEqual([
          TEST_SUBNETS.PRIVATE_10,
          TEST_SUBNETS.PRIVATE_172
        ])
      }
    }
  })
  
  it('should have default empty array for allowedSubnets', () => {
    const config = createDefaultConfig()
    
    expect(config.ssh.allowedSubnets).toBeDefined()
    expect(config.ssh.allowedSubnets).toEqual([])
  })
  
  it('should merge allowedSubnets from environment config', () => {
    const defaultConfig = createDefaultConfig()
    const envConfig: Partial<Config> = {
      ssh: {
        ...defaultConfig.ssh,
        allowedSubnets: [TEST_SUBNETS.PRIVATE_192]
      }
    }
    
    const result = processConfig(defaultConfig, undefined, envConfig)
    
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.ssh.allowedSubnets).toEqual([TEST_SUBNETS.PRIVATE_192])
    }
  })
  
  it('should handle multiple subnet configurations', () => {
    const testCases = [
      {
        subnets: [TEST_SUBNETS.PRIVATE_10],
        description: 'single private subnet'
      },
      {
        subnets: [TEST_SUBNETS.PRIVATE_10, TEST_SUBNETS.PRIVATE_172, TEST_SUBNETS.PRIVATE_192],
        description: 'multiple private subnets'
      },
      {
        subnets: [TEST_SUBNETS.LOCALHOST],
        description: 'localhost only'
      },
      {
        subnets: [TEST_SUBNETS.ANY],
        description: 'any address'
      },
      {
        subnets: [],
        description: 'empty subnet list'
      }
    ]
    
    for (const { subnets, description } of testCases) {
      const jsonConfig = JSON.stringify({
        ssh: { allowedSubnets: subnets }
      })
      
      const parseResult = parseConfigJson(jsonConfig)
      expect(parseResult.ok).toBe(true)
      
      if (parseResult.ok) {
        const defaultConfig = createDefaultConfig()
        const processResult = processConfig(defaultConfig, parseResult.value)
        
        expect(processResult.ok).toBe(true)
        if (processResult.ok) {
          expect(processResult.value.ssh.allowedSubnets).toEqual(subnets)
        }
      }
    }
  })
  
  it('should handle readyTimeout values correctly', () => {
    const configs = [
      { readyTimeout: 5000, expected: 5000 },
      { readyTimeout: 30000, expected: 30000 },
      { readyTimeout: 60000, expected: 60000 }
    ]
    
    for (const { readyTimeout, expected } of configs) {
      const jsonConfig = JSON.stringify({
        ssh: { readyTimeout }
      })
      
      const parseResult = parseConfigJson(jsonConfig)
      expect(parseResult.ok).toBe(true)
      
      if (parseResult.ok) {
        const defaultConfig = createDefaultConfig()
        const processResult = processConfig(defaultConfig, parseResult.value)
        
        expect(processResult.ok).toBe(true)
        if (processResult.ok) {
          expect(processResult.value.ssh.readyTimeout).toBe(expected)
        }
      }
    }
  })
  
  it('should properly configure listen IP addresses', () => {
    const testCases = [
      { ip: TEST_IPS.ANY, description: 'bind to all interfaces' },
      { ip: TEST_IPS.LOCALHOST, description: 'bind to localhost only' },
      { ip: TEST_IPS.PRIVATE_192, description: 'bind to specific private IP' }
    ]
    
    for (const { ip, description } of testCases) {
      const jsonConfig = JSON.stringify({
        listen: { ip, port: 2222 }
      })
      
      const parseResult = parseConfigJson(jsonConfig)
      expect(parseResult.ok).toBe(true)
      
      if (parseResult.ok) {
        const defaultConfig = createDefaultConfig()
        const processResult = processConfig(defaultConfig, parseResult.value)
        
        expect(processResult.ok).toBe(true)
        if (processResult.ok) {
          expect(processResult.value.listen.ip).toBe(ip)
        }
      }
    }
  })
})

describe('SSH Network Configuration - Edge Cases', () => {
  it('should handle overlapping subnet configurations', () => {
    // Test that overlapping subnets are preserved as configured
    const jsonConfig = JSON.stringify({
      ssh: {
        allowedSubnets: [
          TEST_SUBNETS.ANY,           // 0.0.0.0/0 - includes everything
          TEST_SUBNETS.PRIVATE_10,    // 10.0.0.0/8 - subset of above
          TEST_SUBNETS.LOCALHOST      // 127.0.0.0/8 - also subset
        ]
      }
    })
    
    const parseResult = parseConfigJson(jsonConfig)
    expect(parseResult.ok).toBe(true)
    
    if (parseResult.ok) {
      const defaultConfig = createDefaultConfig()
      const processResult = processConfig(defaultConfig, parseResult.value)
      
      expect(processResult.ok).toBe(true)
      if (processResult.ok) {
        // Should preserve all subnets even if overlapping
        expect(processResult.value.ssh.allowedSubnets).toHaveLength(3)
        expect(processResult.value.ssh.allowedSubnets).toContain(TEST_SUBNETS.ANY)
        expect(processResult.value.ssh.allowedSubnets).toContain(TEST_SUBNETS.PRIVATE_10)
        expect(processResult.value.ssh.allowedSubnets).toContain(TEST_SUBNETS.LOCALHOST)
      }
    }
  })
  
  it('should merge subnet configurations from multiple sources', () => {
    const defaultConfig = createDefaultConfig()
    
    const fileConfig: Partial<Config> = {
      ssh: {
        ...defaultConfig.ssh,
        allowedSubnets: [TEST_SUBNETS.PRIVATE_10]
      }
    }
    
    const envConfig: Partial<Config> = {
      ssh: {
        ...defaultConfig.ssh,
        allowedSubnets: [TEST_SUBNETS.PRIVATE_172, TEST_SUBNETS.PRIVATE_192]
      }
    }
    
    // Environment config should override file config
    const result = processConfig(defaultConfig, fileConfig, envConfig)
    
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.ssh.allowedSubnets).toEqual([
        TEST_SUBNETS.PRIVATE_172,
        TEST_SUBNETS.PRIVATE_192
      ])
      // File config should be overridden, not merged
      expect(result.value.ssh.allowedSubnets).not.toContain(TEST_SUBNETS.PRIVATE_10)
    }
  })
})