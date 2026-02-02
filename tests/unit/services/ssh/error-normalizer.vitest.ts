/* eslint-disable unicorn/error-message -- Testing empty error message handling is the purpose of these tests */
import { describe, it, expect } from 'vitest'
import { normalizeSSHErrorMessage } from '../../../../app/services/ssh/error-normalizer.js'

describe('normalizeSSHErrorMessage', () => {
  describe('non-Error inputs', () => {
    it('should return "Unknown SSH error" for non-Error inputs', () => {
      expect(normalizeSSHErrorMessage('string error')).toBe('Unknown SSH error')
      expect(normalizeSSHErrorMessage(null)).toBe('Unknown SSH error')
      expect(normalizeSSHErrorMessage(undefined)).toBe('Unknown SSH error')
      expect(normalizeSSHErrorMessage({ message: 'object' })).toBe('Unknown SSH error')
    })
  })

  describe('Error with message', () => {
    it('should return the error message when non-empty', () => {
      const error = new Error('Connection refused')
      expect(normalizeSSHErrorMessage(error)).toBe('Connection refused')
    })

    it('should not return empty message', () => {
      const error = new Error('')
      expect(normalizeSSHErrorMessage(error)).not.toBe('')
    })
  })

  describe('Error with code (network errors)', () => {
    it('should return error code when message is empty', () => {
      const error = new Error('')
      ;(error as Error & { code: string }).code = 'ECONNREFUSED'
      expect(normalizeSSHErrorMessage(error)).toBe('ECONNREFUSED')
    })

    it('should return error code ENOTFOUND when message is empty', () => {
      const error = new Error('')
      ;(error as Error & { code: string }).code = 'ENOTFOUND'
      expect(normalizeSSHErrorMessage(error)).toBe('ENOTFOUND')
    })

    it('should prefer message over code when message is non-empty', () => {
      const error = new Error('Custom message')
      ;(error as Error & { code: string }).code = 'ECONNREFUSED'
      expect(normalizeSSHErrorMessage(error)).toBe('Custom message')
    })
  })

  describe('Error with stack trace containing code', () => {
    it('should extract code from AggregateError stack trace', () => {
      const error = new Error('')
      error.stack = 'AggregateError [ECONNREFUSED]: connect ECONNREFUSED'
      expect(normalizeSSHErrorMessage(error)).toBe('ECONNREFUSED')
    })

    it('should extract error type from stack when no code in brackets', () => {
      const error = new Error('')
      error.stack = 'TypeError: something went wrong'
      expect(normalizeSSHErrorMessage(error)).toBe('TypeError')
    })

    it('should not return "Error" from stack', () => {
      const error = new Error('')
      error.stack = 'Error: something'
      // Should fall through to error name or default
      expect(normalizeSSHErrorMessage(error)).not.toBe('Error')
    })
  })

  describe('Error with name', () => {
    it('should use error name when message, code, and stack parsing fail', () => {
      const error = new Error('')
      error.name = 'AggregateError'
      error.stack = undefined
      expect(normalizeSSHErrorMessage(error)).toBe('AggregateError')
    })

    it('should not return "Error" as name', () => {
      const error = new Error('')
      error.name = 'Error'
      error.stack = undefined
      expect(normalizeSSHErrorMessage(error)).toBe('Connection failed')
    })
  })

  describe('fallback', () => {
    it('should return "Connection failed" when all else fails', () => {
      const error = new Error('')
      error.name = ''
      error.stack = undefined
      expect(normalizeSSHErrorMessage(error)).toBe('Connection failed')
    })
  })
})
