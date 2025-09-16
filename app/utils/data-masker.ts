// app/utils/data-masker.ts
// Pure functions for masking sensitive data

import maskObject from 'jsmasker'

/**
 * Configuration for data masking
 */
export interface MaskingOptions {
  properties?: string[]
  [key: string]: unknown
}

/**
 * Default properties to mask
 */
export const DEFAULT_MASK_PROPERTIES = [
  'password',
  'privateKey',
  'passphrase',
  'key',
  'secret',
  'token'
]

/**
 * Create masking options with defaults
 * Pure function - no side effects
 * 
 * @param options - Optional custom masking options
 * @returns Complete masking options with defaults
 */
export function createMaskingOptions(options?: MaskingOptions): MaskingOptions {
  return {
    properties: DEFAULT_MASK_PROPERTIES,
    ...options
  }
}

/**
 * Mask sensitive data in an object
 * Pure function wrapper around jsmasker
 * 
 * @param data - Data object potentially containing sensitive information
 * @param options - Optional masking options
 * @returns Object with sensitive data masked
 */
export function maskSensitive(data: unknown, options?: MaskingOptions): unknown {
  const maskingOptions = createMaskingOptions(options)
  const masker = maskObject as unknown as (o: unknown, opts: unknown) => unknown
  return masker(data, maskingOptions)
}