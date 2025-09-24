// app/validation/socket-messages.ts
// Pure validation functions for Socket.IO messages

import type { Result } from '../types/result.js'
import validator from 'validator'
import { ENV_LIMITS, VALIDATION_LIMITS } from '../constants/index.js'

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
    value: Number.parseInt(str, 10)
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
    value: Number.parseInt(str, 10)
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
  
  const result = parseIntInRange(value, VALIDATION_LIMITS.MIN_TERMINAL_ROWS, VALIDATION_LIMITS.MAX_TERMINAL_DIMENSION, field === 'rows' ? 'Rows' : 'Columns')
  if (result.ok) {
    return { ok: true, value: result.value }
  } else {
    return result
  }
}

// Helper function to validate environment variables
const validateEnvironmentVars = (value: unknown): Record<string, string> | undefined => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return undefined
  }
  
  const env: Record<string, string> = {}
  const entries = Object.entries(value as Record<string, unknown>)
    .slice(0, ENV_LIMITS.MAX_PAIRS)
    .filter(([key, val]) => {
      return typeof key === 'string' && 
             key.length > 0 && 
             key.length < VALIDATION_LIMITS.MAX_ENV_KEY_LENGTH &&
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
  if (colsResult.ok) {
    if (colsResult.value != null) {
      validated.cols = colsResult.value
    }
  } else {
    return { ok: false, error: colsResult.error }
  }

  const rowsResult = validateDimension(exec, 'rows')
  if (rowsResult.ok) {
    if (rowsResult.value != null) {
      validated.rows = rowsResult.value
    }
  } else {
    return { ok: false, error: rowsResult.error }
  }

  return { ok: true, value: undefined }
}

// Helper to validate multiple optional string fields
const validateOptionalFields = (
  creds: Record<string, unknown>,
  fields: string[]
): Result<Record<string, string | undefined>> => {
  const results: Record<string, string | undefined> = {}

  for (const field of fields) {
    const result = validateStringField(creds, field)
    if (result.ok) {
      // eslint-disable-next-line security/detect-object-injection
      results[field] = result.value
    } else {
      return result as Result<Record<string, string | undefined>>
    }
  }

  return { ok: true, value: results }
}

// Helper to validate optional dimensions
const validateOptionalDimensions = (
  creds: Record<string, unknown>,
  fields: string[]
): Result<Record<string, number | undefined>> => {
  const results: Record<string, number | undefined> = {}

  for (const field of fields) {
    const result = validateDimension(creds, field)
    if (result.ok) {
      // eslint-disable-next-line security/detect-object-injection
      results[field] = result.value
    } else {
      return result as Result<Record<string, number | undefined>>
    }
  }

  return { ok: true, value: results }
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

  // Validate required fields
  const usernameResult = validateStringField(creds, 'username', true, 'Username is required and must be a non-empty string')
  if (usernameResult.ok) {
    // Continue with other validations
  } else {
    return usernameResult as Result<AuthCredentials>
  }

  const hostResult = validateStringField(creds, 'host', true, 'Host is required and must be a non-empty string')
  if (hostResult.ok) {
    // Continue with other validations
  } else {
    return hostResult as Result<AuthCredentials>
  }

  // Validate port
  const port = creds['port'] != null
    ? validatePort(creds['port'])
    : { ok: true, value: 22 } as Result<number>
  if (port.ok) {
    // Continue with other validations
  } else {
    return port as Result<AuthCredentials>
  }

  // Validate all optional string fields at once
  const optionalStrings = validateOptionalFields(creds, ['password', 'privateKey', 'passphrase', 'term'])
  if (optionalStrings.ok) {
    // Continue with other validations
  } else {
    return optionalStrings as Result<AuthCredentials>
  }

  // Validate optional dimensions
  const optionalDimensions = validateOptionalDimensions(creds, ['cols', 'rows'])
  if (optionalDimensions.ok) {
    // Continue with building validated credentials
  } else {
    return optionalDimensions as Result<AuthCredentials>
  }

  // Build validated credentials
  const validated: AuthCredentials = {
    username: (usernameResult.value as string).trim(),
    host: (hostResult.value as string).trim(),
    port: port.value
  }

  // Add optional fields if present
  const { password, privateKey, passphrase, term } = optionalStrings.value
  // eslint-disable-next-line security/detect-possible-timing-attacks
  if (password !== undefined) {validated.password = password}
  if (privateKey !== undefined) {validated.privateKey = privateKey}
  if (passphrase !== undefined) {validated.passphrase = passphrase}
  if (term !== undefined) {validated.term = term}

  const { cols, rows } = optionalDimensions.value
  if (cols !== undefined) {validated.cols = cols}
  if (rows !== undefined) {validated.rows = rows}

  return { ok: true, value: validated }
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
  if (rowsResult.ok) {
    if (rowsResult.value != null) {validated.rows = rowsResult.value}
  } else {
    return rowsResult as Result<TerminalConfig>
  }

  // Validate cols
  const colsResult = validateDimension(config, 'cols')
  if (colsResult.ok) {
    if (colsResult.value != null) {validated.cols = colsResult.value}
  } else {
    return colsResult as Result<TerminalConfig>
  }

  // Validate optional term
  const termResult = validateStringField(config, 'term')
  if (termResult.ok) {
    if (termResult.value != null) {validated.term = termResult.value}
  } else {
    return termResult as Result<TerminalConfig>
  }

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
  if (rowsResult.ok) {
    // Continue with cols validation
  } else {
    return rowsResult as Result<ResizeParams>
  }

  // Validate cols
  const colsResult = parseIntInRange(size['cols'], 1, 9999, 'Columns')
  if (colsResult.ok) {
    // Continue with building result
  } else {
    return colsResult as Result<ResizeParams>
  }

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
  if (commandResult.ok) {
    // Continue with building validated command
  } else {
    return commandResult as Result<ExecCommand>
  }

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
  if (dimensionsResult.ok) {
    // Continue with other validations
  } else {
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
  if (actionResult.ok) {
    // Continue with building result
  } else {
    return actionResult as Result<{ action: string }>
  }

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