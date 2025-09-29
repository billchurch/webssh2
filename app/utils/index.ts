// server
// app/utils/index.ts

/**
 * Central barrel export for utility functions.
 *
 * Organized by category:
 * - Result type utilities (functional error handling)
 * - Cryptography utilities
 * - Object manipulation utilities
 * - Data masking utilities
 * - HTML transformation utilities
 * - Credential building utilities
 * - Config building utilities
 * - Config validation utilities
 * - Safe property access utilities
 * - Helper functions
 *
 * Note: Validation functions are exported from app/validation/index.ts
 */

// ============================================================================
// Result Type Utilities
// ============================================================================

/**
 * Functional error handling with Result<T, E> type.
 * Only exports production-used functions.
 */
export {
  ok,
  err,
  isErr
} from './result.js'

// ============================================================================
// Cryptography Utilities
// ============================================================================

/**
 * Generate cryptographically secure random secrets.
 */
export { generateSecureSecret } from './crypto.js'

// ============================================================================
// Object Manipulation Utilities
// ============================================================================

/**
 * Deep merge objects without mutation (pure function).
 */
export { deepMergePure as deepMerge } from './object-merger.js'

// ============================================================================
// Data Masking Utilities
// ============================================================================

/**
 * Mask sensitive data in objects for logging.
 */
export {
  maskSensitive,
  createMaskingOptions,
  DEFAULT_MASK_PROPERTIES,
  type MaskingOptions
} from './data-masker.js'

// ============================================================================
// HTML Transformation Utilities
// ============================================================================

/**
 * Transform HTML content and inject configuration.
 */
export {
  transformHtml,
  transformAssetPaths,
  injectConfig
} from './html-transformer.js'

// ============================================================================
// Credential Building Utilities
// ============================================================================

/**
 * Extract and validate SSH credentials from various sources.
 */
export {
  extractAuthCredentials,
  extractOptionalTerminalSettings,
  validateRequiredFields,
  convertToAuthCredentials,
  CredentialError,
  type TerminalSettings
} from './credential-extractor.js'

// ============================================================================
// Config Validation Utilities
// ============================================================================

/**
 * Schema validation using Zod.
 */
export {
  validateConfigSchema,
  validatePartialConfigSchema
} from './schema-validator.js'

/**
 * Business rules and domain validation.
 */
export {
  validateBusinessRules,
  validateConfig
} from './domain-validator.js'

/**
 * Legacy exports for backward compatibility.
 * @deprecated Use validateConfigSchema and validateBusinessRules instead
 */
export { validateConfigSchema as validateConfigPure } from './schema-validator.js'
export { validateBusinessRules as enhanceConfig } from './domain-validator.js'

// ============================================================================
// Safe Property Access Utilities
// ============================================================================

/**
 * Type-safe property access utilities using branded types.
 */
export {
  createSafeKey,
  validateKey,
  safeGet,
  safeSet,
  safeGetNested,
  safeSetNested,
  safeEntries,
  safeKeys,
  isRecord,
  safePathToKeys,
  type SafeKey
} from './safe-property-access.js'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Pick first non-empty field, treating empty string as missing.
 * Falls back to second value if first is null, undefined, or empty string.
 */
export function pickField(primary?: string | null, fallback?: string | null): string | undefined {
  return primary != null && primary !== '' ? primary : (fallback ?? undefined)
}
