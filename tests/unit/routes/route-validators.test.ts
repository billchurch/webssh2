// tests/unit/routes/route-validators.test.ts

import { describe, it, expect } from 'vitest'
import {
  extractHost,
  extractPort,
  extractTerm,
  validatePostCredentials,
  validateSessionCredentials,
  createConnectionParams,
  createSanitizedCredentials,
  type RouteParams
} from '../../../dist/app/routes/route-validators.js'
import { createDefaultConfig } from '../../../dist/app/config/config-processor.js'
import type { Config } from '../../../dist/app/types/config.js'
import { TEST_PASSWORDS } from '../../test-constants.js'
import { PASSWORD_MASK } from '../../../dist/app/constants/security.js'

void describe('extractHost', () => {
  const config: Config = createDefaultConfig()

  it('prioritizes body.host over other sources', () => {
    const body: RouteParams = { host: 'body.com' }
    const query: RouteParams = { host: 'query.com', hostname: 'hostname.com' }
    config.ssh.host = 'config.com'

    const result = extractHost(body, query, config)
    
    expect(result).toBe('body.com')
  })
  
  it('falls back to query.host when body.host missing', () => {
    const body: RouteParams = {}
    const query: RouteParams = { host: 'query.com', hostname: 'hostname.com' }
    config.ssh.host = 'config.com'

    const result = extractHost(body, query, config)
    
    expect(result).toBe('query.com')
  })
  
  it('falls back to query.hostname when host missing', () => {
    const body: RouteParams = {}
    const query: RouteParams = { hostname: 'hostname.com' }
    config.ssh.host = 'config.com'

    const result = extractHost(body, query, config)
    
    expect(result).toBe('hostname.com')
  })
  
  it('falls back to config default', () => {
    const body: RouteParams = {}
    const query: RouteParams = {}
    config.ssh.host = 'config.com'

    const result = extractHost(body, query, config)
    
    expect(result).toBe('config.com')
  })
  
  it('returns null when no host available', () => {
    const body: RouteParams = {}
    const query: RouteParams = {}
    config.ssh.host = ''

    const result = extractHost(body, query, config)
    
    expect(result).toBe(null)
  })
})

void describe('extractPort', () => {
  it('prioritizes body.port over query.port', () => {
    const body: RouteParams = { port: 2222 }
    const query: RouteParams = { port: 3333 }

    const result = extractPort(body, query)
    
    expect(result).toBe(2222)
  })
  
  it('falls back to query.port', () => {
    const body: RouteParams = {}
    const query: RouteParams = { port: '3333' }

    const result = extractPort(body, query)
    
    expect(result).toBe(3333)
  })
  
  it('returns default port when none provided', () => {
    const body: RouteParams = {}
    const query: RouteParams = {}

    const result = extractPort(body, query)
    
    expect(result).toBe(22)
  })
  
  it('handles string port values', () => {
    const body: RouteParams = { port: '8022' }
    const query: RouteParams = {}

    const result = extractPort(body, query)
    
    expect(result).toBe(8022)
  })
})

void describe('extractTerm', () => {
  it('prioritizes body.sshterm over query.sshterm', () => {
    const body: RouteParams = { sshterm: 'xterm' }
    const query: RouteParams = { sshterm: 'vt100' }

    const result = extractTerm(body, query)
    
    expect(result).toBe('xterm')
  })
  
  it('falls back to query.sshterm', () => {
    const body: RouteParams = {}
    const query: RouteParams = { sshterm: 'xterm-256color' }

    const result = extractTerm(body, query)
    
    expect(result).toBe('xterm-256color')
  })
  
  it('returns null for invalid term', () => {
    const body: RouteParams = { sshterm: 'invalid<script>' }
    const query: RouteParams = {}

    const result = extractTerm(body, query)
    
    expect(result).toBe(null)
  })
})

void describe('validatePostCredentials', () => {
  it('validates complete credentials', () => {
    const body: RouteParams = {
      username: 'user',
      password: TEST_PASSWORDS.basic
    }

    const result = validatePostCredentials(body)
    
    expect(result).toEqual({
      valid: true,
      username: 'user',
      password: TEST_PASSWORDS.basic
    })
  })
  
  it('rejects missing username', () => {
    const body: RouteParams = {
      password: TEST_PASSWORDS.basic
    }

    const result = validatePostCredentials(body)
    
    expect(result).toEqual({
      valid: false,
      error: 'Missing required field: username'
    })
  })
  
  it('rejects missing password', () => {
    const body: RouteParams = {
      username: 'user'
    }
    
    const result = validatePostCredentials(body)
    
    expect(result).toEqual({
      valid: false,
      error: 'Missing required field: password'
    })
  })
  
  it('rejects empty username', () => {
    const body: RouteParams = {
      username: '',
      password: TEST_PASSWORDS.basic
    }

    const result = validatePostCredentials(body)
    
    expect(result.valid).toBe(false)
  })
})

void describe('validateSessionCredentials', () => {
  it('validates complete credentials', () => {
    const creds: { username?: string; password?: string } = {
      username: 'user',
      password: TEST_PASSWORDS.basic
    }
    
    expect(validateSessionCredentials(creds)).toBe(true)
  })
  
  it('rejects undefined credentials', () => {
    expect(validateSessionCredentials(undefined)).toBe(false)
  })
  
  it('rejects missing username', () => {
    const creds: { username?: string; password?: string } = {
      password: TEST_PASSWORDS.basic
    }
    
    expect(validateSessionCredentials(creds)).toBe(false)
  })
  
  it('rejects empty password', () => {
    const creds: { username?: string; password?: string } = {
      username: 'user',
      password: ''
    }
    
    expect(validateSessionCredentials(creds)).toBe(false)
  })
})

void describe('createConnectionParams', () => {
  it('creates params with all values', () => {
    const result = createConnectionParams('host.com', 2222, 'xterm')
    
    expect(result).toEqual({
      host: 'host.com',
      port: 2222,
      term: 'xterm'
    })
  })
  
  it('handles string port', () => {
    const result = createConnectionParams('host.com', '3333', undefined)
    
    expect(result).toEqual({
      host: 'host.com',
      port: 3333,
      term: null
    })
  })
  
  it('uses default port when undefined', () => {
    const result = createConnectionParams('host.com')
    
    expect(result).toEqual({
      host: 'host.com',
      port: 22,
      term: null
    })
  })
})

void describe('createSanitizedCredentials', () => {
  it('masks password', () => {
    const result = createSanitizedCredentials('host.com', 22, 'user')
    
    expect(result).toEqual({
      host: 'host.com',
      port: 22,
      username: 'user',
      password: PASSWORD_MASK
    })
  })
})