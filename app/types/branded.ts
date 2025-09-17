// app/types/branded.ts
// Branded types for type-safe domain modeling

/**
 * Brand a type with a unique symbol to prevent mixing
 */
declare const brand: unique symbol
interface Brand<B> { readonly [brand]: B }

/**
 * Branded type helper
 */
export type Branded<T, B> = T & Brand<B>

// Domain-specific branded types

/**
 * Session ID type - prevents mixing with other string IDs
 */
export type SessionId = Branded<string, 'SessionId'>

/**
 * User ID type
 */
export type UserId = Branded<string, 'UserId'>

/**
 * SSH Host type - validated hostname or IP
 */
export type SshHost = Branded<string, 'SshHost'>

/**
 * SSH Port type - validated port number (1-65535)
 */
export type SshPort = Branded<number, 'SshPort'>

/**
 * Username type - non-empty string
 */
export type Username = Branded<string, 'Username'>

/**
 * Encoded password - ensures passwords are properly handled
 */
export type Password = Branded<string, 'Password'>

/**
 * Private key content
 */
export type PrivateKey = Branded<string, 'PrivateKey'>

/**
 * Terminal type string (e.g., 'xterm-256color')
 */
export type TerminalType = Branded<string, 'TerminalType'>

/**
 * Environment variable name
 */
export type EnvVarName = Branded<string, 'EnvVarName'>

/**
 * Environment variable value
 */
export type EnvVarValue = Branded<string, 'EnvVarValue'>

/**
 * WebSocket event name
 */
export type EventName = Branded<string, 'EventName'>

/**
 * File path
 */
export type FilePath = Branded<string, 'FilePath'>

/**
 * URL string
 */
export type UrlString = Branded<string, 'UrlString'>

/**
 * CSS color value
 */
export type CssColor = Branded<string, 'CssColor'>

/**
 * HTML content (safe)
 */
export type SafeHtml = Branded<string, 'SafeHtml'>

/**
 * Regex pattern string
 */
export type RegexPattern = Branded<string, 'RegexPattern'>