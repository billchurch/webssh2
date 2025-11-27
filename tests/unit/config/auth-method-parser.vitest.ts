import { describe, expect, it } from 'vitest'
import { resolveAllowedAuthMethods } from '../../../app/config/auth-method-parser.js'
import { AUTH_METHOD_TOKENS, DEFAULT_AUTH_METHODS } from '../../../app/constants/index.js'

describe('resolveAllowedAuthMethods', () => {
  it('returns default methods when no raw values provided', () => {
    const result = resolveAllowedAuthMethods()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.methods).toHaveLength(DEFAULT_AUTH_METHODS.length)
      expect(result.value.methods.map(method => `${method}`)).toEqual(DEFAULT_AUTH_METHODS)
      expect(result.value.warnings).toHaveLength(0)
    }
  })

  it('deduplicates known methods while preserving order', () => {
    const rawValues = [
      AUTH_METHOD_TOKENS.PUBLIC_KEY,
      AUTH_METHOD_TOKENS.PASSWORD,
      AUTH_METHOD_TOKENS.PASSWORD,
      AUTH_METHOD_TOKENS.KEYBOARD_INTERACTIVE,
    ]

    const result = resolveAllowedAuthMethods({ rawValues })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.methods.map(method => `${method}`)).toEqual([
        AUTH_METHOD_TOKENS.PUBLIC_KEY,
        AUTH_METHOD_TOKENS.PASSWORD,
        AUTH_METHOD_TOKENS.KEYBOARD_INTERACTIVE,
      ])
    }
  })

  it('emits warnings for unknown tokens and ignores them', () => {
    const result = resolveAllowedAuthMethods({
      rawValues: ['publickey', 'unsupported', 'keyboard-interactive', 'UNSUPPORTED'],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.methods.map(method => `${method}`)).toEqual([
        AUTH_METHOD_TOKENS.PUBLIC_KEY,
        AUTH_METHOD_TOKENS.KEYBOARD_INTERACTIVE,
      ])
      expect(result.value.warnings).toEqual([
        { type: 'unknown-token', token: 'unsupported' },
      ])
    }
  })

  it('fails when no valid methods remain after filtering', () => {
    const result = resolveAllowedAuthMethods({ rawValues: ['unknown'] })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('empty-allow-list')
    }
  })

  it('normalizes tokens case-insensitively', () => {
    const result = resolveAllowedAuthMethods({
      rawValues: ['PASSWORD', 'PublicKey'],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.methods.map(method => `${method}`)).toEqual([
        AUTH_METHOD_TOKENS.PASSWORD,
        AUTH_METHOD_TOKENS.PUBLIC_KEY,
      ])
    }
  })
})
