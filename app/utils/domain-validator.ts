// app/utils/domain-validator.ts
// Domain and business rules validation

import type { Config, ConfigValidationError } from '../types/config.js'
import type { Result } from '../types/result.js'
import { ok, err } from './result.js'
import {
  validateSshHost,
  validateSshPort,
  validateCssColor
} from '../validation/config.js'

/**
 * Helper to validate a field and collect errors
 */
function validateField(
  validator: () => void,
  path: string,
  value: unknown,
  errors: ConfigValidationError[]
): void {
  try {
    validator()
  } catch (e) {
    errors.push({
      path,
      message: (e as Error).message,
      value
    })
  }
}

/**
 * Check if authentication is properly configured
 */
function checkAuthConfiguration(config: Config, errors: ConfigValidationError[]): void {
  const hasHost = config.ssh.host != null && config.ssh.host !== ''
  const hasUsername = config.user.name != null && config.user.name !== ''
  const hasPassword = config.user.password != null && config.user.password !== ''
  const hasPrivateKey = config.user.privateKey != null && config.user.privateKey !== ''
  const hasAuth = hasPassword || hasPrivateKey

  if (hasHost && hasUsername && !hasAuth) {
    errors.push({
      path: 'user',
      message: 'SSH host is configured but no authentication method (password or private key) is provided',
      value: config.user
    })
  }
}

/**
 * Validates business rules and domain constraints on configuration
 * This includes branded type validations and domain-specific rules
 *
 * @param config - Configuration object that passed schema validation
 * @returns Result with validated config or validation errors
 */
export function validateBusinessRules(config: Config): Result<Config, ConfigValidationError[]> {
  const errors: ConfigValidationError[] = []

  // Validate SSH host (if provided)
  if (config.ssh.host != null) {
    validateField(
      () => validateSshHost(config.ssh.host),
      'ssh.host',
      config.ssh.host,
      errors
    )
  }

  // Validate SSH port
  validateField(
    () => validateSshPort(config.ssh.port),
    'ssh.port',
    config.ssh.port,
    errors
  )

  // Validate CSS color for header background
  if (config.header.background !== '') {
    validateField(
      () => validateCssColor(config.header.background),
      'header.background',
      config.header.background,
      errors
    )
  }

  // Validate local SSH port if provided
  if (config.ssh.localPort !== undefined) {
    validateField(
      () => validateSshPort(config.ssh.localPort),
      'ssh.localPort',
      config.ssh.localPort,
      errors
    )
  }

  // Validate listen port
  validateField(
    () => validateSshPort(config.listen.port),
    'listen.port',
    config.listen.port,
    errors
  )

  // Check authentication configuration
  checkAuthConfiguration(config, errors)

  // Validate session secret strength
  if (config.session.secret.length < 32) {
    errors.push({
      path: 'session.secret',
      message: 'Session secret should be at least 32 characters for security',
      value: '[REDACTED]'
    })
  }

  return errors.length > 0 ? err(errors) : ok(config)
}

/**
 * Complete validation pipeline: schema + business rules
 *
 * @param config - Raw configuration object
 * @returns Result with fully validated config or validation errors
 */
export function validateConfig(config: Config): Result<Config, ConfigValidationError[]> {
  // Business rules validation only (assumes schema validation was already done)
  return validateBusinessRules(config)
}