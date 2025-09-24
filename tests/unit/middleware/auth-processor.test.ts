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
import { createDefaultConfig } from '../../../app/config/config-processor.js'
import { 
  TEST_USERNAME, 
  TEST_PASSWORD, 
  TEST_PRIVATE_KEY, 
  TEST_PASSPHRASE,
  TEST_PASSWORDS,
  TEST_SSH_KEY,
  CONFIG_USERNAME,
  BASIC_USERNAME,
  SSH_USERNAME
} from '../../test-constants.js'

describe('hasConfigCredentials', () => {
  it('should return false for empty config credentials', () => {
    const config = createDefaultConfig()
    
    expect(hasConfigCredentials(config)).toBe(false)
  })
  
  it('should return true when username and password are provided', () => {
    const config = createDefaultConfig()
    config.user.name = TEST_USERNAME
    config.user.password = TEST_PASSWORD
    
    expect(hasConfigCredentials(config)).toBe(true)
  })
  
  it('should return true when username and privateKey are provided', () => {
    const config = createDefaultConfig()
    config.user.name = TEST_USERNAME
    config.user.privateKey = TEST_PRIVATE_KEY
    
    expect(hasConfigCredentials(config)).toBe(true)
  })
  
  it('should return false when only username is provided', () => {
    const config = createDefaultConfig()
    config.user.name = TEST_USERNAME
    
    expect(hasConfigCredentials(config)).toBe(false)
  })
  
  it('should return false when username is empty string', () => {
    const config = createDefaultConfig()
    config.user.name = ''
    config.user.password = TEST_PASSWORD
    
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
    config.user.name = TEST_USERNAME
    config.user.password = TEST_PASSWORD
    
    const creds = extractConfigCredentials(config)
    
    expect(creds).toEqual({
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    })
  })
  
  it('should extract username and privateKey', () => {
    const config = createDefaultConfig()
    config.user.name = TEST_USERNAME
    config.user.privateKey = TEST_SSH_KEY
    
    const creds = extractConfigCredentials(config)
    
    expect(creds).toEqual({
      username: TEST_USERNAME,
      privateKey: TEST_SSH_KEY
    })
  })
  
  it('should extract all credential fields when present', () => {
    const config = createDefaultConfig()
    config.user.name = TEST_USERNAME
    config.user.password = TEST_PASSWORD
    config.user.privateKey = TEST_SSH_KEY
    config.user.passphrase = TEST_PASSPHRASE
    
    const creds = extractConfigCredentials(config)
    
    expect(creds).toEqual({
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
      privateKey: TEST_SSH_KEY,
      passphrase: TEST_PASSPHRASE
    })
  })
})

describe('processBasicAuthCredentials', () => {
  it('should process valid credentials', () => {
    const basicAuth = {
      name: TEST_USERNAME,
      pass: TEST_PASSWORD
    }
    
    const creds = processBasicAuthCredentials(basicAuth)
    
    expect(creds).toEqual({
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    })
  })
  
  it('should escape username with HTML entities', () => {
    const basicAuth = {
      name: '<script>alert("xss")</script>',
      pass: TEST_PASSWORD
    }
    
    const creds = processBasicAuthCredentials(basicAuth)
    
    expect(creds.username).not.toContain('<script>')
    expect(creds.username).toContain('&lt;')
    expect(creds.password).toBe(TEST_PASSWORD)
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
    config.user.name = CONFIG_USERNAME
    config.user.password = TEST_PASSWORDS.configPass
    
    const basicAuth = {
      name: BASIC_USERNAME,
      pass: TEST_PASSWORDS.basicPass
    }
    
    const result = processAuthentication(config, basicAuth)
    
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.credentials.username).toBe(CONFIG_USERNAME)
      expect(result.value.source).toBe('config')
    }
  })
  
  it('should use basic auth when no config credentials', () => {
    const config = createDefaultConfig()
    const basicAuth = {
      name: BASIC_USERNAME,
      pass: TEST_PASSWORDS.basicPass
    }
    
    const result = processAuthentication(config, basicAuth)
    
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.credentials.username).toBe(BASIC_USERNAME)
      expect(result.value.source).toBe('basicAuth')
      expect(result.value.usedBasicAuth).toBe(true)
    }
  })
  
  it('should return error when no credentials available', () => {
    const config = createDefaultConfig()
    
    const result = processAuthentication(config, null)
    
    expect(result.ok).toBe(false)
    if (!result.ok && 'error' in result) {
      expect(result.error.code).toBe(401)
      expect(result.error.message).toBe('Authentication required')
    }
  })
  
  it('should handle config with privateKey', () => {
    const config = createDefaultConfig()
    config.user.name = SSH_USERNAME
    config.user.privateKey = TEST_SSH_KEY
    
    const result = processAuthentication(config)
    
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.credentials.username).toBe(SSH_USERNAME)
      expect(result.value.credentials.privateKey).toBe(TEST_SSH_KEY)
      expect(result.value.source).toBe('config')
    }
  })
})

describe('createSessionData', () => {
  it('should create session data from auth result', () => {
    const authResult: AuthResult = {
      credentials: {
        username: TEST_USERNAME,
        password: TEST_PASSWORD
      },
      usedBasicAuth: true,
      source: 'basicAuth'
    }
    
    const sessionData = createSessionData(authResult)
    
    expect(sessionData).toEqual({
      sshCredentials: {
        username: TEST_USERNAME,
        password: TEST_PASSWORD
      },
      usedBasicAuth: true
    })
  })
  
  it('should include all credential fields when present', () => {
    const authResult: AuthResult = {
      credentials: {
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
        privateKey: TEST_SSH_KEY,
        passphrase: TEST_PASSPHRASE
      },
      usedBasicAuth: true,
      source: 'config'
    }
    
    const sessionData = createSessionData(authResult)
    
    expect(sessionData).toEqual({
      sshCredentials: {
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
        privateKey: TEST_SSH_KEY,
        passphrase: TEST_PASSPHRASE
      },
      usedBasicAuth: true
    })
  })
  
  it('should omit undefined fields', () => {
    const authResult: AuthResult = {
      credentials: {
        username: TEST_USERNAME
      },
      usedBasicAuth: false,
      source: 'config'
    }
    
    const sessionData = createSessionData(authResult)
    const sshCreds = sessionData['sshCredentials'] as Record<string, unknown>
    
    expect(sshCreds['username']).toBe(TEST_USERNAME)
    expect(sshCreds['password']).toBeUndefined()
    expect(sshCreds['privateKey']).toBeUndefined()
    expect(sessionData['usedBasicAuth']).toBe(false)
  })
  
  it('should be pure - not mutate input', () => {
    const authResult: AuthResult = {
      credentials: {
        username: TEST_USERNAME,
        password: TEST_PASSWORD
      },
      usedBasicAuth: true,
      source: 'basicAuth'
    }
    const originalAuth = JSON.parse(JSON.stringify(authResult)) as AuthResult
    
    createSessionData(authResult)
    
    expect(authResult).toEqual(originalAuth)
  })
})