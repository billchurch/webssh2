// app/socket/handlers/exec-handler.ts
// Pure functions for handling command execution

import { DEFAULTS, VALIDATION_MESSAGES, VALIDATION_LIMITS } from '../../constants/index.js'
import type { ExecRequestPayload } from '../../types/contracts/v1/socket.js'

export interface ExecState {
  command: string
  pty: boolean
  term: string
  cols: number
  rows: number
  env: Record<string, string>
  timeoutMs: number | undefined
}

export interface ExecOptions {
  pty?: boolean
  term?: string
  cols?: number
  rows?: number
  width?: number
  height?: number
}

export interface ExecResult {
  success: boolean
  state?: ExecState
  options?: ExecOptions
  env?: Record<string, string>
  error?: string
}

/**
 * Parses a numeric value from unknown type
 * @param value - Value to parse
 * @returns Parsed number or Number.NaN
 * @pure
 */
function parseNumericValue(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    return Number.parseInt(value, 10)
  }
  return Number.NaN
}

/**
 * Validates a numeric field within bounds
 * @param value - Value to validate
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param errorMessage - Error message if validation fails
 * @returns Validation result
 * @pure
 */
function validateNumericField(
  value: unknown,
  min: number,
  max: number,
  errorMessage: string
): { valid: boolean; value?: number; error?: string } {
  const numValue = parseNumericValue(value)
  if (Number.isNaN(numValue) || numValue < min || numValue > max) {
    return { valid: false, error: errorMessage }
  }
  return { valid: true, value: numValue }
}

/**
 * Validates environment variables object
 * @param envObj - Environment variables object to validate
 * @returns Validation result with converted environment object
 * @pure
 */
function validateEnvironmentVariables(
  envObj: unknown
): { valid: boolean; env?: Record<string, string>; error?: string } {
  if (typeof envObj !== 'object' || envObj === null || Array.isArray(envObj)) {
    return { valid: false, error: 'Environment variables must be an object' }
  }

  const env: Record<string, string> = {}
  const entries = Object.entries(envObj as Record<string, unknown>)

  for (const [key, value] of entries) {
    if (typeof value !== 'string') {
      return { valid: false, error: 'Environment variables must be string key-value pairs' }
    }
    // Use Object.defineProperty to avoid object injection warning
    Object.defineProperty(env, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    })
  }

  return { valid: true, env }
}

/**
 * Validates the basic structure and required fields
 * @param payload - Raw payload from client
 * @returns Validation result with base data
 * @pure
 */
function validateBasePayload(
  payload: unknown
): { valid: boolean; data?: ExecRequestPayload; error?: string } {
  if (payload == null || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid exec payload format' }
  }

  const execPayload = payload as Record<string, unknown>

  if (typeof execPayload['command'] !== 'string' || execPayload['command'].trim() === '') {
    return { valid: false, error: VALIDATION_MESSAGES.COMMAND_REQUIRED }
  }

  return {
    valid: true,
    data: { command: execPayload['command'] }
  }
}

/**
 * Validates PTY field
 * @param value - Value to validate
 * @returns Valid PTY value or error message
 * @pure
 */
function validatePtyField(value: unknown): { valid: true; value: boolean } | { valid: false; error: string } {
  if (typeof value !== 'boolean') {
    return { valid: false, error: VALIDATION_MESSAGES.PTY_FLAG_BOOLEAN_ERROR }
  }
  return { valid: true, value }
}

/**
 * Validates terminal type field
 * @param value - Value to validate
 * @returns Valid term value or error message
 * @pure
 */
function validateTermField(value: unknown): { valid: true; value: string } | { valid: false; error: string } {
  if (typeof value !== 'string' || value.trim() === '') {
    return { valid: false, error: VALIDATION_MESSAGES.INVALID_TERMINAL_TYPE }
  }
  return { valid: true, value }
}

/**
 * Processes and validates PTY field
 * @param execPayload - Raw payload object
 * @param validated - Validated payload to update
 * @returns Error message if validation fails
 * @pure
 */
function processPtyField(execPayload: Record<string, unknown>, validated: ExecRequestPayload): string | undefined {
  const value = execPayload['pty']
  if (value == null) {
    return undefined
  }
  const result = validatePtyField(value)
  if (!result.valid) {
    return result.error
  }
  validated.pty = result.value
  return undefined
}

/**
 * Processes and validates term field
 * @param execPayload - Raw payload object
 * @param validated - Validated payload to update
 * @returns Error message if validation fails
 * @pure
 */
function processTermField(execPayload: Record<string, unknown>, validated: ExecRequestPayload): string | undefined {
  const value = execPayload['term']
  if (value == null) {
    return undefined
  }
  const result = validateTermField(value)
  if (!result.valid) {
    return result.error
  }
  validated.term = result.value
  return undefined
}

/**
 * Processes and validates a numeric field
 * @param execPayload - Raw payload object
 * @param fieldName - Field name to process
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param errorMsg - Error message if validation fails
 * @param validated - Validated payload to update
 * @returns Error message if validation fails
 * @pure
 */
function processNumericField(
  execPayload: Record<string, unknown>,
  fieldName: 'cols' | 'rows' | 'timeoutMs',
  min: number,
  max: number,
  errorMsg: string,
  validated: ExecRequestPayload
): string | undefined {
  // Access field value safely by explicit field name
  let value: unknown
  if (fieldName === 'cols') {
    value = execPayload['cols']
  } else if (fieldName === 'rows') {
    value = execPayload['rows']
  } else {
    // fieldName must be 'timeoutMs' due to the type constraint
    value = execPayload['timeoutMs']
  }

  if (value == null) {
    return undefined
  }

  const result = validateNumericField(value, min, max, errorMsg)
  if (!result.valid) {
    return result.error ?? errorMsg
  }

  if (result.value !== undefined) {
    // Assign to correct field based on fieldName
    if (fieldName === 'cols') {
      validated.cols = result.value
    } else if (fieldName === 'rows') {
      validated.rows = result.value
    } else {
      // fieldName must be 'timeoutMs' due to the type constraint
      validated.timeoutMs = result.value
    }
  }

  return undefined
}

/**
 * Processes and validates env field
 * @param execPayload - Raw payload object
 * @param validated - Validated payload to update
 * @returns Error message if validation fails
 * @pure
 */
function processEnvField(execPayload: Record<string, unknown>, validated: ExecRequestPayload): string | undefined {
  const value = execPayload['env']
  if (value == null) {
    return undefined
  }
  const result = validateEnvironmentVariables(value)
  if (!result.valid) {
    return result.error ?? 'Invalid environment variables'
  }
  if (result.env !== undefined) {
    validated.env = result.env
  }
  return undefined
}

/**
 * Validates and adds optional fields to the payload
 * @param execPayload - Raw exec payload object
 * @param validated - Partially validated payload to add fields to
 * @returns Error message if validation fails, undefined if successful
 * @pure
 */
function validateOptionalFields(
  execPayload: Record<string, unknown>,
  validated: ExecRequestPayload
): string | undefined {
  // Process each field and return early on any error
  let error: string | undefined

  error = processPtyField(execPayload, validated)
  if (error !== undefined) {
    return error
  }

  error = processTermField(execPayload, validated)
  if (error !== undefined) {
    return error
  }

  error = processNumericField(
    execPayload,
    'cols',
    VALIDATION_LIMITS.MIN_TERMINAL_COLS,
    VALIDATION_LIMITS.MAX_TERMINAL_COLS,
    VALIDATION_MESSAGES.INVALID_COLUMNS_VALUE,
    validated
  )
  if (error !== undefined) {
    return error
  }

  error = processNumericField(
    execPayload,
    'rows',
    VALIDATION_LIMITS.MIN_TERMINAL_ROWS,
    VALIDATION_LIMITS.MAX_TERMINAL_ROWS,
    VALIDATION_MESSAGES.INVALID_ROWS_VALUE,
    validated
  )
  if (error !== undefined) {
    return error
  }

  error = processNumericField(
    execPayload,
    'timeoutMs',
    VALIDATION_LIMITS.MIN_EXEC_TIMEOUT_MS,
    VALIDATION_LIMITS.MAX_EXEC_TIMEOUT_MS,
    VALIDATION_MESSAGES.INVALID_TIMEOUT_VALUE,
    validated
  )
  if (error !== undefined) {
    return error
  }

  error = processEnvField(execPayload, validated)
  if (error !== undefined) {
    return error
  }

  return undefined
}

/**
 * Validates exec request payload
 * @param payload - Raw payload from client
 * @returns Validation result
 * @pure
 */
export function validateExecPayload(
  payload: unknown
): { valid: boolean; data?: ExecRequestPayload; error?: string } {
  // Validate base structure and required fields
  const baseResult = validateBasePayload(payload)
  if (!baseResult.valid || baseResult.data === undefined) {
    return baseResult
  }

  // Validate optional fields
  const error = validateOptionalFields(
    payload as Record<string, unknown>,
    baseResult.data
  )

  if (error !== undefined) {
    return { valid: false, error }
  }

  return { valid: true, data: baseResult.data }
}

/**
 * Creates execution state from validated payload
 * @param payload - Validated exec payload
 * @param sessionTerm - Terminal type from session
 * @param sessionCols - Columns from session
 * @param sessionRows - Rows from session
 * @returns Execution state
 * @pure
 */
export function createExecState(
  payload: ExecRequestPayload,
  sessionTerm: string | null,
  sessionCols: number | null,
  sessionRows: number | null
): ExecState {
  return {
    command: payload.command,
    pty: payload.pty ?? false,
    term: payload.term ?? sessionTerm ?? DEFAULTS.SSH_TERM,
    cols: payload.cols ?? sessionCols ?? DEFAULTS.TERM_COLS,
    rows: payload.rows ?? sessionRows ?? DEFAULTS.TERM_ROWS,
    env: payload.env ?? {},
    timeoutMs: payload.timeoutMs,
  }
}

/**
 * Creates SSH execution options from exec state
 * @param state - Execution state
 * @returns SSH execution options
 * @pure
 */
export function createExecOptions(state: ExecState): ExecOptions {
  const options: ExecOptions = {}

  if (state.pty) {
    options.pty = true
    options.term = state.term
    options.cols = state.cols
    options.rows = state.rows
  }

  return options
}

/**
 * Merges environment variables from multiple sources
 * @param sources - Array of environment variable objects
 * @returns Merged environment variables
 * @pure
 */
export function mergeEnvironmentVariables(
  ...sources: Array<Record<string, string> | undefined | null>
): Record<string, string> {
  const merged: Record<string, string> = {}

  for (const source of sources) {
    if (source != null && typeof source === 'object') {
      Object.assign(merged, source)
    }
  }

  return merged
}

/**
 * Handles exec request processing
 * @param payload - Raw exec payload
 * @param sessionTerm - Terminal from session
 * @param sessionCols - Columns from session
 * @param sessionRows - Rows from session
 * @param sessionEnv - Environment from session
 * @returns Exec result
 * @pure
 */
export function handleExecRequest(
  payload: unknown,
  sessionTerm: string | null,
  sessionCols: number | null,
  sessionRows: number | null,
  sessionEnv?: Record<string, string>
): ExecResult {
  // Validate payload
  const validation = validateExecPayload(payload)
  if (!validation.valid || validation.data == null) {
    return {
      success: false,
      error: validation.error ?? 'Invalid exec request',
    }
  }

  // Create execution state
  const state = createExecState(
    validation.data,
    sessionTerm,
    sessionCols,
    sessionRows
  )

  // Create SSH options
  const options = createExecOptions(state)

  // Merge environment variables
  const mergedEnv = mergeEnvironmentVariables(sessionEnv, state.env)

  return {
    success: true,
    state,
    options,
    env: mergedEnv,
  }
}

/**
 * Creates exec data event payload
 * @param type - Output type (stdout/stderr)
 * @param data - Output data
 * @returns Event payload
 * @pure
 */
export function createExecDataPayload(
  type: 'stdout' | 'stderr',
  data: string
): { type: 'stdout' | 'stderr'; data: string } {
  return { type, data }
}

/**
 * Creates exec exit event payload
 * @param code - Exit code
 * @param signal - Signal that caused exit
 * @returns Event payload
 * @pure
 */
export function createExecExitPayload(
  code: number | null,
  signal: string | null
): { code: number | null; signal: string | null } {
  return { code, signal }
}

/**
 * Validates command string for safety
 * @param command - Command to validate
 * @returns True if command appears safe
 * @pure
 */
export function isCommandSafe(command: string): boolean {
  // Basic safety checks - can be expanded based on requirements
  const dangerousPatterns = [
    /;\s*rm\s+-rf\s+\//i,     // rm -rf /
    /dd\s+.*of=\/dev\//i,     // NOSONAR dd overwriting devices
    />\s*\/dev\/s[a-z]+/i,    // Redirecting to block devices
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return false
    }
  }

  return true
}

/**
 * Sanitizes environment variable name
 * @param name - Variable name
 * @returns Sanitized name or null if invalid
 * @pure
 */
export function sanitizeEnvVarName(name: string): string | null {
  // Allow alphanumeric and underscore characters
  const sanitized = name.replace(/\W/g, '')
  
  if (sanitized === '' || sanitized.length > VALIDATION_LIMITS.MAX_ENV_VAR_NAME_LENGTH) {
    return null
  }

  // Don't allow names starting with numbers
  if (/^\d/.test(sanitized)) {
    return null
  }

  return sanitized
}

/**
 * Filters environment variables for safety
 * @param env - Environment variables
 * @returns Filtered environment variables
 * @pure
 */
export function filterEnvironmentVariables(
  env: Record<string, string>
): Record<string, string> {
  const filtered: Record<string, string> = {}
  
  // List of sensitive variables to exclude
  const sensitiveVars = new Set([
    'SSH_AUTH_SOCK',
    'SSH_AGENT_PID',
    'GPG_AGENT_INFO',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN',
  ])

  const envEntries = Object.entries(env)
  for (const [key, value] of envEntries) {
    const sanitizedKey = sanitizeEnvVarName(key)
    
    if (sanitizedKey != null && !sensitiveVars.has(sanitizedKey)) {
      // Limit value length and use Object.defineProperty to avoid object injection warning
      Object.defineProperty(filtered, sanitizedKey, {
        value: value.substring(0, VALIDATION_LIMITS.MAX_ENV_VALUE_LENGTH),
        writable: true,
        enumerable: true,
        configurable: true
      })
    }
  }

  return filtered
}