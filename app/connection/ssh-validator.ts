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
  const normalizedMessage = error.message.toLowerCase()

  if (isDnsResolutionIssue(error.code, normalizedMessage)) {
    return 'network'
  }

  if (isConnectionRefused(error.code, normalizedMessage)) {
    return 'network'
  }

  if (isTimeoutScenario(error.code, normalizedMessage)) {
    return 'timeout'
  }

  if (isNetworkUnreachable(error.code, normalizedMessage)) {
    return 'network'
  }

  if (isAuthenticationFailure(error.level, normalizedMessage)) {
    return 'auth'
  }

  return 'unknown'
}

const isDnsResolutionIssue = (code: string | undefined, message: string): boolean => {
  if (codeMatches(code, DNS_ERROR_CODES)) {
    return true
  }
  return messageContains(message, DNS_MESSAGE_PATTERNS)
}

const isConnectionRefused = (code: string | undefined, message: string): boolean => {
  if (codeMatches(code, CONNECTION_REFUSED_CODES)) {
    return true
  }
  return messageContains(message, CONNECTION_REFUSED_PATTERNS)
}

const isTimeoutScenario = (code: string | undefined, message: string): boolean => {
  if (codeMatches(code, TIMEOUT_ERROR_CODES)) {
    return true
  }
  return messageContains(message, TIMEOUT_MESSAGE_PATTERNS)
}

const isNetworkUnreachable = (code: string | undefined, message: string): boolean => {
  if (codeMatches(code, NETWORK_UNREACHABLE_CODES)) {
    return true
  }
  return messageContains(message, NETWORK_UNREACHABLE_PATTERNS)
}

const isAuthenticationFailure = (level: string | undefined, message: string): boolean => {
  if (level === 'client-authentication') {
    return true
  }
  return messageContains(message, AUTHENTICATION_MESSAGE_PATTERNS)
}

const codeMatches = (code: string | undefined, expected: readonly string[]): boolean => {
  if (code === undefined) {
    return false
  }
  return expected.includes(code)
}

const messageContains = (message: string, patterns: readonly string[]): boolean => {
  return patterns.some(pattern => message.includes(pattern))
}

const DNS_ERROR_CODES = ['ENOTFOUND'] as const
const CONNECTION_REFUSED_CODES = ['ECONNREFUSED'] as const
const TIMEOUT_ERROR_CODES = ['ETIMEDOUT', 'ECONNRESET'] as const
const NETWORK_UNREACHABLE_CODES = ['ENETUNREACH'] as const

const DNS_MESSAGE_PATTERNS = ['getaddrinfo', 'enotfound'] as const
const CONNECTION_REFUSED_PATTERNS = ['connection refused', 'econnrefused'] as const
const TIMEOUT_MESSAGE_PATTERNS = ['timeout', 'etimedout', 'econnreset'] as const
const NETWORK_UNREACHABLE_PATTERNS = ['network is unreachable', 'enetunreach'] as const
const AUTHENTICATION_MESSAGE_PATTERNS = [
  'authentication failed',
  'all configured authentication methods failed',
  'permission denied',
  'password'
] as const
