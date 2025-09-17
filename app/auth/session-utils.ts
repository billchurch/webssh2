// app/auth/session-utils.ts
// Pure functions for session management

import type { SessionCredentials } from '../validation/session.js'

export interface SshSession {
  sshCredentials?: SessionCredentials
  usedBasicAuth?: boolean
  authMethod?: string
  authFailed?: boolean
}

/**
 * Updates session with new SSH credentials
 * Returns a new session object without mutating the original
 * @param session - Current session object
 * @param credentials - New credentials to set
 * @returns New session object with updated credentials
 * @pure
 */
export function updateSessionCredentials(
  session: SshSession,
  credentials: SessionCredentials
): SshSession {
  return {
    ...session,
    sshCredentials: { ...credentials },
  }
}

/**
 * Clears authentication-related fields from session
 * Returns a new session object without mutating the original
 * @param session - Current session object
 * @returns New session object with auth fields removed
 * @pure
 */
export function clearSessionAuth(session: SshSession): SshSession {
  const authFields = new Set(['sshCredentials', 'usedBasicAuth', 'authMethod', 'authFailed'])
  
  // Convert to entries, filter out auth fields, and reconstruct
  const filteredEntries = Object.entries(session as Record<string, unknown>)
    .filter(([key]) => !authFields.has(key))
  
  return Object.fromEntries(filteredEntries) as SshSession
}

/**
 * Marks session as having failed authentication
 * Returns a new session object without mutating the original
 * @param session - Current session object
 * @returns New session object with authFailed flag
 * @pure
 */
export function markAuthFailed(session: SshSession): SshSession {
  return {
    ...session,
    authFailed: true,
  }
}

/**
 * Clears auth failed flag from session
 * Returns a new session object without mutating the original
 * @param session - Current session object
 * @returns New session object without authFailed flag
 * @pure
 */
export function clearAuthFailed(session: SshSession): SshSession {
  // Convert to entries, filter out authFailed, and reconstruct
  const filteredEntries = Object.entries(session as Record<string, unknown>)
    .filter(([key]) => key !== 'authFailed')
  
  return Object.fromEntries(filteredEntries) as SshSession
}