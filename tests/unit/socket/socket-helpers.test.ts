// tests/unit/socket/socket-helpers.test.ts
// Tests for socket helper functions

import { describe, it, expect } from 'vitest'
import {
  createInitialSessionState,
  extractTerminalConfig,
  mergeSessionState,
  isValidDimension,
  getDefaultTerminalConfig,
  hasValidSshCredentials,
  createErrorPayload,
  type SessionState
} from '../../../app/socket/socket-helpers.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'

describe('createInitialSessionState', () => {
  it('should create state with all null/false values', () => {
    const state = createInitialSessionState()
    
    expect(state.authenticated).toBe(false)
    expect(state.username).toBe(null)
    expect(state.password).toBe(null)
    expect(state.host).toBe(null)
    expect(state.port).toBe(null)
    expect(state.term).toBe(null)
  })
  
  it('should be pure function', () => {
    const state1 = createInitialSessionState()
    const state2 = createInitialSessionState()
    
    expect(state1).toEqual(state2)
    expect(state1).not.toBe(state2)
  })
})

describe('extractTerminalConfig', () => {
  it('should extract valid terminal config', () => {
    const creds = {
      term: 'xterm-256color',
      cols: 120,
      rows: 40,
      other: 'data'
    }
    
    const config = extractTerminalConfig(creds)
    
    expect(config).toEqual({
      term: 'xterm-256color',
      cols: 120,
      rows: 40
    })
  })
  
  it('should return null for invalid types', () => {
    const creds = {
      term: 123,
      cols: '80',
      rows: null
    }
    
    const config = extractTerminalConfig(creds)
    
    expect(config).toEqual({
      term: null,
      cols: null,
      rows: null
    })
  })
  
  it('should handle missing fields', () => {
    const config = extractTerminalConfig({})
    
    expect(config).toEqual({
      term: null,
      cols: null,
      rows: null
    })
  })
})

describe('mergeSessionState', () => {
  it('should merge state updates', () => {
    const initial = createInitialSessionState()
    const updates: Partial<SessionState> = {
      authenticated: true,
      username: 'testuser',
      host: 'example.com'
    }
    
    const merged = mergeSessionState(initial, updates)
    
    expect(merged.authenticated).toBe(true)
    expect(merged.username).toBe('testuser')
    expect(merged.host).toBe('example.com')
    expect(merged.password).toBe(null) // Unchanged
  })
  
  it('should be pure - not mutate inputs', () => {
    const initial = createInitialSessionState()
    const updates = { authenticated: true }
    const originalInitial = { ...initial }
    
    mergeSessionState(initial, updates)
    
    expect(initial).toEqual(originalInitial)
  })
})

describe('isValidDimension', () => {
  it('should validate valid dimensions', () => {
    expect(isValidDimension(80)).toBe(true)
    expect(isValidDimension(24)).toBe(true)
    expect(isValidDimension(999)).toBe(true)
  })
  
  it('should reject invalid dimensions', () => {
    expect(isValidDimension(0)).toBe(false)
    expect(isValidDimension(-1)).toBe(false)
    expect(isValidDimension(1000)).toBe(false)
    expect(isValidDimension('80')).toBe(false)
    expect(isValidDimension(null)).toBe(false)
    expect(isValidDimension(undefined)).toBe(false)
  })
})

describe('getDefaultTerminalConfig', () => {
  it('should return default terminal config', () => {
    const config = createDefaultConfig('secret')
    
    const termConfig = getDefaultTerminalConfig(config)
    
    expect(termConfig).toEqual({
      term: 'xterm-256color',
      cols: 80,
      rows: 24
    })
  })
  
  it('should use config term if provided', () => {
    const config = createDefaultConfig('secret')
    config.ssh.term = 'vt100'
    
    const termConfig = getDefaultTerminalConfig(config)
    
    expect(termConfig.term).toBe('vt100')
  })
})

describe('hasValidSshCredentials', () => {
  it('should validate complete credentials with password', () => {
    const state: SessionState = {
      ...createInitialSessionState(),
      host: 'example.com',
      username: 'user',
      password: 'pass'
    }
    
    expect(hasValidSshCredentials(state)).toBe(true)
  })
  
  it('should validate complete credentials with private key', () => {
    const state: SessionState = {
      ...createInitialSessionState(),
      host: 'example.com',
      username: 'user',
      privateKey: 'ssh-rsa...'
    }
    
    expect(hasValidSshCredentials(state)).toBe(true)
  })
  
  it('should reject incomplete credentials', () => {
    const noHost = { ...createInitialSessionState(), username: 'user', password: 'pass' }
    const noUser = { ...createInitialSessionState(), host: 'example.com', password: 'pass' }
    const noAuth = { ...createInitialSessionState(), host: 'example.com', username: 'user' }
    
    expect(hasValidSshCredentials(noHost)).toBe(false)
    expect(hasValidSshCredentials(noUser)).toBe(false)
    expect(hasValidSshCredentials(noAuth)).toBe(false)
  })
  
  it('should reject empty strings', () => {
    const state: SessionState = {
      ...createInitialSessionState(),
      host: '',
      username: '',
      password: 'pass'
    }
    
    expect(hasValidSshCredentials(state)).toBe(false)
  })
})

describe('createErrorPayload', () => {
  it('should create error payload with message', () => {
    const payload = createErrorPayload('Connection failed')
    
    expect(payload.message).toBe('Connection failed')
    expect(payload.timestamp).toBeGreaterThan(0)
    expect(payload.code).toBeUndefined()
  })
  
  it('should include code when provided', () => {
    const payload = createErrorPayload('Auth failed', 'AUTH_ERROR')
    
    expect(payload.message).toBe('Auth failed')
    expect(payload.code).toBe('AUTH_ERROR')
    expect(payload.timestamp).toBeGreaterThan(0)
  })
  
  it('should generate different timestamps', () => {
    const payload1 = createErrorPayload('Error 1')
    const payload2 = createErrorPayload('Error 2')
    
    // Timestamps should be close but possibly different
    expect(payload2.timestamp).toBeGreaterThanOrEqual(payload1.timestamp)
  })
})