// app/validation/socket-messages.ts
// Pure validation functions for Socket.IO messages

import type { Result } from '../types/result.js'
import validator from 'validator'

export interface AuthCredentials {
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  host: string
  port: number
  term?: string
  cols?: number
  rows?: number
}

export interface TerminalConfig {
  term?: string
  rows: number
  cols: number
}

export interface ResizeParams {
  rows: number
  cols: number
}

export interface ExecCommand {
  command: string
  env?: Record<string, string>
  pty?: boolean
  term?: string
  cols?: number
  rows?: number
  timeoutMs?: number
}

// Helper function to safely convert value to string for validation
const toValidationString = (value: unknown): string => {
  if (typeof value === 'string') {return value}
  if (typeof value === 'number') {return String(value)}
  return ''
}

// Helper function to validate and parse integer within range
const parseIntInRange = (
  value: unknown,
  min: number,
  max: number,
  fieldName: string
): Result<number> => {
  const str = toValidationString(value)
  if (!validator.isInt(str, { min, max })) {
    return {
      ok: false,
      error: new Error(`${fieldName} must be an integer between ${min} and ${max}`)
    }
  }
  return {
    ok: true,
    value: parseInt(str, 10)
  }
}

// Helper function to validate port
const validatePort = (value: unknown): Result<number> => {
  const str = toValidationString(value)
  if (!validator.isPort(str)) {
    return {
      ok: false,
      error: new Error(`Invalid port: ${str}`)
    }
  }
  return {
    ok: true,
    value: parseInt(str, 10)
  }
}

// Helper function to validate string field
const validateStringField = (
  obj: Record<string, unknown>,
  field: string,
  required: boolean = false,
  errorMessage?: string
): Result<string | undefined> => {
  // eslint-disable-next-line security/detect-object-injection
  const value = obj[field]
  
  if (value == null) {
    if (required) {
      return {
        ok: false,
        error: new Error(errorMessage ?? `${field} is required`)
      }
    }
    return { ok: true, value: undefined }
  }
  
  if (typeof value !== 'string') {
    return {
      ok: false,
      error: new Error(field === 'term' ? 'Terminal type must be a string' : `${field} must be a string`)
    }
  }
  
  if (required && value.trim() === '') {
    return {
      ok: false,
      error: new Error(errorMessage ?? `${field} must be a non-empty string`)
    }
  }
  
  return { ok: true, value }
}

// Helper function to validate dimension (rows/cols)
const validateDimension = (
  obj: Record<string, unknown>,
  field: string
): Result<number | undefined> => {
  // eslint-disable-next-line security/detect-object-injection
  const value = obj[field]
  if (value == null) {return { ok: true, value: undefined }}
  
  const result = parseIntInRange(value, 1, 9999, field === 'rows' ? 'Rows' : 'Columns')
  if (!result.ok) {return result}
  return { ok: true, value: result.value }
}

// Helper function to validate environment variables
const validateEnvironmentVars = (value: unknown): Record<string, string> | undefined => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return undefined
  }
  
  const env: Record<string, string> = {}
  const entries = Object.entries(value as Record<string, unknown>)
    .slice(0, 50) // Limit to 50 env vars
    .filter(([key, val]) => {
      return typeof key === 'string' && 
             key.length > 0 && 
             key.length < 256 &&
             /^[A-Za-z_]\w*$/.test(key) && 
             val != null
    })
  
  for (const [key, val] of entries) {
    // Use Object.defineProperty to avoid object-injection warning
    Object.defineProperty(env, key, {
      value: String(val),
      writable: true,
      enumerable: true,
      configurable: true
    })
  }
  
  return Object.keys(env).length > 0 ? env : undefined
}

// Helper function to validate optional term field
const validateOptionalTerm = (value: unknown): string | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  return undefined
}

// Helper function to validate optional timeout
const validateOptionalTimeout = (value: unknown): number | undefined => {
  const result = parseIntInRange(value, 0, 3600000, 'Timeout')
  return result.ok ? result.value : undefined
}

// Helper function to add optional exec dimensions to validated object
const addOptionalExecDimensions = (
  exec: Record<string, unknown>,
  validated: ExecCommand
): Result<void> => {
  const colsResult = validateDimension(exec, 'cols')
  if (!colsResult.ok) {
    return { ok: false, error: colsResult.error }
  }
  if (colsResult.value != null) {
    validated.cols = colsResult.value
  }

  const rowsResult = validateDimension(exec, 'rows')
  if (!rowsResult.ok) {
    return { ok: false, error: rowsResult.error }
  }
  if (rowsResult.value != null) {
    validated.rows = rowsResult.value
  }

  return { ok: true, value: undefined }
}

/**
 * Validates authentication message
 * @param data - Raw authentication data
 * @returns Validated credentials or error
 * @pure
 */
export const validateAuthMessage = (data: unknown): Result<AuthCredentials> => {
  // Check if data is an object
  if (data == null || typeof data !== 'object') {
    return {
      ok: false,
      error: new Error('Authentication data must be an object')
    }
  }

  const creds = data as Record<string, unknown>

  // Validate required username
  const usernameResult = validateStringField(
    creds, 
    'username', 
    true, 
    'Username is required and must be a non-empty string'
  )
  if (!usernameResult.ok) {return usernameResult as Result<AuthCredentials>}

  // Validate required host
  const hostResult = validateStringField(
    creds, 
    'host', 
    true, 
    'Host is required and must be a non-empty string'
  )
  if (!hostResult.ok) {return hostResult as Result<AuthCredentials>}

  // Validate port
  let port = 22 // default SSH port
  if (creds['port'] != null) {
    const portResult = validatePort(creds['port'])
    if (!portResult.ok) {return portResult as Result<AuthCredentials>}
    port = portResult.value
  }

  // Build validated credentials
  // Safe to use non-null assertion as we validated these fields are required
  const username = usernameResult.value as string
  const host = hostResult.value as string
  
  const validated: AuthCredentials = {
    username: username.trim(),
    host: host.trim(),
    port
  }

  // Validate optional string fields
  const passwordResult = validateStringField(creds, 'password')
  if (!passwordResult.ok) {return passwordResult as Result<AuthCredentials>}
  if (passwordResult.value != null) {validated.password = passwordResult.value}
  
  const privateKeyResult = validateStringField(creds, 'privateKey')
  if (!privateKeyResult.ok) {return privateKeyResult as Result<AuthCredentials>}
  if (privateKeyResult.value != null) {validated.privateKey = privateKeyResult.value}
  
  const passphraseResult = validateStringField(creds, 'passphrase')
  if (!passphraseResult.ok) {return passphraseResult as Result<AuthCredentials>}
  if (passphraseResult.value != null) {validated.passphrase = passphraseResult.value}
  
  const termResult = validateStringField(creds, 'term')
  if (!termResult.ok) {return termResult as Result<AuthCredentials>}
  if (termResult.value != null) {validated.term = termResult.value}

  // Validate optional dimensions
  const colsResult = validateDimension(creds, 'cols')
  if (!colsResult.ok) {return colsResult as Result<AuthCredentials>}
  if (colsResult.value != null) {validated.cols = colsResult.value}

  const rowsResult = validateDimension(creds, 'rows')
  if (!rowsResult.ok) {return rowsResult as Result<AuthCredentials>}
  if (rowsResult.value != null) {validated.rows = rowsResult.value}

  return {
    ok: true,
    value: validated
  }
}

/**
 * Validates terminal configuration message
 * @param data - Raw terminal data
 * @returns Validated terminal config or error
 * @pure
 */
export const validateTerminalMessage = (data: unknown): Result<TerminalConfig> => {
  // Check if data is an object
  if (data == null || typeof data !== 'object') {
    return {
      ok: false,
      error: new Error('Terminal data must be an object')
    }
  }

  const config = data as Record<string, unknown>
  const validated: TerminalConfig = {
    rows: 24, // default
    cols: 80  // default
  }

  // Validate rows
  const rowsResult = validateDimension(config, 'rows')
  if (!rowsResult.ok) {return rowsResult as Result<TerminalConfig>}
  if (rowsResult.value != null) {validated.rows = rowsResult.value}

  // Validate cols
  const colsResult = validateDimension(config, 'cols')
  if (!colsResult.ok) {return colsResult as Result<TerminalConfig>}
  if (colsResult.value != null) {validated.cols = colsResult.value}

  // Validate optional term
  const termResult = validateStringField(config, 'term')
  if (!termResult.ok) {return termResult as Result<TerminalConfig>}
  if (termResult.value != null) {validated.term = termResult.value}

  return {
    ok: true,
    value: validated
  }
}

/**
 * Validates resize message
 * @param data - Raw resize data
 * @returns Validated resize params or error
 * @pure
 */
export const validateResizeMessage = (data: unknown): Result<ResizeParams> => {
  // Check if data is an object
  if (data == null || typeof data !== 'object') {
    return {
      ok: false,
      error: new Error('Resize data must be an object')
    }
  }

  const size = data as Record<string, unknown>

  // Both rows and cols are required for resize
  if (size['rows'] == null || size['cols'] == null) {
    return {
      ok: false,
      error: new Error('Both rows and cols are required for resize')
    }
  }

  // Validate rows
  const rowsResult = parseIntInRange(size['rows'], 1, 9999, 'Rows')
  if (!rowsResult.ok) {return rowsResult as Result<ResizeParams>}

  // Validate cols
  const colsResult = parseIntInRange(size['cols'], 1, 9999, 'Columns')
  if (!colsResult.ok) {return colsResult as Result<ResizeParams>}

  return {
    ok: true,
    value: {
      rows: rowsResult.value,
      cols: colsResult.value
    }
  }
}

/**
 * Validates exec command message
 * @param data - Raw exec command data
 * @returns Validated exec command or error
 * @pure
 */
export const validateExecMessage = (data: unknown): Result<ExecCommand> => {
  // Check if data is an object
  if (data == null || typeof data !== 'object') {
    return {
      ok: false,
      error: new Error('Exec data must be an object')
    }
  }

  const exec = data as Record<string, unknown>

  // Validate required command field
  const commandResult = validateStringField(
    exec, 
    'command', 
    true,
    'Command is required and must be a non-empty string'
  )
  if (!commandResult.ok) {return commandResult as Result<ExecCommand>}

  // Safe to use type assertion as we validated this field is required
  const command = commandResult.value as string
  
  const validated: ExecCommand = {
    command: command.trim()
  }

  // Handle all optional fields without nested conditionals
  if (exec['pty'] != null) {
    validated.pty = Boolean(exec['pty'])
  }

  const term = validateOptionalTerm(exec['term'])
  if (term != null) {
    validated.term = term
  }

  const dimensionsResult = addOptionalExecDimensions(exec, validated)
  if (!dimensionsResult.ok) {
    return dimensionsResult as Result<ExecCommand>
  }

  const env = validateEnvironmentVars(exec['env'])
  if (env != null) {
    validated.env = env
  }

  const timeout = validateOptionalTimeout(exec['timeoutMs'])
  if (timeout != null) {
    validated.timeoutMs = timeout
  }

  return {
    ok: true,
    value: validated
  }
}

/**
 * Validates control message
 * @param data - Raw control message data
 * @returns Validated control message or error
 * @pure
 */
export const validateControlMessage = (data: unknown): Result<{ action: string }> => {
  // Check if data is an object
  if (data == null || typeof data !== 'object') {
    return {
      ok: false,
      error: new Error('Control data must be an object')
    }
  }

  const control = data as Record<string, unknown>

  // Validate required action field
  const actionResult = validateStringField(
    control,
    'action',
    true,
    'Action is required and must be a non-empty string'
  )
  if (!actionResult.ok) {return actionResult as Result<{ action: string }>}

  // Validate known actions
  const validActions = ['reauth', 'clear-credentials', 'disconnect']
  // Safe to use type assertion as we validated this field is required
  const actionValue = actionResult.value as string
  const action = actionValue.trim().toLowerCase()
  
  if (!validActions.includes(action)) {
    return {
      ok: false,
      error: new Error(`Unknown control action: ${action}`)
    }
  }

  return {
    ok: true,
    value: { action }
  }
}