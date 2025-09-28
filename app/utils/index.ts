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
 * Provides Railway-oriented programming primitives for safe error handling.
 */
export {
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  andThen,
  orElse,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  toNullable,
  fromNullable,
  tryCatch,
  tryCatchAsync,
  combine,
  combineAll
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
 * Build and extract SSH credentials from various sources.
 */
export {
  buildCredentials,
  extractSessionCredentials,
  hasRequiredCredentials
} from './credential-builder.js'

// ============================================================================
// Config Validation Utilities
// ============================================================================

/**
 * Pure configuration validation functions.
 */
export {
  validateConfigPure,
  enhanceConfig,
  type ValidationError
} from './config-validator.js'

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
