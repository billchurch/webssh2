// tests/unit/ssh/error-handler.test.ts

import { describe, it, expect } from 'vitest'
import {
  extractErrorMessage,
  categorizeError,
  createErrorInfo,
  formatErrorForLog,
  isRetryableError,
  getUserFriendlyMessage,
  SshErrorType
} from '../../../app/ssh/error-handler.js'

describe('extractErrorMessage', () => {
  it('extracts message from Error object', () => {
    const err = new Error('Connection failed')
    expect(extractErrorMessage(err)).toBe('Connection failed')
  })
  
  it('returns string errors as-is', () => {
    expect(extractErrorMessage('Simple error')).toBe('Simple error')
  })
  
  it('extracts message property from objects', () => {
    const err = { message: 'Auth failed', code: 'AUTH_ERR' }
    expect(extractErrorMessage(err)).toBe('Auth failed')
  })
  
  it('falls back to code property', () => {
    const err = { code: 'ECONNREFUSED' }
    expect(extractErrorMessage(err)).toBe('ECONNREFUSED')
  })
  
  it('uses toString for Error without message', () => {
    // eslint-disable-next-line unicorn/error-message
    const err = new Error()
    expect(extractErrorMessage(err)).toBe('Error')
  })
  
  it('handles null/undefined', () => {
    expect(extractErrorMessage(null)).toBe('[Unknown error]')
    expect(extractErrorMessage(undefined)).toBe('[Unknown error]')
  })
  
  it('handles objects without useful properties', () => {
    expect(extractErrorMessage({})).toBe('[Unknown error]')
    expect(extractErrorMessage({ foo: 'bar' })).toBe('[Unknown error]')
  })
})

describe('categorizeError', () => {
  it('identifies authentication errors', () => {
    expect(categorizeError({ message: 'Authentication failed' })).toBe(SshErrorType.AUTHENTICATION)
    expect(categorizeError({ message: 'Permission denied' })).toBe(SshErrorType.AUTHENTICATION)
    expect(categorizeError({ level: 'client-authentication' })).toBe(SshErrorType.AUTHENTICATION)
    expect(categorizeError({ code: 'AUTH_FAILED' })).toBe(SshErrorType.AUTHENTICATION)
  })
  
  it('identifies network errors', () => {
    expect(categorizeError({ code: 'ECONNREFUSED' })).toBe(SshErrorType.NETWORK)
    expect(categorizeError({ code: 'ENOTFOUND' })).toBe(SshErrorType.NETWORK)
    expect(categorizeError({ message: 'Connection refused' })).toBe(SshErrorType.NETWORK)
    expect(categorizeError({ message: 'Network unreachable' })).toBe(SshErrorType.NETWORK)
  })
  
  it('identifies timeout errors', () => {
    expect(categorizeError({ code: 'ETIMEDOUT' })).toBe(SshErrorType.TIMEOUT)
    expect(categorizeError({ message: 'Operation timed out' })).toBe(SshErrorType.TIMEOUT)
    expect(categorizeError({ message: 'Request timeout' })).toBe(SshErrorType.TIMEOUT)
  })
  
  it('identifies connection errors', () => {
    expect(categorizeError({ message: 'Connection lost' })).toBe(SshErrorType.CONNECTION)
    expect(categorizeError({ message: 'SSH connection failed' })).toBe(SshErrorType.CONNECTION)
  })
  
  it('returns UNKNOWN for unrecognized errors', () => {
    expect(categorizeError({ message: 'Something went wrong' })).toBe(SshErrorType.UNKNOWN)
    expect(categorizeError(null)).toBe(SshErrorType.UNKNOWN)
    expect(categorizeError({})).toBe(SshErrorType.UNKNOWN)
  })
})

describe('createErrorInfo', () => {
  it('creates complete error info', () => {
    const err = {
      message: 'Auth failed',
      code: 'AUTH_ERR',
      level: 'client-authentication'
    }
    
    const info = createErrorInfo(err)
    
    expect(info).toEqual({
      type: SshErrorType.AUTHENTICATION,
      message: 'Auth failed',
      code: 'AUTH_ERR',
      level: 'client-authentication',
      originalError: err
    })
  })
  
  it('handles Error objects', () => {
    const err = new Error('Network error')
    const info = createErrorInfo(err)
    
    expect(info).toEqual({
      type: SshErrorType.NETWORK,
      message: 'Network error',
      originalError: err
    })
  })
  
  it('handles string errors', () => {
    const info = createErrorInfo('Connection timeout')
    
    expect(info).toEqual({
      type: SshErrorType.TIMEOUT,
      message: 'Connection timeout',
      originalError: 'Connection timeout'
    })
  })
})

describe('formatErrorForLog', () => {
  it('formats error with all properties', () => {
    const err = {
      message: 'Auth failed',
      code: 'AUTH_ERR',
      level: 'client-authentication'
    }
    
    const formatted = formatErrorForLog(err)
    
    expect(formatted).toBe('[AUTHENTICATION] Auth failed (code: AUTH_ERR) (level: client-authentication)')
  })
  
  it('formats error with only message', () => {
    const err = new Error('Connection lost')
    const formatted = formatErrorForLog(err)
    
    expect(formatted).toBe('[CONNECTION] Connection lost')
  })
  
  it('formats unknown errors', () => {
    const formatted = formatErrorForLog(null)
    
    expect(formatted).toBe('[UNKNOWN] [Unknown error]')
  })
})

describe('isRetryableError', () => {
  it('identifies retryable errors', () => {
    expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true)
    expect(isRetryableError({ code: 'ECONNREFUSED' })).toBe(true)
    expect(isRetryableError({ message: 'Network error' })).toBe(true)
  })
  
  it('identifies non-retryable errors', () => {
    expect(isRetryableError({ message: 'Authentication failed' })).toBe(false)
    expect(isRetryableError({ message: 'Permission denied' })).toBe(false)
    expect(isRetryableError({ message: 'Unknown error' })).toBe(false)
  })
})

describe('getUserFriendlyMessage', () => {
  it('returns friendly message for authentication errors', () => {
    const msg = getUserFriendlyMessage({ message: 'Permission denied' })
    expect(msg).toBe('SSH authentication failed. Please check your credentials.')
  })
  
  it('returns friendly message for timeout errors', () => {
    const msg = getUserFriendlyMessage({ code: 'ETIMEDOUT' })
    expect(msg).toBe('Connection timed out. The server may be unreachable or slow to respond.')
  })
  
  it('returns friendly message for network errors', () => {
    const msg = getUserFriendlyMessage({ code: 'ECONNREFUSED' })
    expect(msg).toBe('Network error. Please check your connection and the server address.')
  })
  
  it('returns friendly message for connection errors', () => {
    const msg = getUserFriendlyMessage({ message: 'Connection failed' })
    expect(msg).toBe('Connection failed. The SSH server may be unavailable.')
  })
  
  it('includes original message for unknown errors', () => {
    const msg = getUserFriendlyMessage({ message: 'Weird error' })
    expect(msg).toBe('SSH error: Weird error')
  })
})