// app/validation/socket-messages.ts
// Pure validation functions for Socket.IO messages

import type { Result } from '../types/result.js'
import validator from 'validator'
import { ENV_LIMITS, VALIDATION_LIMITS } from '../constants/index.js'
import {
  createSafeKey,
  type SafeKey,
  safeGet,
  isRecord
} from '../utils/safe-property-access.js'

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

interface FieldDescriptor<Name extends string> {
  key: SafeKey
  name: Name
}

interface DimensionFieldDescriptor<Name extends string> extends FieldDescriptor<Name> {
  label: string
}

type AuthOptionalStringField = 'password' | 'privateKey' | 'passphrase' | 'term'
type DimensionField = 'cols' | 'rows'

const USERNAME_FIELD: FieldDescriptor<'username'> = {
  key: createSafeKey('username'),
  name: 'username'
}

const HOST_FIELD: FieldDescriptor<'host'> = {
  key: createSafeKey('host'),
  name: 'host'
}

const PORT_FIELD: FieldDescriptor<'port'> = {
  key: createSafeKey('port'),
  name: 'port'
}

const PASSWORD_FIELD: FieldDescriptor<'password'> = {
  key: createSafeKey('password'),
  name: 'password'
}

const PRIVATE_KEY_FIELD: FieldDescriptor<'privateKey'> = {
  key: createSafeKey('privateKey'),
  name: 'privateKey'
}

const PASSPHRASE_FIELD: FieldDescriptor<'passphrase'> = {
  key: createSafeKey('passphrase'),
  name: 'passphrase'
}

const TERM_FIELD: FieldDescriptor<'term'> = {
  key: createSafeKey('term'),
  name: 'term'
}

const COLS_FIELD: DimensionFieldDescriptor<'cols'> = {
  key: createSafeKey('cols'),
  name: 'cols',
  label: 'Columns'
}

const ROWS_FIELD: DimensionFieldDescriptor<'rows'> = {
  key: createSafeKey('rows'),
  name: 'rows',
  label: 'Rows'
}

const COMMAND_FIELD: FieldDescriptor<'command'> = {
  key: createSafeKey('command'),
  name: 'command'
}

const PTY_FIELD: FieldDescriptor<'pty'> = {
  key: createSafeKey('pty'),
  name: 'pty'
}

const ENV_FIELD: FieldDescriptor<'env'> = {
  key: createSafeKey('env'),
  name: 'env'
}

const TIMEOUT_FIELD: FieldDescriptor<'timeoutMs'> = {
  key: createSafeKey('timeoutMs'),
  name: 'timeoutMs'
}

const ACTION_FIELD: FieldDescriptor<'action'> = {
  key: createSafeKey('action'),
  name: 'action'
}

const AUTH_OPTIONAL_FIELDS: ReadonlyArray<FieldDescriptor<AuthOptionalStringField>> = [
  PASSWORD_FIELD,
  PRIVATE_KEY_FIELD,
  PASSPHRASE_FIELD,
  TERM_FIELD
]

const AUTH_DIMENSION_FIELDS: ReadonlyArray<DimensionFieldDescriptor<DimensionField>> = [
  COLS_FIELD,
  ROWS_FIELD
]

const EXEC_DIMENSION_FIELDS: ReadonlyArray<DimensionFieldDescriptor<DimensionField>> = [
  COLS_FIELD,
  ROWS_FIELD
]

const ENV_KEY_PATTERN = /^[A-Za-z_]\w*$/
const VALID_CONTROL_ACTIONS = new Set<string>([
  'reauth',
  'clear-credentials',
  'disconnect'
])

const ensureRecord = (
  value: unknown,
  errorMessage: string
): Result<Record<string, unknown>> => {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: new Error(errorMessage)
    }
  }

  return { ok: true, value }
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

const validateStringField = (
  obj: Record<string, unknown>,
  field: FieldDescriptor<string>,
  options: {
    required?: boolean
    errorMessage?: string
    trim?: boolean
  } = {}
): Result<string | undefined> => {
  const value = safeGet(obj, field.key)
  const requiredMessage = options.errorMessage ?? `${field.name} is required`
  const emptyMessage = options.errorMessage ?? `${field.name} must be a non-empty string`
  const typeMessage = field.name === 'term'
    ? 'Terminal type must be a string'
    : `${field.name} must be a string`

  if (value == null) {
    if (options.required === true) {
      return {
        ok: false,
        error: new Error(requiredMessage)
      }
    }
    return { ok: true, value: undefined }
  }

  if (typeof value !== 'string') {
    return {
      ok: false,
      error: new Error(typeMessage)
    }
  }

  const resultValue = options.trim === true ? value.trim() : value
  if (options.required === true && resultValue === '') {
    return {
      ok: false,
      error: new Error(emptyMessage)
    }
  }

  return { ok: true, value: resultValue }
}

const validateDimension = (
  obj: Record<string, unknown>,
  field: DimensionFieldDescriptor<DimensionField>,
  bounds: { min: number; max: number }
): Result<number | undefined> => {
  const value = safeGet(obj, field.key)
  if (value == null) {
    return { ok: true, value: undefined }
  }

  return parseIntInRange(value, bounds.min, bounds.max, field.label)
}

const validateEnvironmentVars = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const entries = Object.entries(value)
    .slice(0, ENV_LIMITS.MAX_PAIRS)
    .filter(([key, val]) => {
      return (
        typeof key === 'string' &&
        key.length > 0 &&
        key.length < VALIDATION_LIMITS.MAX_ENV_KEY_LENGTH &&
        ENV_KEY_PATTERN.test(key) &&
        val != null
      )
    })
    .map(([key, val]) => [key, String(val)] as const)

  if (entries.length === 0) {
    return undefined
  }

  return Object.fromEntries(entries) as Record<string, string>
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

const collectOptionalStrings = <Name extends string>(
  obj: Record<string, unknown>,
  fields: ReadonlyArray<FieldDescriptor<Name>>
): Result<Partial<Record<Name, string>>> => {
  const collected: Partial<Record<Name, string>> = {}

  for (const field of fields) {
    const result = validateStringField(obj, field)
    if (!result.ok) {
      return { ok: false, error: result.error }
    }

    if (result.value !== undefined) {
      collected[field.name] = result.value
    }
  }

  return { ok: true, value: collected }
}

const collectOptionalDimensions = <Name extends DimensionField>(
  obj: Record<string, unknown>,
  fields: ReadonlyArray<DimensionFieldDescriptor<Name>>,
  bounds: { min: number; max: number }
): Result<Partial<Record<Name, number>>> => {
  const collected: Partial<Record<Name, number>> = {}

  for (const field of fields) {
    const result = validateDimension(obj, field, bounds)
    if (!result.ok) {
      return { ok: false, error: result.error }
    }

    if (result.value !== undefined) {
      collected[field.name] = result.value
    }
  }

  return { ok: true, value: collected }
}

/**
 * Validates authentication message
 * @param data - Raw authentication data
 * @returns Validated credentials or error
 * @pure
 */
export const validateAuthMessage = (data: unknown): Result<AuthCredentials> => {
  const recordResult = ensureRecord(data, 'Authentication data must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<AuthCredentials>
  }

  const creds = recordResult.value

  const usernameResult = validateStringField(creds, USERNAME_FIELD, {
    required: true,
    errorMessage: 'Username is required and must be a non-empty string',
    trim: true
  })
  if (!usernameResult.ok) {
    return usernameResult as Result<AuthCredentials>
  }

  const hostResult = validateStringField(creds, HOST_FIELD, {
    required: true,
    errorMessage: 'Host is required and must be a non-empty string',
    trim: true
  })
  if (!hostResult.ok) {
    return hostResult as Result<AuthCredentials>
  }

  const portSource = safeGet(creds, PORT_FIELD.key)
  const portResult = portSource == null
    ? ({ ok: true, value: 22 } as Result<number>)
    : validatePort(portSource)
  if (!portResult.ok) {
    return portResult as Result<AuthCredentials>
  }

  const optionalStringsResult = collectOptionalStrings(creds, AUTH_OPTIONAL_FIELDS)
  if (!optionalStringsResult.ok) {
    return optionalStringsResult as Result<AuthCredentials>
  }

  const optionalDimensionsResult = collectOptionalDimensions(
    creds,
    AUTH_DIMENSION_FIELDS,
    {
      min: VALIDATION_LIMITS.MIN_TERMINAL_ROWS,
      max: VALIDATION_LIMITS.MAX_TERMINAL_DIMENSION
    }
  )
  if (!optionalDimensionsResult.ok) {
    return optionalDimensionsResult as Result<AuthCredentials>
  }

  const username = usernameResult.value as string
  const host = hostResult.value as string

  const validated: AuthCredentials = {
    username,
    host,
    port: portResult.value
  }

  const optionalStrings = optionalStringsResult.value
  if (optionalStrings.password !== undefined) {validated.password = optionalStrings.password}
  if (optionalStrings.privateKey !== undefined) {validated.privateKey = optionalStrings.privateKey}
  if (optionalStrings.passphrase !== undefined) {validated.passphrase = optionalStrings.passphrase}
  if (optionalStrings.term !== undefined) {validated.term = optionalStrings.term}

  const optionalDimensions = optionalDimensionsResult.value
  if (optionalDimensions.cols !== undefined) {validated.cols = optionalDimensions.cols}
  if (optionalDimensions.rows !== undefined) {validated.rows = optionalDimensions.rows}

  return { ok: true, value: validated }
}

/**
 * Validates terminal configuration message
 * @param data - Raw terminal data
 * @returns Validated terminal config or error
 * @pure
 */
export const validateTerminalMessage = (data: unknown): Result<TerminalConfig> => {
  const recordResult = ensureRecord(data, 'Terminal data must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<TerminalConfig>
  }

  const config = recordResult.value
  const validated: TerminalConfig = {
    rows: 24,
    cols: 80
  }

  const bounds = {
    min: VALIDATION_LIMITS.MIN_TERMINAL_ROWS,
    max: VALIDATION_LIMITS.MAX_TERMINAL_DIMENSION
  }

  const rowsResult = validateDimension(config, ROWS_FIELD, bounds)
  if (!rowsResult.ok) {
    return rowsResult as Result<TerminalConfig>
  }
  if (rowsResult.value !== undefined) {
    validated.rows = rowsResult.value
  }

  const colsResult = validateDimension(config, COLS_FIELD, bounds)
  if (!colsResult.ok) {
    return colsResult as Result<TerminalConfig>
  }
  if (colsResult.value !== undefined) {
    validated.cols = colsResult.value
  }

  const termResult = validateStringField(config, TERM_FIELD)
  if (!termResult.ok) {
    return termResult as Result<TerminalConfig>
  }
  if (termResult.value != null) {
    validated.term = termResult.value
  }

  return { ok: true, value: validated }
}

/**
 * Validates resize message
 * @param data - Raw resize data
 * @returns Validated resize params or error
 * @pure
 */
export const validateResizeMessage = (data: unknown): Result<ResizeParams> => {
  const recordResult = ensureRecord(data, 'Resize data must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<ResizeParams>
  }

  const size = recordResult.value
  const rowsSource = safeGet(size, ROWS_FIELD.key)
  const colsSource = safeGet(size, COLS_FIELD.key)

  if (rowsSource == null || colsSource == null) {
    return {
      ok: false,
      error: new Error('Both rows and cols are required for resize')
    }
  }

  const rowsResult = parseIntInRange(rowsSource, 1, 9999, ROWS_FIELD.label)
  if (!rowsResult.ok) {
    return rowsResult as Result<ResizeParams>
  }

  const colsResult = parseIntInRange(colsSource, 1, 9999, COLS_FIELD.label)
  if (!colsResult.ok) {
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
  const recordResult = ensureRecord(data, 'Exec data must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<ExecCommand>
  }

  const exec = recordResult.value
  const commandResult = validateStringField(exec, COMMAND_FIELD, {
    required: true,
    errorMessage: 'Command is required and must be a non-empty string',
    trim: true
  })
  if (!commandResult.ok) {
    return commandResult as Result<ExecCommand>
  }

  const validated: ExecCommand = {
    command: commandResult.value as string
  }

  const ptySource = safeGet(exec, PTY_FIELD.key)
  if (ptySource != null) {
    validated.pty = Boolean(ptySource)
  }

  const termValue = validateOptionalTerm(safeGet(exec, TERM_FIELD.key))
  if (termValue != null) {
    validated.term = termValue
  }

  const dimensionResult = collectOptionalDimensions(
    exec,
    EXEC_DIMENSION_FIELDS,
    {
      min: VALIDATION_LIMITS.MIN_TERMINAL_ROWS,
      max: VALIDATION_LIMITS.MAX_TERMINAL_DIMENSION
    }
  )
  if (!dimensionResult.ok) {
    return dimensionResult as Result<ExecCommand>
  }

  const dimensions = dimensionResult.value
  if (dimensions.cols !== undefined) {validated.cols = dimensions.cols}
  if (dimensions.rows !== undefined) {validated.rows = dimensions.rows}

  const envValue = validateEnvironmentVars(safeGet(exec, ENV_FIELD.key))
  if (envValue != null) {
    validated.env = envValue
  }

  const timeoutValue = validateOptionalTimeout(safeGet(exec, TIMEOUT_FIELD.key))
  if (timeoutValue != null) {
    validated.timeoutMs = timeoutValue
  }

  return { ok: true, value: validated }
}

/**
 * Validates control message
 * @param data - Raw control message data
 * @returns Validated control message or error
 * @pure
 */
export const validateControlMessage = (data: unknown): Result<{ action: string }> => {
  const recordResult = ensureRecord(data, 'Control data must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<{ action: string }>
  }

  const control = recordResult.value
  const actionResult = validateStringField(control, ACTION_FIELD, {
    required: true,
    errorMessage: 'Action is required and must be a non-empty string',
    trim: true
  })
  if (!actionResult.ok) {
    return actionResult as Result<{ action: string }>
  }

  const action = (actionResult.value as string).toLowerCase()
  if (!VALID_CONTROL_ACTIONS.has(action)) {
    return {
      ok: false,
      error: new Error(`Unknown control action: ${action}`)
    }
  }

  return { ok: true, value: { action } }
}
