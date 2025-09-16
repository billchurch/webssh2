// tests/unit/routes/session-handler.test.ts

import { describe, it, expect } from 'vitest'
import {
  createSessionCredentials,
  createPostAuthSession,
  getAuthRelatedKeys,
  getReauthClearKeys,
  hasValidSessionCredentials,
  mergeSessionData,
  type SessionData
} from '../../../app/routes/session-handler.js'

describe('createSessionCredentials', () => {
  it('creates credentials with all fields', () => {
    const result = createSessionCredentials(
      'host.com',
      2222,
      'user',
      'pass',
      'xterm'
    )
    
    expect(result).toEqual({
      host: 'host.com',
      port: 2222,
      username: 'user',
      password: 'pass',
      term: 'xterm'
    })
  })
  
  it('omits term when null', () => {
    const result = createSessionCredentials(
      'host.com',
      22,
      'user',
      'pass',
      null
    )
    
    expect(result).toEqual({
      host: 'host.com',
      port: 22,
      username: 'user',
      password: 'pass'
    })
  })
  
  it('omits term when empty string', () => {
    const result = createSessionCredentials(
      'host.com',
      22,
      'user',
      'pass',
      ''
    )
    
    expect(result?.term).toBeUndefined()
  })
})

describe('createPostAuthSession', () => {
  it('creates session with POST auth method', () => {
    const credentials = {
      host: 'host.com',
      port: 22,
      username: 'user',
      password: 'pass'
    }
    
    const result = createPostAuthSession(credentials)
    
    expect(result).toEqual({
      authMethod: 'POST',
      sshCredentials: credentials
    })
  })
})

describe('getAuthRelatedKeys', () => {
  it('identifies SSH-related keys', () => {
    const keys = [
      'sshCredentials',
      'sshHost',
      'normalKey',
      'authMethod',
      'authenticated',
      'userCredentials',
      'someOtherKey'
    ]
    
    const result = getAuthRelatedKeys(keys)
    
    expect(result).toEqual([
      'sshCredentials',
      'sshHost',
      'authMethod',
      'authenticated',
      'userCredentials'
    ])
  })
  
  it('returns empty array for no matching keys', () => {
    const keys = ['foo', 'bar', 'baz']
    
    const result = getAuthRelatedKeys(keys)
    
    expect(result).toEqual([])
  })
})

describe('getReauthClearKeys', () => {
  it('returns standard reauth keys', () => {
    const result = getReauthClearKeys()
    
    expect(result).toEqual([
      'sshCredentials',
      'usedBasicAuth',
      'authMethod'
    ])
  })
})

describe('hasValidSessionCredentials', () => {
  it('validates complete credentials', () => {
    const session: SessionData = {
      sshCredentials: {
        username: 'user',
        password: 'pass'
      }
    }
    
    expect(hasValidSessionCredentials(session)).toBe(true)
  })
  
  it('rejects missing credentials', () => {
    const session: SessionData = {}
    
    expect(hasValidSessionCredentials(session)).toBe(false)
  })
  
  it('rejects empty username', () => {
    const session: SessionData = {
      sshCredentials: {
        username: '',
        password: 'pass'
      }
    }
    
    expect(hasValidSessionCredentials(session)).toBe(false)
  })
  
  it('rejects undefined password', () => {
    const session: SessionData = {
      sshCredentials: {
        username: 'user'
      }
    }
    
    expect(hasValidSessionCredentials(session)).toBe(false)
  })
})

describe('mergeSessionData', () => {
  it('merges session updates', () => {
    const existing: SessionData = {
      sshCredentials: {
        username: 'user1'
      },
      authMethod: 'GET'
    }
    
    const updates: Partial<SessionData> = {
      authMethod: 'POST',
      usedBasicAuth: true
    }
    
    const result = mergeSessionData(existing, updates)
    
    expect(result).toEqual({
      sshCredentials: {
        username: 'user1'
      },
      authMethod: 'POST',
      usedBasicAuth: true
    })
  })
  
  it('does not mutate original', () => {
    const existing: SessionData = {
      authMethod: 'GET'
    }
    const originalCopy = { ...existing }
    
    mergeSessionData(existing, { authMethod: 'POST' })
    
    expect(existing).toEqual(originalCopy)
  })
})