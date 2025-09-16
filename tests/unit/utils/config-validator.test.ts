// tests/unit/utils/config-validator.test.ts
// Tests for pure config validation functions

import { describe, it, expect } from 'vitest'
import { validateConfigPure } from '../../../app/utils/config-validator.js'
import { isOk, isErr } from '../../../app/types/result.js'

describe('validateConfigPure', () => {
  it('should return ok result for valid configuration', () => {
    const validConfig = {
      listen: { ip: '0.0.0.0', port: 2222 },
      http: { origins: ['*:*'] },
      user: { name: null, password: null, privateKey: null, passphrase: null },
      ssh: {
        host: null,
        port: 22,
        term: 'xterm-256color',
        readyTimeout: 20000,
        keepaliveInterval: 120000,
        keepaliveCountMax: 10,
        algorithms: {}
      },
      header: { text: null, background: 'green' },
      options: {
        challengeButton: true,
        allowReauth: true,
        allowReconnect: true,
        allowReplay: true
      },
      session: {
        secret: 'test-secret',
        name: 'webssh2'
      }
    }
    
    const result = validateConfigPure(validConfig)
    
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value).toEqual(validConfig)
    }
  })
  
  it('should return error result for invalid port', () => {
    const invalidConfig = {
      listen: { ip: '0.0.0.0', port: -1 }, // Invalid port
      http: { origins: ['*:*'] },
      user: { name: null, password: null, privateKey: null, passphrase: null },
      ssh: {
        host: null,
        port: 22,
        term: 'xterm-256color',
        readyTimeout: 20000,
        keepaliveInterval: 120000,
        keepaliveCountMax: 10
      },
      header: { text: null, background: 'green' },
      options: {},
      session: {
        secret: 'test-secret',
        name: 'webssh2'
      }
    }
    
    const result = validateConfigPure(invalidConfig)
    
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error.message).toContain('port')
    }
  })
  
  it('should return error result for missing required fields', () => {
    const incompleteConfig = {
      listen: { ip: '0.0.0.0' }
      // Missing required fields
    }
    
    const result = validateConfigPure(incompleteConfig)
    
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error.message).toBeDefined()
      expect(result.error.errors).toBeDefined()
    }
  })
})