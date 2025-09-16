// app/routes/route-validators.ts
// Pure functions for route parameter validation

import { getValidatedPort, validateSshTerm } from '../utils.js'
import type { Config } from '../types/config.js'

/**
 * Route parameters from request
 */
export interface RouteParams {
  host?: string
  hostname?: string
  port?: string | number
  sshterm?: string
  username?: string
  password?: string
}

/**
 * Validated connection parameters
 */
export interface ValidatedConnectionParams {
  host: string
  port: number
  term: string | null
}

/**
 * Credential validation result
 */
export interface CredentialValidation {
  valid: boolean
  username?: string
  password?: string
  error?: string
}

/**
 * Extracts and validates host from route parameters
 * Pure function - no side effects
 */
export function extractHost(
  body: RouteParams,
  query: RouteParams,
  config: Config
): string | null {
  // Priority: body.host > query.host > query.hostname > config default
  const host = body.host ?? query.host ?? query.hostname ?? config.ssh.host
  
  if (host == null || host === '') {
    return null
  }
  
  return host
}

/**
 * Extracts and validates port from route parameters
 * Pure function - no side effects
 */
export function extractPort(
  body: RouteParams,
  query: RouteParams
): number {
  const portParam = body.port ?? query.port
  
  if (portParam == null) {
    return getValidatedPort(undefined)
  }
  
  const portNumber = typeof portParam === 'number' 
    ? portParam 
    : parseInt(portParam, 10)
  
  return getValidatedPort(portNumber)
}

/**
 * Extracts and validates terminal type from route parameters
 * Pure function - no side effects
 */
export function extractTerm(
  body: RouteParams,
  query: RouteParams
): string | null {
  const sshterm = body.sshterm ?? query.sshterm
  return validateSshTerm(sshterm)
}

/**
 * Validates POST body has required credentials
 * Pure function - no side effects
 */
export function validatePostCredentials(
  body: RouteParams
): CredentialValidation {
  const { username, password } = body
  
  if (username == null || username === '') {
    return {
      valid: false,
      error: 'username, password'
    }
  }
  
  if (password == null || password === '') {
    return {
      valid: false,
      error: 'username, password'
    }
  }
  
  return {
    valid: true,
    username,
    password
  }
}

/**
 * Validates session has required SSH credentials
 * Pure function - no side effects
 */
export function validateSessionCredentials(
  credentials: { username?: string; password?: string } | undefined
): boolean {
  return credentials?.username != null && 
         credentials.username !== '' &&
         credentials.password != null && 
         credentials.password !== ''
}

/**
 * Creates connection parameters from route data
 * Pure function - no side effects
 */
export function createConnectionParams(
  host: string,
  portParam?: string | number,
  sshterm?: string
): ValidatedConnectionParams {
  let portNumber: number | undefined
  
  if (portParam != null) {
    portNumber = typeof portParam === 'number' 
      ? portParam 
      : parseInt(portParam, 10)
  }
  
  return {
    host,
    port: getValidatedPort(portNumber),
    term: validateSshTerm(sshterm)
  }
}

/**
 * Creates sanitized credentials for logging
 * Pure function - no side effects
 */
export function createSanitizedCredentials(
  host: string,
  port: number,
  username: string
): Record<string, unknown> {
  return {
    host,
    port,
    username,
    password: '********'
  }
}