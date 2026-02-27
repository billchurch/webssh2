// app/socket/handlers/exec-handler.ts
// Pure functions for handling command execution

import { validateExecPayload, createExecState } from './exec-validator.js'
import { mergeEnvironmentVariables } from './exec-environment.js'

// Re-export validator and safety functions for backwards compatibility
export { validateExecPayload, createExecState } from './exec-validator.js'
export { isCommandSafe, sanitizeEnvVarName, filterEnvironmentVariables } from './exec-safety.js'
export { mergeEnvironmentVariables } from './exec-environment.js'

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
  if (validation.valid && validation.data != null) {
    // Validation passed, continue
  } else {
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
