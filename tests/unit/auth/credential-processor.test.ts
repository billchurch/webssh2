// tests/unit/auth/credential-processor.test.ts
// Tests for credential processing functions

import { describe, it, expect } from 'vitest'
import {
  extractPostCredentials,
  validateConnectionParams,
  createSshCredentials,
  isValidCredentialFormat,
  extractReadyTimeout
} from '../../../app/auth/credential-processor.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'

describe('extractPostCredentials', () => {
  it('should extract valid credentials', () => {
    const body = {
      username: 'testuser',
      password: 'testpass',
      host: 'example.com',
      port: 2222,
      sshterm: 'xterm-256color'
    }
    
    const result = extractPostCredentials(body)
    
    expect(result).toEqual({
      username: 'testuser',
      password: 'testpass',
      host: 'example.com',
      port: 2222,
      term: 'xterm-256color'
    })
  })
  
  it('should handle hostname alias', () => {
    const body = {
      username: 'user',
      password: 'pass',
      hostname: 'server.com'
    }
    
    const result = extractPostCredentials(body)
    
    expect(result).toEqual({
      username: 'user',
      password: 'pass',
      host: 'server.com'
    })
  })
  
  it('should return null for missing credentials', () => {
    expect(extractPostCredentials({})).toBe(null)
    expect(extractPostCredentials({ username: 'user' })).toBe(null)
    expect(extractPostCredentials({ password: 'pass' })).toBe(null)
    expect(extractPostCredentials({ username: '', password: 'pass' })).toBe(null)
  })
  
  it('should convert string port to number', () => {
    const body = {
      username: 'user',
      password: 'pass',
      port: '3000'
    }
    
    const result = extractPostCredentials(body)
    
    expect(result?.port).toBe(3000)
  })
  
  it('should validate sshterm', () => {
    const body = {
      username: 'user',
      password: 'pass',
      sshterm: 'invalid<script>'
    }
    
    const result = extractPostCredentials(body)
    
    expect(result?.term).toBe(null)
  })
})

describe('validateConnectionParams', () => {
  it('should validate with hostParam', () => {
    const config = createDefaultConfig()
    const params = {
      hostParam: 'example.com',
      port: 2222,
      sshterm: 'vt100',
      config
    }
    
    const result = validateConnectionParams(params)
    
    expect(result).toEqual({
      host: 'example.com',
      port: 2222,
      term: 'vt100'
    })
  })
  
  it('should fallback to config host', () => {
    const config = createDefaultConfig()
    config.ssh.host = 'default.com'
    
    const params = { config }
    
    const result = validateConnectionParams(params)
    
    expect(result).toEqual({
      host: 'default.com',
      port: 22,
      term: 'xterm-256color'
    })
  })
  
  it('should prioritize hostParam over host', () => {
    const config = createDefaultConfig()
    const params = {
      host: 'fallback.com',
      hostParam: 'primary.com',
      config
    }
    
    const result = validateConnectionParams(params)
    
    expect(result.host).toBe('primary.com')
  })
  
  it('should throw for no host', () => {
    const config = createDefaultConfig()
    const params = { config }
    
    expect(() => validateConnectionParams(params)).toThrow('Host is required')
  })
  
  it('should use default port when not provided', () => {
    const config = createDefaultConfig()
    config.ssh.host = 'example.com'
    
    const params = { config }
    
    const result = validateConnectionParams(params)
    
    expect(result.port).toBe(22)
  })
})

describe('createSshCredentials', () => {
  it('should create credentials object', () => {
    const result = createSshCredentials(
      'user',
      'pass',
      'host.com',
      22,
      'xterm'
    )
    
    expect(result).toEqual({
      username: 'user',
      password: 'pass',
      host: 'host.com',
      port: 22,
      term: 'xterm'
    })
  })
  
  it('should omit empty term', () => {
    const result = createSshCredentials(
      'user',
      'pass',
      'host.com',
      22,
      ''
    )
    
    expect(result.term).toBeUndefined()
  })
  
  it('should omit null term', () => {
    const result = createSshCredentials(
      'user',
      'pass',
      'host.com',
      22,
      null
    )
    
    expect(result.term).toBeUndefined()
  })
})

describe('isValidCredentialFormat', () => {
  it('should validate credentials with password', () => {
    const creds = {
      username: 'user',
      password: 'pass'
    }
    
    expect(isValidCredentialFormat(creds)).toBe(true)
  })
  
  it('should validate credentials with private key', () => {
    const creds = {
      username: 'user',
      privateKey: 'ssh-rsa...'
    }
    
    expect(isValidCredentialFormat(creds)).toBe(true)
  })
  
  it('should reject invalid formats', () => {
    expect(isValidCredentialFormat(null)).toBe(false)
    expect(isValidCredentialFormat(undefined)).toBe(false)
    expect(isValidCredentialFormat('string')).toBe(false)
    expect(isValidCredentialFormat({})).toBe(false)
    expect(isValidCredentialFormat({ username: '' })).toBe(false)
    expect(isValidCredentialFormat({ username: 'user' })).toBe(false)
  })
})

describe('extractReadyTimeout', () => {
  it('should extract number timeout', () => {
    expect(extractReadyTimeout({ readyTimeout: 5000 })).toBe(5000)
  })
  
  it('should parse string timeout', () => {
    expect(extractReadyTimeout({ readyTimeout: '10000' })).toBe(10000)
  })
  
  it('should limit to maximum', () => {
    expect(extractReadyTimeout({ readyTimeout: 500000 })).toBe(300000)
  })
  
  it('should return null for invalid values', () => {
    expect(extractReadyTimeout({})).toBe(null)
    expect(extractReadyTimeout({ readyTimeout: 'invalid' })).toBe(null)
    expect(extractReadyTimeout({ readyTimeout: -1000 })).toBe(null)
    expect(extractReadyTimeout({ readyTimeout: 0 })).toBe(null)
  })
})