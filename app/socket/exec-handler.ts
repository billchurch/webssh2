// app/socket/exec-handler.ts
// Command execution handler for WebSocket connections

import type { EventEmitter } from 'events'
import { createNamespacedDebug } from '../logger.js'
import type SSHConnection from '../ssh.js'
import { validateExecPayload } from '../validators/exec-validate.js'

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
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
    const errorMessage = error instanceof Error ? error.message : 'Invalid payload'
    return {
      valid: false,
      error: errorMessage,
    }
  }
}