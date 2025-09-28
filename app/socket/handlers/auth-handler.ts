// app/socket/handlers/auth-handler.ts
// Pure functions for handling authentication logic

import type { AuthCredentials } from '../../types/contracts/v1/socket.js'
import type { Config } from '../../types/config.js'
import { VALIDATION_MESSAGES } from '../../constants/index.js'
import { extractAuthCredentials } from '../../utils/index.js'

export interface SessionState {
  authenticated: boolean
  username: string | null
  password: string | null
  privateKey: string | null
  passphrase: string | null
  host: string | null
  port: number | null
  term: string | null
  cols: number | null
  rows: number | null
}

export interface AuthResult {
  success: boolean
  sessionState?: SessionState
  credentials?: AuthCredentials
  error?: string
}

export interface AuthResponse {
  action: 'auth_result'
  success: boolean
  message?: string
}



/**
 * Validates authentication credentials
 * @param credentials - Credentials to validate
 * @returns Validation result
 * @pure
 */
export function validateAuthCredentials(
  credentials: unknown
): { valid: boolean; data?: AuthCredentials; error?: string } {
  if (credentials == null || typeof credentials !== 'object') {
    return { valid: false, error: 'Invalid credentials format' }
  }

  const creds = credentials as Record<string, unknown>

  // Use the new extraction function which handles all validation
  const extractionResult = extractAuthCredentials(creds)
  if (!extractionResult.ok) {
    return { valid: false, error: extractionResult.error.message }
  }

  return { valid: true, data: extractionResult.value }
}

/**
 * Merges credentials with server defaults
 * @param credentials - User credentials
 * @param config - Server configuration
 * @returns Merged credentials
 * @pure
 */
export function mergeWithServerDefaults(
  credentials: AuthCredentials,
  config: Config
): AuthCredentials {
  const merged = { ...credentials }

  // Apply server default private key if not provided
  if (config.user.privateKey != null && 
      config.user.privateKey !== '' && 
      (merged.privateKey == null || merged.privateKey === '')) {
    merged.privateKey = config.user.privateKey
  }

  // Apply default terminal settings
  // Note: config.ssh.term is always defined (non-nullable string in type definition)
  if (merged.term == null && config.ssh.term !== '') {
    merged.term = config.ssh.term
  }

  return merged
}

/**
 * Creates session state from authenticated credentials
 * @param credentials - Authenticated credentials
 * @param currentState - Current session state
 * @returns Updated session state
 * @pure
 */
export function createAuthenticatedSessionState(
  credentials: AuthCredentials,
  currentState: SessionState
): SessionState {
  return {
    ...currentState,
    authenticated: true,
    username: credentials.username,
    password: credentials.password ?? null,
    privateKey: credentials.privateKey ?? null,
    passphrase: credentials.passphrase ?? null,
    host: credentials.host,
    port: credentials.port,
    term: credentials.term ?? currentState.term,
    cols: credentials.cols ?? currentState.cols,
    rows: credentials.rows ?? currentState.rows,
  }
}

/**
 * Processes authentication request
 * @param credentials - Raw credentials from client
 * @param sessionState - Current session state
 * @param config - Server configuration
 * @returns Authentication result
 * @pure
 */
export function handleAuthRequest(
  credentials: unknown,
  sessionState: SessionState,
  config: Config
): AuthResult {
  // Validate credentials
  const validation = validateAuthCredentials(credentials)
  if (!validation.valid || validation.data == null) {
    return {
      success: false,
      error: validation.error ?? VALIDATION_MESSAGES.INVALID_CREDENTIALS,
    }
  }

  // Merge with server defaults
  const mergedCredentials = mergeWithServerDefaults(validation.data, config)

  // Create new session state
  const newSessionState = createAuthenticatedSessionState(mergedCredentials, sessionState)

  return {
    success: true,
    sessionState: newSessionState,
    credentials: mergedCredentials,
  }
}

/**
 * Creates authentication response for client
 * @param result - Authentication result
 * @returns Authentication response payload
 * @pure
 */
export function createAuthResponse(result: AuthResult): AuthResponse {
  if (result.success) {
    return {
      action: 'auth_result',
      success: true,
    }
  }
  
  // Normalize error messages to match V1 behavior for test compatibility
  let errorMessage = result.error ?? VALIDATION_MESSAGES.AUTHENTICATION_FAILED
  if (errorMessage.includes('Username is required') ||
      errorMessage.includes('Host is required') ||
      errorMessage.includes('Invalid credentials format') ||
      errorMessage.includes('No authentication method provided') ||
      errorMessage.includes('Either password or private key is required')) {
    errorMessage = 'Invalid credentials'
  }

  return {
    action: 'auth_result',
    success: false,
    message: errorMessage,
  }
}

/**
 * Determines if interactive authentication is required
 * @param sessionState - Current session state
 * @param config - Server configuration
 * @returns True if interactive auth is required
 * @pure
 */
export function requiresInteractiveAuth(
  sessionState: SessionState,
  config: Config
): boolean {
  // Already authenticated
  if (sessionState.authenticated) {
    return false
  }

  // Interactive auth disabled
  if (config.ssh.disableInteractiveAuth) {
    return false
  }

  // No existing credentials
  if (sessionState.username == null || sessionState.host == null) {
    return true
  }

  // No authentication method available
  if (sessionState.password == null && sessionState.privateKey == null) {
    return true
  }

  return false
}

/**
 * Creates initial session state
 * @returns Empty session state
 * @pure
 */
export function createInitialSessionState(): SessionState {
  return {
    authenticated: false,
    username: null,
    password: null,
    privateKey: null,
    passphrase: null,
    host: null,
    port: null,
    term: null,
    cols: null,
    rows: null,
  }
}