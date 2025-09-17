// app/socket/handlers/exec-handler.ts
// Pure functions for handling command execution

import { DEFAULTS } from '../../constants.js'
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
 * Validates exec request payload
 * @param payload - Raw payload from client
 * @returns Validation result
 * @pure
 */
export function validateExecPayload(
  payload: unknown
): { valid: boolean; data?: ExecRequestPayload; error?: string } {
  if (payload == null || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid exec payload format' }
  }

  const execPayload = payload as Record<string, unknown>

  // Command is required
  if (typeof execPayload['command'] !== 'string' || execPayload['command'].trim() === '') {
    return { valid: false, error: 'Command is required' }
  }

  const validated: ExecRequestPayload = {
    command: execPayload['command'],
  }

  // Optional PTY flag
  if (execPayload['pty'] != null) {
    if (typeof execPayload['pty'] !== 'boolean') {
      return { valid: false, error: 'PTY flag must be boolean' }
    }
    validated.pty = execPayload['pty']
  }

  // Optional terminal type
  if (execPayload['term'] != null) {
    if (typeof execPayload['term'] !== 'string' || execPayload['term'].trim() === '') {
      return { valid: false, error: 'Invalid terminal type' }
    }
    validated.term = execPayload['term']
  }

  // Optional dimensions
  if (execPayload['cols'] != null) {
    let cols = NaN
    if (typeof execPayload['cols'] === 'number') {
      cols = execPayload['cols']
    } else if (typeof execPayload['cols'] === 'string') {
      cols = parseInt(execPayload['cols'], 10)
    }
    
    if (isNaN(cols) || cols < 1 || cols > 1000) {
      return { valid: false, error: 'Invalid columns value' }
    }
    validated.cols = cols
  }

  if (execPayload['rows'] != null) {
    let rows = NaN
    if (typeof execPayload['rows'] === 'number') {
      rows = execPayload['rows']
    } else if (typeof execPayload['rows'] === 'string') {
      rows = parseInt(execPayload['rows'], 10)
    }
    
    if (isNaN(rows) || rows < 1 || rows > 1000) {
      return { valid: false, error: 'Invalid rows value' }
    }
    validated.rows = rows
  }

  // Optional environment variables
  if (execPayload['env'] != null) {
    if (typeof execPayload['env'] !== 'object' || Array.isArray(execPayload['env'])) {
      return { valid: false, error: 'Environment variables must be an object' }
    }

    const env: Record<string, string> = {}
    const envObj = execPayload['env'] as Record<string, unknown>
    const envEntries = Object.entries(envObj)
    for (const [key, value] of envEntries) {
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
    validated.env = env
  }

  // Optional timeout
  if (execPayload['timeoutMs'] != null) {
    let timeout = NaN
    if (typeof execPayload['timeoutMs'] === 'number') {
      timeout = execPayload['timeoutMs']
    } else if (typeof execPayload['timeoutMs'] === 'string') {
      timeout = parseInt(execPayload['timeoutMs'], 10)
    }
    
    if (isNaN(timeout) || timeout < 0 || timeout > 3600000) { // Max 1 hour
      return { valid: false, error: 'Invalid timeout value' }
    }
    validated.timeoutMs = timeout
  }

  return { valid: true, data: validated }
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
    /;\s*rm\s+-rf\s+\//i,  // rm -rf /
    /dd\s+.*of=\/dev\//i,   // dd overwriting devices
    />\s*\/dev\/s[a-z]+/i,   // Redirecting to block devices
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
  // Allow alphanumeric, underscore, and common env var characters
  const sanitized = name.replace(/[^A-Za-z0-9_]/g, '')
  
  if (sanitized === '' || sanitized.length > 255) {
    return null
  }

  // Don't allow names starting with numbers
  if (/^[0-9]/.test(sanitized)) {
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
        value: value.substring(0, 10000),
        writable: true,
        enumerable: true,
        configurable: true
      })
    }
  }

  return filtered
}