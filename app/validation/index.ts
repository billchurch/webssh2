// server
// app/validation/index.ts

/**
 * Central barrel export for validation functions.
 *
 * Organized by category:
 * - SSH validation utilities
 * - Credential validation utilities
 * - Environment variable validation
 * - Socket message validation
 * - Config validation
 */

// ============================================================================
// SSH Validation Utilities
// ============================================================================

/**
 * Validate and normalize SSH connection parameters.
 * - validateHost: Validate SSH host
 * - validatePort: Validate SSH port
 * - validateTerm: Validate terminal type
 * - validatePrivateKey: Validate private key format
 * - isEncryptedKey: Check if private key is encrypted
 */
export {
  validateHost,
  validatePort,
  validateTerm,
  validatePrivateKey,
  isEncryptedKey
} from './ssh.js'

/**
 * Backward compatibility aliases for SSH validation.
 * @deprecated Use validateHost, validatePort, validateTerm directly
 */
export {
  validateHost as getValidatedHost,
  validatePort as getValidatedPort,
  validateTerm as validateSshTerm
} from './ssh.js'

// ============================================================================
// Credential Validation Utilities
// ============================================================================

/**
 * Validate SSH credentials structure and completeness.
 */
export { isValidCredentials, type Credentials } from './credentials.js'

// ============================================================================
// Environment Variable Validation
// ============================================================================

/**
 * Validate and parse environment variables.
 * - isValidEnvKey: Check if environment key is valid
 * - isValidEnvValue: Check if environment value is valid
 * - parseEnvVars: Parse environment variables from string
 */
export { isValidEnvKey, isValidEnvValue, parseEnvVars } from './environment.js'

// ============================================================================
// Socket Message Validation
// ============================================================================

/**
 * Validate Socket.IO message formats and contents.
 */
export {
  validateAuthMessage,
  validateTerminalMessage,
  validateResizeMessage,
  validateExecMessage,
  validateControlMessage,
  type AuthCredentials,
  type TerminalConfig,
  type ResizeParams,
  type ExecCommand
} from './socket-messages.js'

// ============================================================================
// Config Validation
// ============================================================================

/**
 * Configuration validation utilities (internal use).
 */
export {
  validateSshHost,
  validateSshPort,
  validateCssColor
} from './config.js'