// app/auth/header-processor.ts
// Pure functions for processing header customization

import { createNamespacedDebug } from '../logger.js'

const debug = createNamespacedDebug('auth:header')

/**
 * Header override configuration
 */
export interface HeaderOverride {
  text?: string
  background?: string
}

/**
 * Header values from request
 */
export interface HeaderValues {
  header?: unknown
  background?: unknown
}

/**
 * Source type for header parameters
 */
export enum SourceType {
  GET = 'GET',
  POST = 'POST',
  NONE = 'NONE'
}

/**
 * Detect the source type based on property names
 * Pure function - no side effects
 */
export function detectSourceType(source: Record<string, unknown> | undefined): SourceType {
  if (source == null) {return SourceType.NONE}

  // POST body parameters take precedence over GET query parameters.
  // When both are present, body wins — query is ignored.
  const hasPostParams =
    Object.hasOwn(source, 'header.name') ||
    Object.hasOwn(source, 'header.background')

  if (hasPostParams) {return SourceType.POST}

  const hasGetParams =
    Object.hasOwn(source, 'header') ||
    Object.hasOwn(source, 'headerBackground')

  if (hasGetParams) {return SourceType.GET}

  return SourceType.NONE
}

/**
 * Validate header value
 * Pure function - no side effects
 */
export function validateHeaderValue(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') {
    return null
  }
  // Limit length and remove control characters for security
  // Control characters (U+0000-U+001F and U+007F) must be removed to prevent header injection attacks
  return Array.from(value)
    .slice(0, 100)
    .filter((char) => {
      const codePoint = char.codePointAt(0)
      if (codePoint == null) {return false}

      return codePoint > 0x1f && codePoint !== 0x7f
    })
    .join('')
}

/**
 * Returns true if `source` carries any header-related key — current
 * (`header`, `headerBackground`, `header.name`, `header.background`) or
 * legacy (`headerStyle`, `header.color`).
 *
 * Used by `processHeaderParameters` to suppress override-clearing when a
 * request includes only legacy fields (issue #102). The legacy fields are
 * silently ignored for extraction but still inhibit the clear, so a
 * request that only sends `header.color` does NOT wipe a previously-set
 * `session.headerOverride`.
 */
export function hasAnyHeaderKey(
  source: Record<string, unknown> | undefined
): boolean {
  if (source == null) {
    return false
  }
  if (
    Object.hasOwn(source, 'header') ||
    Object.hasOwn(source, 'headerBackground') ||
    Object.hasOwn(source, 'header.name') ||
    Object.hasOwn(source, 'header.background')
  ) {
    return true
  }
  return (
    Object.hasOwn(source, 'headerStyle') ||
    Object.hasOwn(source, 'header.color')
  )
}

/**
 * Extract header values based on source type
 * Pure function - no side effects
 */
export function extractHeaderValues(
  source: Record<string, unknown>,
  sourceType: SourceType
): HeaderValues {
  if (sourceType === SourceType.GET) {
    return {
      header: source['header'],
      background: source['headerBackground']
    }
  }

  if (sourceType === SourceType.POST) {
    return {
      header: source['header.name'],
      background: source['header.background']
    }
  }
  
  return {}
}

/**
 * Create header override object from values
 * Pure function - no side effects
 */
export function createHeaderOverride(
  values: HeaderValues,
  _sourceType: SourceType
): HeaderOverride | null {
  const text = validateHeaderValue(values.header)
  const background = validateHeaderValue(values.background)

  if (text == null && background == null) {
    return null
  }

  const override: HeaderOverride = {}
  if (text != null) {override.text = text}
  if (background != null) {override.background = background}

  return override
}

/**
 * Merge header override into existing override
 * Pure function - returns new object
 */
export function mergeHeaderOverride(
  existing: HeaderOverride | undefined,
  override: HeaderOverride
): HeaderOverride {
  return {
    ...existing,
    ...override
  }
}

/**
 * Process header parameters from source
 * Pure function composition
 */
export function processHeaderParams(
  source: Record<string, unknown> | undefined
): HeaderOverride | null {
  const sourceType = detectSourceType(source)
  if (sourceType === SourceType.NONE) {return null}
  
  const values = extractHeaderValues(source ?? {}, sourceType)
  const override = createHeaderOverride(values, sourceType)
  
  if (override != null) {
    debug('Processed header override: %O from %s', override, sourceType)
  }
  
  return override
}
