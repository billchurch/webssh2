// app/socket/shell-handler.ts
// Shell management handler for WebSocket connections

import type { EventEmitter } from 'events'
import { createNamespacedDebug } from '../logger.js'
import { normalizeDim } from '../utils.js'
import type SSHConnection from '../ssh.js'
import { DEFAULTS } from '../constants.js'

const debug = createNamespacedDebug('socket:shell')

export interface ShellOptions {
  term?: string | null
  rows?: number
  cols?: number
  width?: number
  height?: number
}

export interface ResizeDimensions {
  rows: number
  cols: number
}

/**
 * Create a shell session
 * @param ssh - SSH connection instance
 * @param options - Shell options
 * @param envVars - Environment variables
 * @returns Shell stream
 */
export async function createShell(
  ssh: SSHConnection,
  options: ShellOptions,
  envVars?: Record<string, string> | null
): Promise<EventEmitter> {
  debug('Creating shell with options:', options)
  
  const shellOptions: {
    term?: string | null
    rows?: number
    cols?: number
    width?: number
    height?: number
  } = {
    term: options.term ?? DEFAULTS.SSH_TERM,
    rows: options.rows ?? DEFAULTS.TERM_ROWS,
    cols: options.cols ?? DEFAULTS.TERM_COLS,
  }
  
  if (options.width != null) {
    shellOptions.width = options.width
  }
  if (options.height != null) {
    shellOptions.height = options.height
  }
  
  const stream = await ssh.shell(shellOptions, envVars) as EventEmitter
  debug('Shell created successfully')
  
  return stream
}

/**
 * Handle terminal resize
 * @param ssh - SSH connection instance
 * @param dimensions - New terminal dimensions
 */
export function handleResize(
  ssh: SSHConnection,
  dimensions: ResizeDimensions
): void {
  const { rows, cols } = dimensions
  debug(`Resizing terminal to ${cols}x${rows}`)
  
  ssh.resizeTerminal(rows, cols)
}

/**
 * Normalize terminal dimensions
 * @param value - Input dimension value
 * @param sessionValue - Session stored value
 * @param defaultValue - Default value
 * @returns Normalized dimension
 * @pure
 */
export function normalizeDimension(
  value: number | string | undefined | null,
  sessionValue: number | null,
  defaultValue: number
): number {
  // Use provided value if valid
  if (typeof value === 'number' && Number.isFinite(value) && value !== 0) {
    return value
  }
  
  // Fall back to session value if valid
  if (typeof sessionValue === 'number' && Number.isFinite(sessionValue) && sessionValue !== 0) {
    return sessionValue
  }
  
  // Use default
  return defaultValue
}