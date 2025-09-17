// server
// app/utils.ts

import { createNamespacedDebug } from './logger.js'
import { MESSAGES } from './constants.js'
// Import pure validation functions
import { validateHost, validatePort, validateTerm, normalizeDimension } from './validation/ssh.js'
import {
  isValidCredentials as validateCredentials,
  type Credentials,
} from './validation/credentials.js'
import { isValidEnvKey, isValidEnvValue, parseEnvVars } from './validation/environment.js'
// Import new pure utility functions
import { deepMergePure } from './utils/object-merger.js'
import { validateConfigPure } from './utils/config-validator.js'
import { transformHtml } from './utils/html-transformer.js'
import { maskSensitive } from './utils/data-masker.js'
import { isErr } from './utils/result.js'

const debug = createNamespacedDebug('utils')

// Use pure deep merge function
export const deepMerge = deepMergePure

// Re-export validation functions for backward compatibility
export const getValidatedHost = validateHost
export const getValidatedPort = validatePort

// Re-export types and validation functions for backward compatibility
export type { Credentials }
export const isValidCredentials = validateCredentials
export const validateSshTerm = validateTerm

// Wrapper for backward compatibility - converts Result to exception
export function validateConfig(config: unknown): unknown {
  const result = validateConfigPure(config)
  if (isErr(result)) {
    throw new Error(`${MESSAGES.CONFIG_VALIDATION_ERROR}: ${result.error.message}`)
  }
  return result.value
}

// Wrapper for backward compatibility using pure transformation
export function modifyHtml(html: string, config: unknown): string {
  debug('modifyHtml')
  return transformHtml(html, config)
}

// Wrapper for backward compatibility using pure masking
export function maskSensitiveData(obj: unknown, options?: unknown): unknown {
  debug('maskSensitiveData')
  return maskSensitive(obj, options as Parameters<typeof maskSensitive>[1])
}

// Re-export environment validation functions for backward compatibility
export { isValidEnvKey, isValidEnvValue, parseEnvVars }

// Treat empty string as missing and fall back when appropriate
export function pickField(primary?: string | null, fallback?: string | null): string | undefined {
  return primary != null && primary !== '' ? primary : (fallback ?? undefined)
}

// Re-export normalizeDimension as normalizeDim for backward compatibility
export const normalizeDim = normalizeDimension
