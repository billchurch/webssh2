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
  
  if (typeof envParam !== 'string' || envParam === '') {
    return null
  }
  
  try {
    const parsed = parseEnvVars(envParam)
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
 * Process session recording parameters
 * Pure function - no side effects
 */
export function extractRecordingParams(params: Record<string, unknown>): RecordingParams {
  const recording: RecordingParams = {}
  
  // Allow replay parameter
  const allowreplay = params['allowreplay']
  if (allowreplay === 'true' || allowreplay === true || allowreplay === '1') {
    recording.allowReplay = true
  } else if (allowreplay === 'false' || allowreplay === false || allowreplay === '0') {
    recording.allowReplay = false
  }
  
  // MRH session
  if (params['mrhsession'] != null) {
    recording.mrhSession = params['mrhsession']
  }
  
  // Replay date parameters
  const replayDateStart = params['replaydatestart']
  if (typeof replayDateStart === 'string' && replayDateStart !== '') {
    const date = new Date(replayDateStart)
    if (!isNaN(date.getTime())) {
      recording.replayDateStart = date
    }
  }
  
  const replayDateEnd = params['replaydateend']
  if (typeof replayDateEnd === 'string' && replayDateEnd !== '') {
    const date = new Date(replayDateEnd)
    if (!isNaN(date.getTime())) {
      recording.replayDateEnd = date
    }
  }
  
  // Exit code and signal
  const exitCode = params['replayexitcode']
  if (typeof exitCode === 'number' || typeof exitCode === 'string') {
    const code = typeof exitCode === 'number' ? exitCode : parseInt(exitCode, 10)
    if (!isNaN(code)) {
      recording.replayExitCode = code
    }
  }
  
  const exitSignal = params['replayexitsignal']
  if (typeof exitSignal === 'string' && exitSignal !== '') {
    recording.replayExitSignal = exitSignal
  }
  
  // Session metadata
  const sessionId = params['sessionid']
  if (typeof sessionId === 'string' && sessionId !== '') {
    recording.sessionId = sessionId
  }
  
  const sessionUsername = params['sessionusername']
  if (typeof sessionUsername === 'string' && sessionUsername !== '') {
    recording.sessionUsername = sessionUsername
  }
  
  const userHash = params['userhash']
  if (typeof userHash === 'string' && userHash !== '') {
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
    const parsed = parseInt(timeout, 10)
    if (!isNaN(parsed) && parsed > 0) {
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