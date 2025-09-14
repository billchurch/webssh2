// app/socket/exec-handler.ts
// Command execution handler for WebSocket connections

import type { EventEmitter } from 'events'
import { createNamespacedDebug } from '../logger.js'
import { extractErrorMessage } from '../utils/error-handling.js'
import type SSHConnection from '../ssh.js'
import { validateExecPayload } from '../validators/exec-validate.js'
import { normalizeDimension } from './shell-handler.js'
import { DEFAULTS } from '../constants.js'

const debug = createNamespacedDebug('socket:exec')

export interface ExecOptions {
  pty?: boolean
  term?: string
  rows?: number
  cols?: number
  width?: number
  height?: number
}

export interface ExecResult {
  success: boolean
  stream?: EventEmitter
  error?: string
}

/**
 * Execute a command over SSH
 * @param ssh - SSH connection instance
 * @param command - Command to execute
 * @param options - Execution options
 * @param envVars - Environment variables
 * @returns Execution result with stream
 */
export async function executeCommand(
  ssh: SSHConnection,
  command: string,
  options: ExecOptions = {},
  envVars?: Record<string, string>
): Promise<ExecResult> {
  debug(`Executing command: ${command}`)
  
  try {
    const stream = await ssh.exec(command, options, envVars) as EventEmitter
    debug('Command execution started successfully')
    
    return {
      success: true,
      stream,
    }
  } catch (error) {
    const errorMessage = extractErrorMessage(error)
    debug('Command execution failed:', errorMessage)
    
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Validate and parse execution payload
 * @param payload - Raw execution payload
 * @returns Validated payload or error
 */
export function parseExecPayload(payload: unknown): {
  valid: boolean
  data?: ReturnType<typeof validateExecPayload>
  error?: string
} {
  try {
    const validated = validateExecPayload(payload)
    return {
      valid: true,
      data: validated,
    }
  } catch (error) {
    const errorMessage = extractErrorMessage(error, 'Invalid payload')
    return {
      valid: false,
      error: errorMessage,
    }
  }
}

/**
 * Creates execution options from parsed payload and session state
 * @param parsed - Validated execution payload
 * @param sessionTerm - Terminal type from session
 * @param sessionCols - Column count from session
 * @param sessionRows - Row count from session
 * @returns Execution options
 * @pure
 */
export function createExecOptions(
  parsed: ReturnType<typeof validateExecPayload>,
  sessionTerm: string | null,
  sessionCols: number | null,
  sessionRows: number | null
): ExecOptions {
  const options: ExecOptions = {}
  
  if (parsed.pty === true) {
    options.pty = true
  }
  
  options.term = parsed.term ?? sessionTerm ?? DEFAULTS.SSH_TERM
  options.cols = normalizeDimension(parsed.cols, sessionCols, DEFAULTS.TERM_COLS)
  options.rows = normalizeDimension(parsed.rows, sessionRows, DEFAULTS.TERM_ROWS)
  
  return options
}

/**
 * Merges environment variables from session and request
 * @param sessionEnv - Environment variables from session
 * @param requestEnv - Environment variables from request
 * @returns Merged environment variables
 * @pure
 */
export function mergeEnvironmentVariables(
  sessionEnv: Record<string, string> | undefined,
  requestEnv: Record<string, string> | undefined
): Record<string, string> {
  return { ...sessionEnv ?? {}, ...requestEnv ?? {} }
}