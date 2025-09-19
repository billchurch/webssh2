// app/routes/session-handler.ts
// Pure functions for session management

/**
 * Session data structure
 */
export interface SessionData {
  sshCredentials?: {
    host?: string
    port?: number
    username?: string
    password?: string
    term?: string | null
  }
  authMethod?: string
  usedBasicAuth?: boolean
  [key: string]: unknown
}

/**
 * Creates SSH credentials for session storage
 * Pure function - returns new object
 */
export function createSessionCredentials(
  host: string,
  port: number,
  username: string,
  password: string,
  term: string | null
): NonNullable<SessionData['sshCredentials']> {
  const credentials: NonNullable<SessionData['sshCredentials']> = {
    host,
    port,
    username,
    password
  }
  
  if (term != null && term !== '') {
    credentials.term = term
  }
  
  return credentials
}

/**
 * Creates a clean session for POST authentication
 * Pure function - returns new object
 */
export function createPostAuthSession(
  credentials: NonNullable<SessionData['sshCredentials']>
): Partial<SessionData> {
  return {
    authMethod: 'POST',
    sshCredentials: credentials
  }
}

/**
 * Identifies auth-related session keys for cleanup
 * Pure function - no side effects
 */
export function getAuthRelatedKeys(sessionKeys: string[]): string[] {
  return sessionKeys.filter(key => 
    key.startsWith('ssh') || 
    key.includes('auth') || 
    key.includes('cred')
  )
}

/**
 * Creates a list of keys to clear for re-authentication
 * Pure function - no side effects
 */
export function getReauthClearKeys(): string[] {
  return [
    'sshCredentials',
    'usedBasicAuth',
    'authMethod'
  ]
}

/**
 * Checks if session has valid SSH credentials
 * Pure function - no side effects
 */
export function hasValidSessionCredentials(session: SessionData): boolean {
  const creds = session.sshCredentials
  return creds?.username != null && 
         creds.username !== '' &&
         creds.password != null && 
         creds.password !== ''
}

/**
 * Merges session updates
 * Pure function - returns new object
 */
export function mergeSessionData(
  existing: SessionData,
  updates: Partial<SessionData>
): SessionData {
  return {
    ...existing,
    ...updates
  }
}