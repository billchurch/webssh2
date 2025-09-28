// server
// app/utils.ts

import { createNamespacedDebug } from './logger.js'
import { MESSAGES } from './constants.js'
import { validateConfigPure } from './utils/config-validator.js'
import { transformHtml } from './utils/html-transformer.js'
import { maskSensitive } from './utils/data-masker.js'
import { isErr } from './utils/result.js'

const debug = createNamespacedDebug('utils')

// Re-export using export...from syntax for better tree-shaking and clarity
export { generateSecureSecret } from './utils/crypto.js'
export { deepMergePure as deepMerge } from './utils/object-merger.js'
export { validateHost as getValidatedHost, validatePort as getValidatedPort, validateTerm as validateSshTerm, normalizeDimension } from './validation/ssh.js'
export { isValidCredentials, type Credentials } from './validation/credentials.js'
export { isValidEnvKey, isValidEnvValue, parseEnvVars } from './validation/environment.js'

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

// Re-export normalizeDimension with an alias for backward compatibility
export { normalizeDimension as normalizeDim } from './validation/ssh.js'

// Treat empty string as missing and fall back when appropriate
export function pickField(primary?: string | null, fallback?: string | null): string | undefined {
  return primary != null && primary !== '' ? primary : (fallback ?? undefined)
}
