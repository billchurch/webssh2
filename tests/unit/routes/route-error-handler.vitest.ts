// tests/unit/routes/route-error-handler.test.ts

import { describe, it, expect } from 'vitest'
import {
  createSshValidationErrorResponse,
  createRouteErrorMessage,
  getErrorStatusCode,
  type SshValidationResult,
  type ErrorResponse
} from '../../../app/routes/route-error-handler.js'
import { HTTP } from '../../../app/constants.js'

void describe('createSshValidationErrorResponse', () => {
  it('returns 401 with auth header for auth errors', () => {
    const result: SshValidationResult = {
      errorType: 'auth',
      errorMessage: 'Invalid credentials'
    }
    
    const response: ErrorResponse = createSshValidationErrorResponse(result, 'host.com', 22)
    
    expect(response.status).toBe(HTTP.UNAUTHORIZED)
    expect(response.headers).toEqual({
      [HTTP.AUTHENTICATE]: HTTP.REALM
    })
    expect(response.message).toBe('SSH authentication failed')
  })
  
  it('returns 502 for network errors', () => {
    const result: SshValidationResult = {
      errorType: 'network',
      errorMessage: 'Connection refused'
    }
    
    const response: ErrorResponse = createSshValidationErrorResponse(result, 'host.com', 22)
    
    expect(response.status).toBe(502)
    expect(response.headers).toBeUndefined()
    expect(response.message).toContain('Unable to connect to SSH server')
    expect(response.message).toContain('host.com:22')
    expect(response.message).toContain('Connection refused')
  })
  
  it('returns 504 for timeout errors', () => {
    const result: SshValidationResult = {
      errorType: 'timeout',
      errorMessage: 'Operation timed out'
    }
    
    const response: ErrorResponse = createSshValidationErrorResponse(result, 'host.com', 22)
    
    expect(response.status).toBe(504)
    expect(response.message).toContain('Gateway Timeout')
    expect(response.message).toContain('host.com:22')
  })
  
  it('returns 502 for unknown errors', () => {
    const result: SshValidationResult = {
      errorType: 'unknown',
      errorMessage: 'Something went wrong'
    }
    
    const response: ErrorResponse = createSshValidationErrorResponse(result, 'host.com', 22)
    
    expect(response.status).toBe(502)
    expect(response.message).toContain('SSH connection failed')
    expect(response.message).toContain('Something went wrong')
  })
  
  it('returns 502 for undefined error type', () => {
    const result: SshValidationResult = {
      errorMessage: 'Generic error'
    }
    
    const response: ErrorResponse = createSshValidationErrorResponse(result, 'host.com', 22)
    
    expect(response.status).toBe(502)
    expect(response.message).toContain('SSH connection failed')
  })
})

void describe('createRouteErrorMessage', () => {
  it('formats error message correctly', () => {
    const error = new Error('Database connection failed')
    
    const message = createRouteErrorMessage(error)
    
    expect(message).toBe('Invalid configuration: Database connection failed')
  })
  
  it('handles empty error message', () => {
    const error = new Error('')
    
    const message = createRouteErrorMessage(error)
    
    expect(message).toBe('Invalid configuration: ')
  })
})

void describe('getErrorStatusCode', () => {
  it('returns 400 for required field errors', () => {
    expect(getErrorStatusCode(new Error('Field is required'))).toBe(400)
    expect(getErrorStatusCode(new Error('required parameter missing'))).toBe(400)
  })
  
  it('returns 401 for authentication errors', () => {
    expect(getErrorStatusCode(new Error('authentication failed'))).toBe(HTTP.UNAUTHORIZED)
    expect(getErrorStatusCode(new Error('User is unauthorized'))).toBe(HTTP.UNAUTHORIZED)
  })
  
  it('returns 504 for timeout errors', () => {
    expect(getErrorStatusCode(new Error('Request timeout'))).toBe(504)
    expect(getErrorStatusCode(new Error('Operation timed out'))).toBe(504)
  })
  
  it('returns 502 for connection errors', () => {
    expect(getErrorStatusCode(new Error('Failed to connect'))).toBe(502)
    expect(getErrorStatusCode(new Error('network error occurred'))).toBe(502)
  })
  
  it('returns 500 for generic errors', () => {
    expect(getErrorStatusCode(new Error('Something went wrong'))).toBe(500)
    expect(getErrorStatusCode(new Error('Internal error'))).toBe(500)
  })
})