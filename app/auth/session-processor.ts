// app/auth/session-processor.ts
// Pure functions for processing session data

import { parseEnvVars } from '../validation/index.js'
import { createNamespacedDebug } from '../logger.js'

const debug = createNamespacedDebug('auth:session')

/**
 * Session recording parameters
 */
export interface RecordingParams {
  allowReplay?: boolean
  replayDateStart?: Date
  replayDateEnd?: Date
  replayExitCode?: number
  replayExitSignal?: string
  sessionId?: string
  sessionUsername?: string
  userHash?: string
  mrhSession?: unknown
}

/**
 * Process environment variables from parameters
 * Pure function - no side effects
 */
export function extractEnvironmentVars(params: Record<string, unknown>): Record<string, string> | null {
  const envParam = params['env']

  // Handle both single string and array of strings (multiple query params)
  let envString: string | undefined

  if (typeof envParam === 'string' && envParam !== '') {
    envString = envParam
  } else if (Array.isArray(envParam)) {
    // Join multiple env parameters with comma separator
    // e.g., ['VAR1:value1', 'VAR2:value2'] -> 'VAR1:value1,VAR2:value2'
    const validStrings = envParam.filter(item => typeof item === 'string' && item !== '')
    if (validStrings.length > 0) {
      envString = validStrings.join(',')
    }
  }

  if (envString === undefined) {
    return null
  }

  try {
    const parsed = parseEnvVars(envString)
    if (parsed != null && Object.keys(parsed).length > 0) {
      debug('Parsed environment variables: %O', parsed)
      return parsed
    }
  } catch (err) {
    debug('Failed to parse environment variables: %s', err)
  }

  return null
}

/**
 * Parse boolean values from various input formats
 * Pure function - no side effects
 */
function parseBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 'true' || value === '1') {
    return true
  }
  if (value === false || value === 'false' || value === '0') {
    return false
  }
  return undefined
}

/**
 * Parse date from string input
 * Pure function - no side effects
 */
function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value === '') {
    return undefined
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/**
 * Parse number from various input formats
 * Pure function - no side effects
 */
function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  return undefined
}

/**
 * Parse string values, filtering empty strings
 * Pure function - no side effects
 */
function parseString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * Process session recording parameters
 * Pure function - no side effects
 */
export function extractRecordingParams(params: Record<string, unknown>): RecordingParams {
  const recording: RecordingParams = {}
  
  assignParsedValue(params['allowreplay'], parseBoolean, value => {
    recording.allowReplay = value
  })
  assignDirectValue(params['mrhsession'], value => {
    recording.mrhSession = value
  })
  assignParsedValue(params['replaydatestart'], parseDate, value => {
    recording.replayDateStart = value
  })
  assignParsedValue(params['replaydateend'], parseDate, value => {
    recording.replayDateEnd = value
  })
  assignParsedValue(params['replayexitcode'], parseNumber, value => {
    recording.replayExitCode = value
  })
  assignParsedValue(params['replayexitsignal'], parseString, value => {
    recording.replayExitSignal = value
  })
  assignParsedValue(params['sessionid'], parseString, value => {
    recording.sessionId = value
  })
  assignParsedValue(params['sessionusername'], parseString, value => {
    recording.sessionUsername = value
  })
  assignParsedValue(params['userhash'], parseString, value => {
    recording.userHash = value
  })
  
  return recording
}

function assignParsedValue<T>(
  input: unknown,
  parser: (value: unknown) => T | undefined,
  assign: (value: T) => void
): void {
  const parsed = parser(input)
  if (parsed !== undefined) {
    assign(parsed)
  }
}

function assignDirectValue<T>(value: T | null | undefined, assign: (definedValue: T) => void): void {
  if (value != null) {
    assign(value)
  }
}

/**
 * Extract ready timeout from parameters
 * Pure function - no side effects
 */
export function extractReadyTimeout(params: Record<string, unknown>): number | null {
  const timeout = params['readyTimeout']
  
  if (typeof timeout === 'number' && timeout > 0) {
    return Math.min(timeout, 300000) // Max 5 minutes
  }
  
  if (typeof timeout === 'string') {
    const parsed = Number.parseInt(timeout, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      return Math.min(parsed, 300000)
    }
  }
  
  return null
}

/**
 * Merge session parameters
 * Pure function - returns new object
 */
export function mergeSessionParams(
  existing: Record<string, unknown>,
  updates: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...existing,
    ...updates
  }
}
