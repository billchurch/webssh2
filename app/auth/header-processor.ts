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
  style?: string
}

/**
 * Header values from request
 */
export interface HeaderValues {
  header?: unknown
  background?: unknown
  color?: unknown
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
  
  const hasGetParams = 
    Object.hasOwn(source, 'header') ||
    Object.hasOwn(source, 'headerBackground') ||
    Object.hasOwn(source, 'headerStyle')
  
  if (hasGetParams) {return SourceType.GET}
  
  const hasPostParams = 
    Object.hasOwn(source, 'header.name') ||
    Object.hasOwn(source, 'header.color') ||
    Object.hasOwn(source, 'header.background')
  
  if (hasPostParams) {return SourceType.POST}
  
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
  // Control characters (\x00-\x1F and \x7F) must be removed to prevent header injection attacks
  // eslint-disable-next-line no-control-regex
  return value.slice(0, 100).replaceAll(/[\x00-\x1F\x7F]/g, '')
}

/**
 * Convert color value to style string
 * Pure function - no side effects
 */
export function colorToStyle(color: unknown): string | null {
  const validated = validateHeaderValue(color)
  if (validated == null) {return null}
  
  // Basic validation for CSS color values
  if (!/^[a-zA-Z0-9#(),.\s-]+$/.test(validated)) {
    return null
  }
  
  return `color: ${validated}`
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
      background: source['headerBackground'],
      color: source['headerStyle']
    }
  }
  
  if (sourceType === SourceType.POST) {
    return {
      header: source['header.name'],
      background: source['header.background'],
      color: source['header.color']
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
  sourceType: SourceType
): HeaderOverride | null {
  const text = validateHeaderValue(values.header)
  const background = validateHeaderValue(values.background)
  const style = sourceType === SourceType.GET 
    ? validateHeaderValue(values.color)
    : colorToStyle(values.color)

  if (text == null && background == null && style == null) {
    return null
  }

  const override: HeaderOverride = {}
  if (text != null) {override.text = text}
  if (background != null) {override.background = background}
  if (style != null) {override.style = style}
  
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