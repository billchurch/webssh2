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
    try {
      validateSshHost(config.ssh.host)
    } catch (e) {
      errors.push({
        path: 'ssh.host',
        message: (e as Error).message,
        value: config.ssh.host
      })
    }
  }

  // Validate SSH port
  try {
    validateSshPort(config.ssh.port)
  } catch (e) {
    errors.push({
      path: 'ssh.port',
      message: (e as Error).message,
      value: config.ssh.port
    })
  }

  // Validate CSS color for header background
  if (config.header.background !== '') {
    try {
      validateCssColor(config.header.background)
    } catch (e) {
      errors.push({
        path: 'header.background',
        message: (e as Error).message,
        value: config.header.background
      })
    }
  }

  // Validate local SSH port if provided
  if (config.ssh.localPort !== undefined) {
    try {
      validateSshPort(config.ssh.localPort)
    } catch (e) {
      errors.push({
        path: 'ssh.localPort',
        message: (e as Error).message,
        value: config.ssh.localPort
      })
    }
  }

  // Validate listen port
  try {
    validateSshPort(config.listen.port)
  } catch (e) {
    errors.push({
      path: 'listen.port',
      message: (e as Error).message,
      value: config.listen.port
    })
  }

  // Additional business rules
  // Check that at least one auth method is configured if host is provided
  if (config.ssh.host != null && config.ssh.host !== '') {
    const hasAuth =
      (config.user.password != null && config.user.password !== '') ||
      (config.user.privateKey != null && config.user.privateKey !== '')

    if (!hasAuth && config.user.name != null && config.user.name !== '') {
      errors.push({
        path: 'user',
        message: 'SSH host is configured but no authentication method (password or private key) is provided',
        value: config.user
      })
    }
  }

  // Validate session secret strength
  if (config.session.secret.length < 32) {
    errors.push({
      path: 'session.secret',
      message: 'Session secret should be at least 32 characters for security',
      value: '[REDACTED]'
    })
  }

  if (errors.length > 0) {
    return err(errors)
  }

  return ok(config)
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