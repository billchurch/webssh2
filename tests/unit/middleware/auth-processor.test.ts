// tests/unit/middleware/auth-processor.test.ts
// Tests for pure auth processing functions

import { describe, it, expect } from 'vitest'
import {
  hasConfigCredentials,
  extractConfigCredentials,
  processBasicAuthCredentials,
  processAuthentication,
  createSessionData,
  type AuthResult
} from '../../../app/middleware/auth-processor.js'
import type { Config } from '../../../app/types/config.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'

describe('hasConfigCredentials', () => {
  it('should return false for empty config credentials', () => {
    const config = createDefaultConfig()
    
    expect(hasConfigCredentials(config)).toBe(false)
  })
  
  it('should return true when username and password are provided', () => {
    const config = createDefaultConfig()
    config.user.name = 'testuser'
    config.user.password = 'testpass'
    
    expect(hasConfigCredentials(config)).toBe(true)
  })
  
  it('should return true when username and privateKey are provided', () => {
    const config = createDefaultConfig()
    config.user.name = 'testuser'
    config.user.privateKey = 'ssh-rsa-key-data'
    
    expect(hasConfigCredentials(config)).toBe(true)
  })
  
  it('should return false when only username is provided', () => {
    const config = createDefaultConfig()
    config.user.name = 'testuser'
    
    expect(hasConfigCredentials(config)).toBe(false)
  })
  
  it('should return false when username is empty string', () => {
    const config = createDefaultConfig()
    config.user.name = ''
    config.user.password = 'testpass'
    
    expect(hasConfigCredentials(config)).toBe(false)
  })
})

describe('extractConfigCredentials', () => {
  it('should return null for invalid config', () => {
    const config = createDefaultConfig()
    
    expect(extractConfigCredentials(config)).toBe(null)
  })
  
  it('should extract username and password', () => {
    const config = createDefaultConfig()
    config.user.name = 'testuser'
    config.user.password = 'testpass'
    
    const creds = extractConfigCredentials(config)
    
    expect(creds).toEqual({
      username: 'testuser',
      password: 'testpass'
    })
  })
  
  it('should extract username and privateKey', () => {
    const config = createDefaultConfig()
    config.user.name = 'testuser'
    config.user.privateKey = 'ssh-rsa-key'
    
    const creds = extractConfigCredentials(config)
    
    expect(creds).toEqual({
      username: 'testuser',
      privateKey: 'ssh-rsa-key'
    })
  })
  
  it('should extract all credential fields when present', () => {
    const config = createDefaultConfig()
    config.user.name = 'testuser'
    config.user.password = 'testpass'
    config.user.privateKey = 'ssh-rsa-key'
    config.user.passphrase = 'keypass'
    
    const creds = extractConfigCredentials(config)
    
    expect(creds).toEqual({
      username: 'testuser',
      password: 'testpass',
      privateKey: 'ssh-rsa-key',
      passphrase: 'keypass'
    })
  })
})

describe('processBasicAuthCredentials', () => {
  it('should process valid credentials', () => {
    const basicAuth = {
      name: 'testuser',
      pass: 'testpass'
    }
    
    const creds = processBasicAuthCredentials(basicAuth)
    
    expect(creds).toEqual({
      username: 'testuser',
      password: 'testpass'
    })
  })
  
  it('should escape username with HTML entities', () => {
    const basicAuth = {
      name: '<script>alert("xss")</script>',
      pass: 'testpass'
    }
    
    const creds = processBasicAuthCredentials(basicAuth)
    
    expect(creds.username).not.toContain('<script>')
    expect(creds.username).toContain('&lt;')
    expect(creds.password).toBe('testpass')
  })
  
  it('should handle missing fields', () => {
    const basicAuth = {}
    
    const creds = processBasicAuthCredentials(basicAuth)
    
    expect(creds).toEqual({
      username: '',
      password: ''
    })
  })
  
  it('should handle undefined name and pass', () => {
    const basicAuth = {
      name: undefined,
      pass: undefined
    }
    
    const creds = processBasicAuthCredentials(basicAuth)
    
    expect(creds).toEqual({
      username: '',
      password: ''
    })
  })
})

describe('processAuthentication', () => {
  it('should prefer config credentials over basic auth', () => {
    const config = createDefaultConfig()
    config.user.name = 'configuser'
    config.user.password = 'configpass'
    
    const basicAuth = {
      name: 'basicuser',
      pass: 'basicpass'
    }
    
    const result = processAuthentication(config, basicAuth)
    
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.credentials.username).toBe('configuser')
      expect(result.value.source).toBe('config')
    }
  })
  
  it('should use basic auth when no config credentials', () => {
    const config = createDefaultConfig()
    const basicAuth = {
      name: 'basicuser',
      pass: 'basicpass'
    }
    
    const result = processAuthentication(config, basicAuth)
    
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.credentials.username).toBe('basicuser')
      expect(result.value.source).toBe('basicAuth')
      expect(result.value.usedBasicAuth).toBe(true)
    }
  })
  
  it('should return error when no credentials available', () => {
    const config = createDefaultConfig()
    
    const result = processAuthentication(config, null)
    
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe(401)
      expect(result.error.message).toBe('Authentication required')
    }
  })
  
  it('should handle config with privateKey', () => {
    const config = createDefaultConfig()
    config.user.name = 'sshuser'
    config.user.privateKey = 'ssh-rsa-key'
    
    const result = processAuthentication(config)
    
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.credentials.username).toBe('sshuser')
      expect(result.value.credentials.privateKey).toBe('ssh-rsa-key')
      expect(result.value.source).toBe('config')
    }
  })
})

describe('createSessionData', () => {
  it('should create session data from auth result', () => {
    const authResult: AuthResult = {
      credentials: {
        username: 'testuser',
        password: 'testpass'
      },
      usedBasicAuth: true,
      source: 'basicAuth'
    }
    
    const sessionData = createSessionData(authResult)
    
    expect(sessionData).toEqual({
      sshCredentials: {
        username: 'testuser',
        password: 'testpass'
      },
      usedBasicAuth: true
    })
  })
  
  it('should include all credential fields when present', () => {
    const authResult: AuthResult = {
      credentials: {
        username: 'testuser',
        password: 'testpass',
        privateKey: 'ssh-key',
        passphrase: 'keypass'
      },
      usedBasicAuth: true,
      source: 'config'
    }
    
    const sessionData = createSessionData(authResult)
    
    expect(sessionData).toEqual({
      sshCredentials: {
        username: 'testuser',
        password: 'testpass',
        privateKey: 'ssh-key',
        passphrase: 'keypass'
      },
      usedBasicAuth: true
    })
  })
  
  it('should omit undefined fields', () => {
    const authResult: AuthResult = {
      credentials: {
        username: 'testuser'
      },
      usedBasicAuth: false,
      source: 'config'
    }
    
    const sessionData = createSessionData(authResult)
    const sshCreds = sessionData['sshCredentials'] as Record<string, unknown>
    
    expect(sshCreds['username']).toBe('testuser')
    expect(sshCreds['password']).toBeUndefined()
    expect(sshCreds['privateKey']).toBeUndefined()
    expect(sessionData['usedBasicAuth']).toBe(false)
  })
  
  it('should be pure - not mutate input', () => {
    const authResult: AuthResult = {
      credentials: {
        username: 'testuser',
        password: 'testpass'
      },
      usedBasicAuth: true,
      source: 'basicAuth'
    }
    const originalAuth = JSON.parse(JSON.stringify(authResult))
    
    createSessionData(authResult)
    
    expect(authResult).toEqual(originalAuth)
  })
})