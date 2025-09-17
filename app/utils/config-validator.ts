// app/utils/config-validator.ts
// Pure functions for config validation

import type { Result } from '../types/result.js'
import { ok, err } from './result.js'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import configSchema from '../configSchema.js'

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