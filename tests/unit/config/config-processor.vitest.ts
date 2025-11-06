// tests/unit/config/config-processor.test.ts
// Tests for pure config processing functions

import { describe, it, expect } from 'vitest'
import {
  createDefaultConfig,
  mergeConfigs,
  processConfig,
  parseConfigJson,
  createCorsConfig
} from '../../../app/config/config-processor.js'
import type { Config } from '../../../app/types/config.js'
import { AUTH_METHOD_TOKENS, DEFAULT_AUTH_METHODS } from '../../../app/constants.js'
import { TEST_SECRET_123, TEST_PASSWORDS, TEST_IPS, TEST_SECRET } from '../../test-constants.js'

void describe('createDefaultConfig', () => {
  it('should create default config with auto-generated session secret', () => {
    const config = createDefaultConfig()

    expect(config.listen.ip).toBe('0.0.0.0')
    expect(config.listen.port).toBe(2222)
    expect(config.ssh.port).toBe(22)
    expect(config.ssh.term).toBe('xterm-256color')
    // Should auto-generate a secure secret (64 hex chars = 32 bytes)
    expect(config.session.secret).toBeDefined()
    expect(config.session.secret.length).toBe(64)
    expect(config.session.name).toBe('webssh2.sid')
    expect(config.logging?.minimumLevel).toBe('info')
    expect(config.logging?.stdout?.enabled).toBe(true)
  })
  
  it('should create default config with provided session secret', () => {
    const secret = TEST_SECRET_123
    const config = createDefaultConfig(secret)
    
    expect(config.session.secret).toBe(secret)
  })
  
  it('should include default SSH algorithms', () => {
    const config = createDefaultConfig()
    
    expect(config.ssh.algorithms.cipher).toContain('chacha20-poly1305@openssh.com')
    expect(config.ssh.algorithms.kex).toContain('curve25519-sha256')
    expect(config.ssh.algorithms.serverHostKey).toContain('ssh-ed25519')
  })

  it('should include default allowed auth methods in order', () => {
    const config = createDefaultConfig()

    expect(config.ssh.allowedAuthMethods.map(method => `${method}`)).toEqual(DEFAULT_AUTH_METHODS)
    expect(config.ssh.allowedAuthMethods[0]).toBe(AUTH_METHOD_TOKENS.PASSWORD)
  })
})

void describe('mergeConfigs', () => {
  it('should return default config when no overrides provided', () => {
    const defaultConfig = createDefaultConfig(TEST_PASSWORDS.secret)
    
    const merged = mergeConfigs(defaultConfig)
    
    expect(merged).toEqual(defaultConfig)
  })
  
  it('should merge file config over defaults', () => {
    const defaultConfig = createDefaultConfig()
    const fileConfig: Partial<Config> = {
      listen: { ip: TEST_IPS.LOCALHOST, port: 3000 },
      ssh: { host: 'example.com', port: 2222 } as Config['ssh']
    }
    
    const merged = mergeConfigs(defaultConfig, fileConfig)
    
    expect(merged.listen.ip).toBe(TEST_IPS.LOCALHOST)
    expect(merged.listen.port).toBe(3000)
    expect(merged.ssh.host).toBe('example.com')
    expect(merged.ssh.port).toBe(2222)
    expect(merged.ssh.term).toBe('xterm-256color') // Default preserved
  })
  
  it('should merge env config over file config', () => {
    const defaultConfig = createDefaultConfig()
    const fileConfig: Partial<Config> = {
      listen: { ip: TEST_IPS.LOCALHOST, port: 3000 }
    }
    const envConfig: Partial<Config> = {
      listen: { port: 4000 } as Config['listen']
    }
    
    const merged = mergeConfigs(defaultConfig, fileConfig, envConfig)
    
    expect(merged.listen.ip).toBe(TEST_IPS.LOCALHOST) // From file
    expect(merged.listen.port).toBe(4000) // From env (overrides file)
  })
  
  it('should be pure - not mutate inputs', () => {
    const defaultConfig = createDefaultConfig()
    const fileConfig: Partial<Config> = { listen: { port: 3000 } as Config['listen'] }
    const originalDefault = globalThis.structuredClone(defaultConfig)
    const originalFile = globalThis.structuredClone(fileConfig)
    
    mergeConfigs(defaultConfig, fileConfig)
    
    expect(defaultConfig).toEqual(originalDefault)
    expect(fileConfig).toEqual(originalFile)
  })
})

void describe('processConfig', () => {
  it('should return ok result for valid configuration', () => {
    const defaultConfig = createDefaultConfig(TEST_SECRET)
    
    const result = processConfig(defaultConfig)
    
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(defaultConfig)
    }
  })
  
  it('should merge and validate configurations', () => {
    const defaultConfig = createDefaultConfig(TEST_PASSWORDS.secret)
    const fileConfig: Partial<Config> = {
      ssh: { host: 'server.example.com' } as Config['ssh']
    }
    
    const result = processConfig(defaultConfig, fileConfig)
    
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.ssh.host).toBe('server.example.com')
    }
  })
  
  it('should return error result for invalid configuration', () => {
    const defaultConfig = createDefaultConfig(TEST_PASSWORDS.secret)
    const fileConfig: Partial<Config> = {
      listen: { port: -1 } as Config['listen'] // Invalid port
    }
    
    const result = processConfig(defaultConfig, fileConfig)
    
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toContain('port')
      expect(result.error.originalConfig.listen.port).toBe(-1)
    }
  })
})

void describe('parseConfigJson', () => {
  it('should parse valid JSON', () => {
    const json = '{"listen": {"port": 3000}, "ssh": {"host": "example.com"}}'
    
    const result = parseConfigJson(json)
    
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({
        listen: { port: 3000 },
        ssh: { host: 'example.com' }
      })
    }
  })
  
  it('should return error for invalid JSON', () => {
    const json = '{ invalid json }'
    
    const result = parseConfigJson(json)
    
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toContain('JSON')
    }
  })
  
  it('should handle empty object', () => {
    const json = '{}'
    
    const result = parseConfigJson(json)
    
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({})
    }
  })
})

void describe('createCorsConfig', () => {
  it('should create CORS config from application config', () => {
    const config = createDefaultConfig()
    config.http.origins = ['http://localhost:3000', 'https://example.com']
    
    const cors = createCorsConfig(config)
    
    expect(cors).toEqual({
      origin: ['http://localhost:3000', 'https://example.com'],
      methods: ['GET', 'POST'],
      credentials: true
    })
  })
  
  it('should use default origins', () => {
    const config = createDefaultConfig()
    
    const cors = createCorsConfig(config)
    
    expect(cors.origin).toEqual(['*:*'])
    expect(cors.methods).toEqual(['GET', 'POST'])
    expect(cors.credentials).toBe(true)
  })
})
