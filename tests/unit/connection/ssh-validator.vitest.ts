// tests/unit/connection/ssh-validator.vitest.ts

import { describe, it, expect } from 'vitest'
import {
  validateCredentials,
  analyzeConnectionError,
  enhanceErrorMessage
} from '../../../app/connection/ssh-validator.js'

describe('validateCredentials', () => {
  it('validates complete credentials', () => {
    const result = validateCredentials({
      host: 'example.com',
      port: 22,
      username: 'user',
      password: 'pass'
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('validates credentials with private key instead of password', () => {
    const result = validateCredentials({
      host: 'example.com',
      port: 22,
      username: 'user',
      privateKey: '-----BEGIN PRIVATE KEY-----'
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects missing host', () => {
    const result = validateCredentials({
      port: 22,
      username: 'user',
      password: 'pass'
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Host is required')
  })

  it('rejects missing username', () => {
    const result = validateCredentials({
      host: 'example.com',
      port: 22,
      password: 'pass'
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Username is required')
  })

  it('rejects missing authentication method', () => {
    const result = validateCredentials({
      host: 'example.com',
      port: 22,
      username: 'user'
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Either password or private key is required')
  })

  it('rejects invalid port range', () => {
    const result = validateCredentials({
      host: 'example.com',
      port: 70000,
      username: 'user',
      password: 'pass'
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Port must be between 1 and 65535')
  })
})

describe('analyzeConnectionError', () => {
  it('identifies DNS resolution errors by code', () => {
    const result = analyzeConnectionError({
      code: 'ENOTFOUND',
      message: 'getaddrinfo ENOTFOUND example.com'
    })

    expect(result).toBe('network')
  })

  it('identifies DNS resolution errors by message', () => {
    const result = analyzeConnectionError({
      message: 'getaddrinfo ENOTFOUND myhost'
    })

    expect(result).toBe('network')
  })

  it('identifies connection refused errors', () => {
    const result = analyzeConnectionError({
      code: 'ECONNREFUSED',
      message: 'connect ECONNREFUSED 192.168.1.1:22'
    })

    expect(result).toBe('network')
  })

  it('identifies timeout errors', () => {
    const result = analyzeConnectionError({
      code: 'ETIMEDOUT',
      message: 'connect ETIMEDOUT'
    })

    expect(result).toBe('timeout')
  })

  it('identifies authentication errors by level', () => {
    const result = analyzeConnectionError({
      level: 'client-authentication',
      message: 'All configured authentication methods failed'
    })

    expect(result).toBe('auth')
  })

  it('identifies authentication errors by message', () => {
    const result = analyzeConnectionError({
      message: 'Authentication failed'
    })

    expect(result).toBe('auth')
  })

  it('returns unknown for unrecognized errors', () => {
    const result = analyzeConnectionError({
      message: 'Something unexpected happened'
    })

    expect(result).toBe('unknown')
  })
})

describe('enhanceErrorMessage', () => {
  it('enhances DNS resolution errors with Docker hint', () => {
    const result = enhanceErrorMessage({
      code: 'ENOTFOUND',
      message: 'getaddrinfo ENOTFOUND myhost'
    })

    expect(result).toContain('DNS resolution failed for \'myhost\'')
    expect(result).toContain('If running in Docker, ensure DNS is configured')
    expect(result).toContain('--dns 8.8.8.8')
    expect(result).toContain('https://github.com/billchurch/webssh2/blob/main/DOCS/getting-started/DOCKER.md#dns-resolution-for-ssh-hostnames')
  })

  it('enhances DNS errors without ENOTFOUND in message', () => {
    const result = enhanceErrorMessage({
      code: 'ENOTFOUND',
      message: 'getaddrinfo server.local'
    })

    expect(result).toContain('DNS resolution failed for \'server.local\'')
    expect(result).toContain('Docker')
  })

  it('handles DNS errors with ENOTFOUND in message', () => {
    const result = enhanceErrorMessage({
      message: 'getaddrinfo ENOTFOUND database-host'
    })

    expect(result).toContain('DNS resolution failed for \'database-host\'')
  })

  it('sanitizes hostname to prevent injection', () => {
    const result = enhanceErrorMessage({
      code: 'ENOTFOUND',
      message: 'getaddrinfo ENOTFOUND host<script>alert(1)</script>'
    })

    // Should extract sanitized hostname (only valid hostname chars)
    expect(result).toContain('DNS resolution failed')
    expect(result).not.toContain('<script>')
  })

  it('handles missing hostname gracefully', () => {
    const result = enhanceErrorMessage({
      code: 'ENOTFOUND',
      message: 'getaddrinfo'
    })

    expect(result).toContain('DNS resolution failed for \'hostname\'')
  })

  it('returns original message for non-DNS errors', () => {
    const result = enhanceErrorMessage({
      code: 'ECONNREFUSED',
      message: 'Connection refused'
    })

    expect(result).toBe('Connection refused')
  })

  it('returns original message for timeout errors', () => {
    const result = enhanceErrorMessage({
      code: 'ETIMEDOUT',
      message: 'Operation timed out'
    })

    expect(result).toBe('Operation timed out')
  })

  it('returns original message for authentication errors', () => {
    const result = enhanceErrorMessage({
      message: 'Authentication failed'
    })

    expect(result).toBe('Authentication failed')
  })

  it('limits hostname length to prevent issues', () => {
    const longHostname = 'a'.repeat(300)
    const result = enhanceErrorMessage({
      code: 'ENOTFOUND',
      message: `getaddrinfo ENOTFOUND ${longHostname}`
    })

    // Should truncate to 253 characters (max DNS label length)
    expect(result).toContain('DNS resolution failed')
    const match = result.match(/DNS resolution failed for '([^']+)'/)
    expect(match).not.toBe(null)
    if (match !== null) {
      expect(match[1]?.length).toBeLessThanOrEqual(253)
    }
  })
})
