// app/utils/schema-validator.ts
// Pure schema validation using Zod

import type { Config, ConfigValidationError } from '../types/config.js'
import type { Result } from '../types/result.js'
import { ok, err } from './result.js'
import { ConfigSchema } from '../schemas/config-schema.js'

/**
 * Validates configuration against the schema using Zod
 *
 * @param config - Configuration object to validate
 * @returns Result with validated config or validation errors
 */
export function validateConfigSchema(config: unknown): Result<Config, ConfigValidationError[]> {
  const result = ConfigSchema.safeParse(config)

  if (result.success) {
    // Cast to Config type since our schema matches the interface
    return ok(result.data as Config)
  }

  // Transform Zod errors into our ConfigValidationError format
  const errors: ConfigValidationError[] = result.error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
    value: issue.input
    // expected field is optional, don't set if not available
  }))

  return err(errors)
}

/**
 * Validates partial configuration (for merging with defaults)
 *
 * @param config - Partial configuration object
 * @returns Result with validated partial config or validation errors
 */
export function validatePartialConfigSchema(config: unknown): Result<Partial<Config>, ConfigValidationError[]> {
  const result = ConfigSchema.partial().safeParse(config)

  if (result.success) {
    return ok(result.data as Partial<Config>)
  }

  const errors: ConfigValidationError[] = result.error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
    value: issue.input
    // expected field is optional, don't set if not available
  }))

  return err(errors)
}