import { describe, it, expect } from 'vitest'
import { createDefaultConfig, processConfig, parseConfigJson } from '../../../app/config/config-processor.js'
import type { Config } from '../../../app/types/config.js'

describe('Issue #409 - Config with allowedSubnets', () => {
  it('should load config with allowedSubnets field', () => {
    const jsonConfig = `{
      "listen": {
        "ip": "0.0.0.0",
        "port": 2222
      },
      "ssh": {
        "host": null,
        "port": 22,
        "term": "xterm-color",
        "readyTimeout": 30000,
        "keepaliveInterval": 120000,
        "keepaliveCountMax": 10,
        "allowedSubnets": [
          "10.0.0.0/8",
          "172.16.0.0/12"
        ]
      }
    }`
    
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
          '10.0.0.0/8',
          '172.16.0.0/12'
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
        allowedSubnets: ['192.168.1.0/24']
      }
    }
    
    const result = processConfig(defaultConfig, undefined, envConfig)
    
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.ssh.allowedSubnets).toEqual(['192.168.1.0/24'])
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
})