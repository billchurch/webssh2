// app/socket/handlers/exec-validator.ts
// Pure validation functions for exec request payloads

import { DEFAULTS, VALIDATION_MESSAGES, VALIDATION_LIMITS } from '../../constants/index.js'
import type { ExecRequestPayload } from '../../types/contracts/v1/socket.js'

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
  if (result.valid) {
    validated.pty = result.value
    return undefined
  } else {
    return result.error
  }
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
  if (result.valid) {
    validated.term = result.value
    return undefined
  } else {
    return result.error
  }
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
interface NumericFieldConfig {
  min: number
  max: number
  errorMessage: string
}

function processNumericField(
  execPayload: Record<string, unknown>,
  fieldName: 'cols' | 'rows' | 'timeoutMs',
  config: NumericFieldConfig,
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

  const result = validateNumericField(value, config.min, config.max, config.errorMessage)
  if (result.valid) {
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
  } else {
    return result.error ?? config.errorMessage
  }
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
  if (result.valid) {
    if (result.env !== undefined) {
      validated.env = result.env
    }
    return undefined
  } else {
    return result.error ?? 'Invalid environment variables'
  }
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
    {
      min: VALIDATION_LIMITS.MIN_TERMINAL_COLS,
      max: VALIDATION_LIMITS.MAX_TERMINAL_COLS,
      errorMessage: VALIDATION_MESSAGES.INVALID_COLUMNS_VALUE
    },
    validated
  )
  if (error !== undefined) {
    return error
  }

  error = processNumericField(
    execPayload,
    'rows',
    {
      min: VALIDATION_LIMITS.MIN_TERMINAL_ROWS,
      max: VALIDATION_LIMITS.MAX_TERMINAL_ROWS,
      errorMessage: VALIDATION_MESSAGES.INVALID_ROWS_VALUE
    },
    validated
  )
  if (error !== undefined) {
    return error
  }

  error = processNumericField(
    execPayload,
    'timeoutMs',
    {
      min: VALIDATION_LIMITS.MIN_EXEC_TIMEOUT_MS,
      max: VALIDATION_LIMITS.MAX_EXEC_TIMEOUT_MS,
      errorMessage: VALIDATION_MESSAGES.INVALID_TIMEOUT_VALUE
    },
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
  if (baseResult.valid && baseResult.data !== undefined) {
    // Base validation passed, continue with optional fields
  } else {
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
): {
  command: string
  pty: boolean
  term: string
  cols: number
  rows: number
  env: Record<string, string>
  timeoutMs: number | undefined
} {
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