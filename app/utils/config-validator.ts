// app/utils/config-validator.ts
// Pure functions for config validation

import type { Config, ConfigValidationError } from '../types/config.js'
import type { Result } from '../types/result.js'
import { ok, err } from './result.js'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import configSchema from '../configSchema.js'
import {
  validateSshHost,
  validateSshPort,
  validateCssColor
} from '../validation/config.js'

/**
 * Validation error with detailed information
 */
export interface ValidationError {
  message: string
  errors?: unknown
}

/**
 * Pure function to validate configuration against schema
 * Returns Result type instead of throwing exceptions
 * 
 * @param config - Configuration object to validate
 * @returns Result with validated config or validation error
 */
export function validateConfigPure(config: unknown): Result<unknown, ValidationError> {
  type ValidateFn = ((data: unknown) => boolean) & { errors?: unknown }
  interface AjvLike {
    compile: (schema: unknown) => ValidateFn
    errorsText: (errors?: unknown) => string
  }
  type AjvConstructor = new () => AjvLike
  
  const AjvCtor = Ajv as unknown as AjvConstructor
  const ajv: AjvLike = new AjvCtor()
  ;(addFormats as unknown as (a: unknown) => void)(ajv)
  
  const validate = ajv.compile(configSchema as unknown as object)
  const valid = validate(config)
  
  if (!valid) {
    return err({
      message: ajv.errorsText(validate.errors),
      errors: validate.errors
    })
  }

  return ok(config)
}

/**
 * Transform config to enhanced config with full validation
 */
export function enhanceConfig(config: Config): Result<Config, ConfigValidationError[]> {
  // Use the existing validation pipeline
  const validationResult = validateConfigPure(config)

  if (validationResult.ok) {
    // Validation passed, continue with additional checks
  } else {
    // Convert validation error to our error format
    return err([{
      path: '',
      message: validationResult.error.message,
      value: config
    }])
  }

  // Additional branded type validations
  const errors: ConfigValidationError[] = []

  if (config.ssh.host != null) {
    try {
      validateSshHost(config.ssh.host)
    } catch (e) {
      errors.push({
        path: 'ssh.host',
        message: (e as Error).message,
        value: config.ssh.host,
      })
    }
  }

  try {
    validateSshPort(config.ssh.port)
  } catch (e) {
    errors.push({
      path: 'ssh.port',
      message: (e as Error).message,
      value: config.ssh.port,
    })
  }

  if (config.header.background !== '') {
    try {
      validateCssColor(config.header.background)
    } catch (e) {
      errors.push({
        path: 'header.background',
        message: (e as Error).message,
        value: config.header.background,
      })
    }
  }

  if (errors.length > 0) {
    return err(errors)
  }

  return ok(config)
}