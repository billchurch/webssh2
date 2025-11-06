import { describe, expect, it } from 'vitest'
import {
  evaluateAuthMethodPolicy,
  resolveRequestedAuthMethods,
  isAuthMethodAllowed
} from '../../../app/auth/auth-method-policy.js'
import { DEFAULT_AUTH_METHODS, AUTH_METHOD_TOKENS } from '../../../app/constants.js'
import { createAuthMethod } from '../../../app/types/branded.js'

describe('auth-method-policy', () => {
  const allowed = DEFAULT_AUTH_METHODS.map(createAuthMethod)

  it('respects allowed password authentication', () => {
    const result = evaluateAuthMethodPolicy(allowed, { password: 'secret' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.requested).toEqual(['password'])
    }
  })

  it('rejects disallowed private key authentication', () => {
    const result = evaluateAuthMethodPolicy(
      [createAuthMethod(AUTH_METHOD_TOKENS.PASSWORD)],
      { privateKey: '-----BEGIN RSA PRIVATE KEY-----' }
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toEqual({
        error: 'auth_method_disabled',
        method: 'publickey'
      })
    }
  })

  it('deduplicates requested methods while preserving order', () => {
    const requested = resolveRequestedAuthMethods({
      password: 'secret',
      privateKey: 'key',
      requestedKeyboardInteractive: true
    })

    expect(requested).toEqual(['password', 'publickey', 'keyboard-interactive'])
  })

  it('detects keyboard-interactive allowance', () => {
    expect(isAuthMethodAllowed(allowed, 'keyboard-interactive')).toBe(true)
    expect(
      isAuthMethodAllowed(
        [createAuthMethod(AUTH_METHOD_TOKENS.PUBLIC_KEY)],
        'keyboard-interactive'
      )
    ).toBe(false)
  })
})
