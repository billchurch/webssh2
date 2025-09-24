// app/auth/session-processor.ts
// Pure functions for processing session data

import { parseEnvVars } from '../utils.js'
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
  
  // Process each parameter with its parser
  const allowReplay = parseBoolean(params['allowreplay'])
  if (allowReplay !== undefined) {
    recording.allowReplay = allowReplay
  }
  
  if (params['mrhsession'] != null) {
    recording.mrhSession = params['mrhsession']
  }
  
  const replayDateStart = parseDate(params['replaydatestart'])
  if (replayDateStart !== undefined) {
    recording.replayDateStart = replayDateStart
  }
  
  const replayDateEnd = parseDate(params['replaydateend'])
  if (replayDateEnd !== undefined) {
    recording.replayDateEnd = replayDateEnd
  }
  
  const replayExitCode = parseNumber(params['replayexitcode'])
  if (replayExitCode !== undefined) {
    recording.replayExitCode = replayExitCode
  }
  
  const replayExitSignal = parseString(params['replayexitsignal'])
  if (replayExitSignal !== undefined) {
    recording.replayExitSignal = replayExitSignal
  }
  
  const sessionId = parseString(params['sessionid'])
  if (sessionId !== undefined) {
    recording.sessionId = sessionId
  }
  
  const sessionUsername = parseString(params['sessionusername'])
  if (sessionUsername !== undefined) {
    recording.sessionUsername = sessionUsername
  }
  
  const userHash = parseString(params['userhash'])
  if (userHash !== undefined) {
    recording.userHash = userHash
  }
  
  return recording
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