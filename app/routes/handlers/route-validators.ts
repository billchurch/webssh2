// app/routes/handlers/route-validators.ts
// Pure validation functions for route parameters

import validator from 'validator'
import { getValidatedHost, getValidatedPort, validateSshTerm } from '../../utils.js'

export interface RouteParams {
  host?: string
  hostParam?: string
  port?: string | number
  sshterm?: string
  username?: string
  password?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  data?: {
    host: string
    port: number
    term: string | null
    username?: string
    password?: string
  }
}

/**
 * Validate route parameters for SSH connection
 * @param params - Route parameters
 * @returns Validation result with cleaned data
 * @pure
 */
export function validateRouteParams(params: RouteParams): ValidationResult {
  const errors: string[] = []
  
  // Validate host
  const hostInput = params.hostParam ?? params.host
  if (hostInput == null || hostInput === '') {
    errors.push('Host is required')
    return { valid: false, errors }
  }
  
  const host = getValidatedHost(hostInput)
  
  // Validate port
  const port = getValidatedPort(params.port as string | undefined)
  
  // Validate terminal
  const term = validateSshTerm(params.sshterm)
  
  // Validate credentials if provided
  let username: string | undefined
  let password: string | undefined
  
  if (params.username != null && params.username !== '') {
    username = validator.escape(params.username)
  }
  
  if (params.password != null && params.password !== '') {
    password = params.password // Don't escape passwords
  }
  
  const data: {
    host: string
    port: number
    term: string | null
    username?: string
    password?: string
  } = {
    host,
    port,
    term,
  }
  
  if (username != null && username !== '') {
    data.username = username
  }
  if (password != null && password !== '') {
    data.password = password
  }
  
  return {
    valid: errors.length === 0,
    errors,
    data,
  }
}

/**
 * Extract query parameters from request
 * @param query - Request query object
 * @returns Extracted parameters
 * @pure
 */
export function extractQueryParams(
  query: Record<string, unknown>
): {
  port?: string
  sshterm?: string
  readyTimeout?: string
  env?: string
} {
  const result: {
    port?: string
    sshterm?: string
    readyTimeout?: string
    env?: string
  } = {}
  
  if (query['port'] != null) {
    result.port = query['port'] as string
  }
  if (query['sshterm'] != null) {
    result.sshterm = query['sshterm'] as string
  }
  if (query['readyTimeout'] != null) {
    result.readyTimeout = query['readyTimeout'] as string
  }
  if (query['env'] != null) {
    result.env = query['env'] as string
  }
  
  return result
}

/**
 * Extract body parameters from POST request
 * @param body - Request body object
 * @returns Extracted parameters
 * @pure
 */
export function extractBodyParams(
  body: Record<string, unknown>
): {
  username?: string
  password?: string
  privateKey?: string
  passphrase?: string
  host?: string
  port?: string
  sshterm?: string
} {
  const result: {
    username?: string
    password?: string
    privateKey?: string
    passphrase?: string
    host?: string
    port?: string
    sshterm?: string
  } = {}
  
  if (body['username'] != null) {
    result.username = body['username'] as string
  }
  if (body['password'] != null) {
    result.password = body['password'] as string
  }
  if (body['privateKey'] != null) {
    result.privateKey = body['privateKey'] as string
  }
  if (body['passphrase'] != null) {
    result.passphrase = body['passphrase'] as string
  }
  if (body['host'] != null) {
    result.host = body['host'] as string
  }
  if (body['port'] != null) {
    result.port = body['port'] as string
  }
  if (body['sshterm'] != null) {
    result.sshterm = body['sshterm'] as string
  }
  
  return result
}