// tests/unit/config/config-processor-v2.test.ts

import { describe, it, expect } from 'vitest'
import {
  parseJsonConfig,
  validateConfigStructure,
  mergeConfigs,
  applyEnvironmentOverrides,
  processConfigPipeline,
  validateSshAlgorithms,
  sanitizeConfigForClient
} from '../../../app/config/config-processor-v2.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'
import { isOk, isErr } from '../../../app/types/result.js'

describe('parseJsonConfig', () => {
  it('parses valid JSON', () => {
    const result = parseJsonConfig('{"key": "value"}')
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value).toEqual({ key: 'value' })
    }
  })
  
  it('returns error for invalid JSON', () => {
    const result = parseJsonConfig('{invalid}')
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error.type).toBe('PARSE')
      expect(result.error.message).toContain('Invalid JSON')
    }
  })
})

describe('validateConfigStructure', () => {
  it('validates valid config object', () => {
    const config = {
      listen: { port: 2222 },
      ssh: { host: 'localhost' }
    }
    const result = validateConfigStructure(config)
    expect(isOk(result)).toBe(true)
  })
  
  it('rejects non-object config', () => {
    const result = validateConfigStructure('not an object')
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error.type).toBe('VALIDATION')
      expect(result.error.message).toBe('Config must be an object')
    }
  })
  
  it('rejects invalid listen field', () => {
    const result = validateConfigStructure({ listen: 'invalid' })
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error.message).toBe('listen must be an object')
    }
  })
  
  it('rejects invalid ssh field', () => {
    const result = validateConfigStructure({ ssh: 123 })
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error.message).toBe('ssh must be an object')
    }
  })
})

describe('mergeConfigs', () => {
  it('merges configs successfully', () => {
    const base = createDefaultConfig()
    const override = { listen: { port: 3000 } }
    const result = mergeConfigs(base, override)
    
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.listen.port).toBe(3000)
    }
  })
  
  it('preserves base config properties not in override', () => {
    const base = createDefaultConfig()
    const override = { listen: { port: 3000 } }
    const result = mergeConfigs(base, override)
    
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.ssh.host).toBe(base.ssh.host)
    }
  })
})

describe('applyEnvironmentOverrides', () => {
  it('applies PORT override', () => {
    const config = createDefaultConfig()
    const env = { PORT: '3000' }
    const result = applyEnvironmentOverrides(config, env)
    
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.listen.port).toBe(3000)
    }
  })
  
  it('rejects invalid PORT', () => {
    const config = createDefaultConfig()
    const result = applyEnvironmentOverrides(config, { PORT: 'invalid' })
    
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error.type).toBe('VALIDATION')
      expect(result.error.message).toContain('Invalid PORT')
    }
  })
  
  it('rejects out-of-range PORT', () => {
    const config = createDefaultConfig()
    const result = applyEnvironmentOverrides(config, { PORT: '70000' })
    
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error.message).toContain('Invalid PORT')
    }
  })
  
  it('applies HOST override', () => {
    const config = createDefaultConfig()
    const env = { HOST: '0.0.0.0' }
    const result = applyEnvironmentOverrides(config, env)
    
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.listen.ip).toBe('0.0.0.0')
    }
  })
})

describe('processConfigPipeline', () => {
  it('returns default config when no custom config provided', () => {
    const result = processConfigPipeline()
    
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.listen.port).toBe(2222)
    }
  })
  
  it('merges custom config', () => {
    const customConfig = JSON.stringify({
      listen: { port: 3000 },
      ssh: { host: 'example.com' }
    })
    const result = processConfigPipeline(customConfig)
    
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.listen.port).toBe(3000)
      expect(result.value.ssh.host).toBe('example.com')
    }
  })
  
  it('applies environment overrides after custom config', () => {
    const customConfig = JSON.stringify({ listen: { port: 3000 } })
    const env = { PORT: '4000' }
    const result = processConfigPipeline(customConfig, env)
    
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.listen.port).toBe(4000)
    }
  })
  
  it('propagates parse errors', () => {
    const result = processConfigPipeline('invalid json')
    
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error.type).toBe('PARSE')
    }
  })
  
  it('propagates validation errors', () => {
    const customConfig = JSON.stringify('not an object')
    const result = processConfigPipeline(customConfig)
    
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error.type).toBe('VALIDATION')
    }
  })
})

describe('validateSshAlgorithms', () => {
  it('validates valid algorithms object', () => {
    const algorithms = {
      kex: ['ecdh-sha2-nistp256'],
      cipher: ['aes256-gcm'],
      hmac: ['hmac-sha2-256'],
      compress: ['none'],
      serverHostKey: ['ssh-rsa']
    }
    const result = validateSshAlgorithms(algorithms)
    
    expect(isOk(result)).toBe(true)
  })
  
  it('rejects non-object algorithms', () => {
    const result = validateSshAlgorithms('not an object')
    
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error.message).toBe('SSH algorithms must be an object')
    }
  })
  
  it('rejects non-array algorithm field', () => {
    const algorithms = { kex: 'not an array' }
    const result = validateSshAlgorithms(algorithms)
    
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error.message).toBe('SSH algorithms.kex must be an array')
    }
  })
})

describe('sanitizeConfigForClient', () => {
  it('removes sensitive fields', () => {
    const config = createDefaultConfig()
    config.user.password = 'secret'
    config.user.privateKey = 'key'
    config.user.passphrase = 'phrase'
    
    const result = sanitizeConfigForClient(config)
    
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.session).toBeUndefined()
      expect(result.value.user?.password).toBeUndefined()
      expect(result.value.user?.privateKey).toBeUndefined()
      expect(result.value.user?.passphrase).toBeUndefined()
    }
  })
  
  it('preserves non-sensitive fields', () => {
    const config = createDefaultConfig()
    const result = sanitizeConfigForClient(config)
    
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.listen?.port).toBe(config.listen.port)
      expect(result.value.ssh?.host).toBe(config.ssh.host)
    }
  })
})