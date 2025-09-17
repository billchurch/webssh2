// app/utils/branded.ts
// Constructor functions and validators for branded types

import type {
  SessionId,
  UserId,
  SshHost,
  SshPort,
  Username,
  Password,
  PrivateKey,
  TerminalType,
  EnvVarName,
  EnvVarValue,
  EventName,
  FilePath,
  UrlString,
  CssColor,
  SafeHtml,
  RegexPattern,
} from '../types/branded.js'

// Constructors with validation

/**
 * Create a SessionId from string
 */
export function createSessionId(id: string): SessionId {
  if (id === '') {
    throw new Error('SessionId cannot be empty')
  }
  return id as SessionId
}

/**
 * Create a UserId from string
 */
export function createUserId(id: string): UserId {
  if (id === '') {
    throw new Error('UserId cannot be empty')
  }
  return id as UserId
}

/**
 * Create an SshHost from string
 */
export function createSshHost(host: string): SshHost {
  if (host === '') {
    throw new Error('SSH host cannot be empty')
  }
  // Basic validation - could be more sophisticated
  if (host.includes(' ')) {
    throw new Error('SSH host cannot contain spaces')
  }
  return host as SshHost
}

/**
 * Try to create an SshHost, returning null on invalid input
 */
export function trySshHost(host: string | undefined): SshHost | null {
  if (host == null || host === '') {
    return null
  }
  try {
    return createSshHost(host)
  } catch {
    return null
  }
}

/**
 * Create an SshPort from number
 */
export function createSshPort(port: number): SshPort {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid SSH port: ${port}`)
  }
  return port as SshPort
}

/**
 * Try to create an SshPort, returning null on invalid input
 */
export function trySshPort(port: number | undefined): SshPort | null {
  if (port == null) {
    return null
  }
  try {
    return createSshPort(port)
  } catch {
    return null
  }
}

/**
 * Create a Username from string
 */
export function createUsername(username: string): Username {
  if (username === '') {
    throw new Error('Username cannot be empty')
  }
  return username as Username
}

/**
 * Try to create a Username, returning null on invalid input
 */
export function tryUsername(username: string | undefined): Username | null {
  if (username == null || username === '') {
    return null
  }
  return createUsername(username)
}

/**
 * Create a Password from string
 */
export function createPassword(password: string): Password {
  // Passwords can be empty in some auth scenarios
  return password as Password
}

/**
 * Create a PrivateKey from string
 */
export function createPrivateKey(key: string): PrivateKey {
  if (key === '') {
    throw new Error('Private key cannot be empty')
  }
  return key as PrivateKey
}

/**
 * Create a TerminalType from string
 */
export function createTerminalType(term: string): TerminalType {
  if (term === '') {
    throw new Error('Terminal type cannot be empty')
  }
  return term as TerminalType
}

/**
 * Try to create a TerminalType, returning null on invalid input
 */
export function tryTerminalType(term: string | undefined | null): TerminalType | null {
  if (term == null || term === '') {
    return null
  }
  return createTerminalType(term)
}

/**
 * Create an EnvVarName from string
 */
export function createEnvVarName(name: string): EnvVarName {
  if (name === '') {
    throw new Error('Environment variable name cannot be empty')
  }
  if (!/^[A-Za-z_]\w*$/.test(name)) {
    throw new Error(`Invalid environment variable name: ${name}`)
  }
  return name as EnvVarName
}

/**
 * Create an EnvVarValue from string
 */
export function createEnvVarValue(value: string): EnvVarValue {
  return value as EnvVarValue
}

/**
 * Create an EventName from string
 */
export function createEventName(name: string): EventName {
  if (name === '') {
    throw new Error('Event name cannot be empty')
  }
  return name as EventName
}

/**
 * Create a FilePath from string
 */
export function createFilePath(path: string): FilePath {
  if (path === '') {
    throw new Error('File path cannot be empty')
  }
  return path as FilePath
}

/**
 * Create a UrlString from string
 */
export function createUrlString(url: string): UrlString {
  if (url === '') {
    throw new Error('URL cannot be empty')
  }
  try {
    new URL(url)
  } catch {
    throw new Error(`Invalid URL: ${url}`)
  }
  return url as UrlString
}

/**
 * Create a CssColor from string
 */
export function createCssColor(color: string): CssColor {
  if (color === '') {
    throw new Error('CSS color cannot be empty')
  }
  // Basic validation - could validate against CSS color spec
  return color as CssColor
}

/**
 * Create SafeHtml from string (assumes it's been sanitized)
 */
export function createSafeHtml(html: string): SafeHtml {
  // This should only be called after sanitization
  return html as SafeHtml
}

/**
 * Create a RegexPattern from string
 */
export function createRegexPattern(pattern: string): RegexPattern {
  if (pattern === '') {
    throw new Error('Regex pattern cannot be empty')
  }
  // Try to compile it to validate
  // This is a validation function specifically for testing regex patterns
  // The dynamic RegExp creation is intentional and safe as it's only for validation
  try {
    // eslint-disable-next-line security/detect-non-literal-regexp
    new RegExp(pattern)
  } catch {
    throw new Error(`Invalid regex pattern: ${pattern}`)
  }
  return pattern as RegexPattern
}

// Type guards

/**
 * Check if value is a SessionId
 */
export function isSessionId(value: unknown): value is SessionId {
  return typeof value === 'string' && value !== ''
}

/**
 * Check if value is an SshHost
 */
export function isSshHost(value: unknown): value is SshHost {
  return typeof value === 'string' && value !== '' && !value.includes(' ')
}

/**
 * Check if value is an SshPort
 */
export function isSshPort(value: unknown): value is SshPort {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
}

/**
 * Check if value is a Username
 */
export function isUsername(value: unknown): value is Username {
  return typeof value === 'string' && value !== ''
}

/**
 * Check if value is a Password
 */
export function isPassword(value: unknown): value is Password {
  return typeof value === 'string'
}

/**
 * Check if value is a TerminalType
 */
export function isTerminalType(value: unknown): value is TerminalType {
  return typeof value === 'string' && value !== ''
}