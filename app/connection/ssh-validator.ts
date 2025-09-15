// app/connection/ssh-validator.ts
// Pure functions for SSH credential validation

import type { Credentials } from '../validation/credentials.js'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate SSH credentials format
 * @param creds - Credentials to validate
 * @returns Validation result
 * @pure
 */
export function validateCredentials(creds: Partial<Credentials>): ValidationResult {
  const errors: string[] = []
  
  if (creds.host == null || creds.host === '') {
    errors.push('Host is required')
  }
  
  if (creds.port != null && (creds.port < 1 || creds.port > 65535)) {
    errors.push('Port must be between 1 and 65535')
  }
  
  if (creds.username == null || creds.username === '') {
    errors.push('Username is required')
  }
  
  // Either password or private key is required
  if ((creds.password == null || creds.password === '') && 
      (creds.privateKey == null || creds.privateKey === '')) {
    errors.push('Either password or private key is required')
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Analyze SSH connection error to determine type
 * @param error - Error object from SSH connection
 * @returns Error type classification
 * @pure
 */
export function analyzeConnectionError(error: {
  code?: string
  level?: string
  message: string
}): 'network' | 'timeout' | 'auth' | 'unknown' {
  // Network/connectivity errors
  if (
    error.code === 'ENOTFOUND' ||
    error.message.includes('getaddrinfo') ||
    error.message.includes('ENOTFOUND')
  ) {
    return 'network' // DNS resolution failed
  }
  
  if (
    error.code === 'ECONNREFUSED' ||
    error.message.includes('Connection refused') ||
    error.message.includes('ECONNREFUSED')
  ) {
    return 'network' // Port closed or service not running
  }
  
  if (
    error.code === 'ETIMEDOUT' ||
    error.code === 'ECONNRESET' ||
    error.message.includes('timeout') ||
    error.message.includes('ETIMEDOUT')
  ) {
    return 'timeout' // Connection timeout
  }
  
  if (
    error.code === 'ENETUNREACH' ||
    error.message.includes('Network is unreachable') ||
    error.message.includes('ENETUNREACH')
  ) {
    return 'network' // Network unreachable
  }
  
  // Authentication errors
  if (
    error.level === 'client-authentication' ||
    error.message.includes('Authentication failed') ||
    error.message.includes('All configured authentication methods failed') ||
    error.message.includes('permission denied') ||
    error.message.toLowerCase().includes('password')
  ) {
    return 'auth'
  }
  
  return 'unknown'
}