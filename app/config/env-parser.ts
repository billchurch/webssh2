// app/config/env-parser.ts
// Pure functions for parsing environment variable values

export type EnvValueType = 'string' | 'number' | 'boolean' | 'array' | 'preset' | 'json'

export type ParsedEnvValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, unknown>
  | unknown[]
  | null

/**
 * Parse a comma-separated or JSON array string into array
 * @param value - String value to parse
 * @returns Array of strings
 * @pure
 */
export function parseArrayValue(value: string): string[] {
  if (value === '') {
    return []
  }
  
  // Try to parse as JSON array first
  if (value.trim().startsWith('[') && value.trim().endsWith(']')) {
    try {
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed) ? (parsed as string[]) : []
    } catch {
      // Fall through to comma-separated parsing
    }
  }
  
  // Parse as comma-separated values
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

/**
 * Parse an environment variable value based on its type
 * @param value - String value from environment
 * @param type - Expected type of the value
 * @returns Parsed value of appropriate type
 * @pure
 */
export function parseEnvValue(
  value: string,
  type: EnvValueType
): ParsedEnvValue {
  if (value === 'null') {
    return null
  }
  
  if (value === '') {
    return type === 'array' ? [] : null
  }
  
  switch (type) {
    case 'boolean':
      return value === 'true' || value === '1'
    case 'number':
      return Number.parseFloat(value)
    case 'array':
      return parseArrayValue(value)
    case 'string':
      return value
    case 'preset':
      // Presets are handled upstream; return raw value
      return value
    case 'json':
      return parseJsonValue(value)
  }
}

function parseJsonValue(value: string): Record<string, unknown> | unknown[] | null {
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      const arrayValue = parsed as unknown[]
      return arrayValue
    }
    if (parsed !== null && typeof parsed === 'object') {
      const objectValue = parsed as Record<string, unknown>
      return objectValue
    }
  } catch {
    return null
  }
  return null
}

/**
 * Parse boolean environment variable with default
 * @param value - String value from environment
 * @param defaultValue - Default boolean value
 * @returns Parsed boolean
 * @pure
 */
export function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue
  }
  return value === 'true' || value === '1'
}

/**
 * Parse number environment variable with default
 * @param value - String value from environment
 * @param defaultValue - Default number value
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Parsed number within bounds
 * @pure
 */
export function parseNumberEnv(
  value: string | undefined,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  if (value === undefined || value === '') {
    return defaultValue
  }

  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    return defaultValue
  }

  let result = parsed
  if (min !== undefined && result < min) {
    result = min
  }
  if (max !== undefined && result > max) {
    result = max
  }

  return result
}

/**
 * Result of decoding a base64-encoded JSON-array environment variable.
 * Used for `WEBSSH2_THEMING_ADDITIONAL_THEMES`.
 */
export interface ParseBase64JsonArrayOk {
  readonly ok: true
  readonly value: readonly unknown[]
}

export interface ParseBase64JsonArrayErr {
  readonly ok: false
  readonly reason:
    | 'rawOversize'
    | 'base64'
    | 'oversize'
    | 'json'
    | 'notArray'
  readonly detail?: string
}

export type ParseBase64JsonArrayResult =
  | ParseBase64JsonArrayOk
  | ParseBase64JsonArrayErr

const RAW_BASE64_CAP = Math.floor((64 * 1024 * 4) / 3) + 8 // ~89_408
const DECODED_CAP = 64 * 1024

/**
 * Decode a base64-encoded JSON array environment variable, with strict caps
 * and structured error reasons. Does NOT validate the array contents — the
 * caller is responsible for per-element validation (e.g. validateTheme).
 */
export function parseBase64JsonArrayEnv(
  raw: string
): ParseBase64JsonArrayResult {
  if (raw.length > RAW_BASE64_CAP) {
    return { ok: false, reason: 'rawOversize' }
  }

  let decoded: string
  try {
    const buf = Buffer.from(raw, 'base64')
    if (buf.length > DECODED_CAP) {
      return { ok: false, reason: 'oversize' }
    }
    decoded = buf.toString('utf8')
    // Verify the string is valid base64 by round-tripping (strip padding for comparison)
    const roundTripped = Buffer.from(decoded, 'utf8').toString('base64').replace(/=+$/u, '')
    const rawStripped = raw.replace(/=+$/u, '')
    if (roundTripped === rawStripped) {
      // valid base64 — continue
    } else {
      return { ok: false, reason: 'base64' }
    }
  } catch {
    return { ok: false, reason: 'base64' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(decoded)
  } catch (error) {
    return {
      ok: false,
      reason: 'json',
      detail: error instanceof Error ? error.message : String(error)
    }
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, reason: 'notArray' }
  }

  return { ok: true, value: parsed }
}
