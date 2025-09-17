// app/socket/handlers/terminal-handler.ts
// Pure functions for handling terminal configuration

import { DEFAULTS } from '../../constants.js'
import type { TerminalSettings } from '../../types/contracts/v1/socket.js'
import type { Config } from '../../types/config.js'

export interface TerminalState {
  term: string
  cols: number
  rows: number
  width?: number
  height?: number
}

export interface TerminalConfig {
  term: string | null
  cols: number | null
  rows: number | null
}

export interface TerminalSetupResult {
  success: boolean
  terminal?: TerminalState
  error?: string
}

export interface ShellOptions {
  term: string
  cols: number
  rows: number
  width?: number
  height?: number
}

/**
 * Validates terminal dimensions
 * @param cols - Number of columns
 * @param rows - Number of rows
 * @returns True if dimensions are valid
 * @pure
 */
export function validateTerminalDimensions(
  cols: unknown,
  rows: unknown
): { valid: boolean; cols: number | undefined; rows: number | undefined; error?: string } {
  let validCols: number | undefined
  let validRows: number | undefined

  // Validate columns
  if (cols != null) {
    let colsNum = NaN
    if (typeof cols === 'number') {
      colsNum = cols
    } else if (typeof cols === 'string') {
      colsNum = parseInt(cols, 10)
    }

    if (!isNaN(colsNum) && colsNum > 0 && colsNum <= 1000) {
      validCols = colsNum
    } else {
      return { valid: false, error: `Invalid columns value`, cols: undefined, rows: undefined }
    }
  }

  // Validate rows
  if (rows != null) {
    let rowsNum = NaN
    if (typeof rows === 'number') {
      rowsNum = rows
    } else if (typeof rows === 'string') {
      rowsNum = parseInt(rows, 10)
    }

    if (!isNaN(rowsNum) && rowsNum > 0 && rowsNum <= 1000) {
      validRows = rowsNum
    } else {
      return { valid: false, error: `Invalid rows value`, cols: validCols, rows: undefined }
    }
  }

  return { valid: true, cols: validCols, rows: validRows }
}

/**
 * Validates terminal type string
 * @param term - Terminal type
 * @returns Validated terminal type or null
 * @pure
 */
export function validateTerminalType(term: unknown): string | null {
  if (term == null) {
    return null
  }

  if (typeof term !== 'string') {
    return null
  }

  const trimmed = term.trim()
  if (trimmed === '') {
    return null
  }

  // Basic validation for terminal type string
  // Allow alphanumeric, hyphen, and common terminal types
  const validTermPattern = /^[a-zA-Z0-9-]+$/
  if (!validTermPattern.test(trimmed)) {
    return null
  }

  return trimmed
}

/**
 * Processes terminal settings update
 * @param settings - Terminal settings from client
 * @param currentConfig - Current terminal configuration
 * @returns Updated terminal configuration
 * @pure
 */
export function processTerminalUpdate(
  settings: unknown,
  currentConfig: TerminalConfig
): { success: boolean; config?: TerminalConfig; error?: string } {
  if (settings == null || typeof settings !== 'object') {
    return { success: false, error: 'Invalid terminal settings' }
  }

  const termSettings = settings as Record<string, unknown>
  const newConfig = { ...currentConfig }

  // Process terminal type
  if ('term' in termSettings) {
    const validatedTerm = validateTerminalType(termSettings['term'])
    if (validatedTerm !== null) {
      newConfig.term = validatedTerm
    }
  }

  // Process dimensions
  const dimensionValidation = validateTerminalDimensions(
    termSettings['cols'],
    termSettings['rows']
  )

  if (!dimensionValidation.valid) {
    return { success: false, error: dimensionValidation.error ?? 'Invalid dimensions' }
  }

  if (dimensionValidation.cols !== undefined) {
    newConfig.cols = dimensionValidation.cols
  }

  if (dimensionValidation.rows !== undefined) {
    newConfig.rows = dimensionValidation.rows
  }

  return { success: true, config: newConfig }
}

/**
 * Creates terminal state with defaults
 * @param config - Terminal configuration
 * @param serverConfig - Server configuration
 * @returns Complete terminal state
 * @pure
 */
export function createTerminalState(
  config: TerminalConfig,
  serverConfig: Config
): TerminalState {
  // Note: serverConfig.ssh.term is always defined as a string in config
  const term = config.term ?? serverConfig.ssh.term
  return {
    term: term !== '' ? term : DEFAULTS.SSH_TERM,
    cols: config.cols ?? DEFAULTS.TERM_COLS,
    rows: config.rows ?? DEFAULTS.TERM_ROWS,
  }
}

/**
 * Handles terminal setup request
 * @param settings - Terminal settings from client
 * @param currentConfig - Current terminal configuration
 * @param serverConfig - Server configuration
 * @returns Terminal setup result
 * @pure
 */
export function handleTerminalSetup(
  settings: TerminalSettings,
  currentConfig: TerminalConfig,
  serverConfig: Config
): TerminalSetupResult {
  // Process terminal update
  const updateResult = processTerminalUpdate(settings, currentConfig)
  
  if (!updateResult.success || updateResult.config == null) {
    return {
      success: false,
      error: updateResult.error ?? 'Failed to process terminal settings',
    }
  }

  // Create terminal state with defaults
  const terminalState = createTerminalState(updateResult.config, serverConfig)

  return {
    success: true,
    terminal: terminalState,
  }
}

/**
 * Creates shell options for SSH connection
 * @param terminal - Terminal state
 * @param env - Environment variables
 * @returns Shell options for SSH
 * @pure
 */
export function createShellOptions(
  terminal: TerminalState,
  _env?: Record<string, string> | null
): ShellOptions {
  const options: ShellOptions = {
    term: terminal.term,
    cols: terminal.cols,
    rows: terminal.rows,
  }

  if (terminal.width != null) {
    options.width = terminal.width
  }

  if (terminal.height != null) {
    options.height = terminal.height
  }

  return options
}

/**
 * Handles terminal resize request
 * @param size - New terminal size
 * @returns Resize result with validated dimensions
 * @pure
 */
export function handleTerminalResize(
  size: unknown
): { success: boolean; cols?: number; rows?: number; error?: string } {
  if (size == null || typeof size !== 'object') {
    return { success: false, error: 'Invalid resize data' }
  }

  const sizeData = size as Record<string, unknown>
  
  const validation = validateTerminalDimensions(sizeData['cols'], sizeData['rows'])
  
  if (!validation.valid) {
    return { success: false, error: validation.error ?? 'Invalid dimensions' }
  }

  if (validation.cols == null || validation.rows == null) {
    return { success: false, error: 'Both cols and rows are required for resize' }
  }

  return {
    success: true,
    cols: validation.cols,
    rows: validation.rows,
  }
}

/**
 * Merges terminal configuration from multiple sources
 * @param clientSettings - Settings from client
 * @param sessionConfig - Session terminal configuration
 * @param serverConfig - Server configuration
 * @returns Merged terminal configuration
 * @pure
 */
export function mergeTerminalConfig(
  clientSettings: TerminalSettings | null,
  sessionConfig: TerminalConfig,
  serverConfig: Config
): TerminalConfig {
  const merged: TerminalConfig = {
    term: sessionConfig.term ?? serverConfig.ssh.term,
    cols: sessionConfig.cols,
    rows: sessionConfig.rows,
  }

  if (clientSettings != null) {
    if (clientSettings.term != null) {
      const validatedTerm = validateTerminalType(clientSettings.term)
      if (validatedTerm !== null) {
        merged.term = validatedTerm
      }
    }

    const validation = validateTerminalDimensions(
      clientSettings.cols,
      clientSettings.rows
    )

    if (validation.valid) {
      if (validation.cols != null) {
        merged.cols = validation.cols
      }
      if (validation.rows != null) {
        merged.rows = validation.rows
      }
    }
  }

  return merged
}