/**
 * Theme validator — defends against prototype pollution, HTML injection bait,
 * named-color CSS, and oversized payloads. Iterates the THEME_COLOR_KEYS
 * allowlist instead of input keys; explicitly rejects __proto__ / constructor /
 * prototype at every level. Used by every theme entry path (built-in,
 * admin config, admin env var, user paste).
 */

import type {
  AdditionalTheme,
  ThemeColors
} from '../../types/config.js'
import {
  THEME_COLOR_KEYS,
  THEME_COLOR_KEY_SET
} from './theme-color-keys.js'
import {
  THEME_NAME_REGEX,
  canonicalizeThemeName,
  isReservedThemeName
} from './theme-name.js'

export const HEX_COLOR_REGEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

const LICENSE_REGEX = /^[\w .,\-()@/+:]{0,256}$/u
const MAX_THEME_BYTES = 4 * 1024
const MAX_SOURCE_LENGTH = 256
const FORBIDDEN_PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const SCRIPT_BAIT = /<\/?(?:script)|<!--/i

export type ThemeValidationContext = 'builtin' | 'additional' | 'custom'

export interface ThemeValidationError {
  readonly path: string
  readonly reason: string
}

export type ThemeValidationResult =
  | { readonly ok: true; readonly value: AdditionalTheme }
  | { readonly ok: false; readonly errors: readonly ThemeValidationError[] }

export interface ValidateThemeOptions {
  readonly builtinNames: readonly string[]
}

/** A single field's sanitized value plus the errors it accumulated. */
interface FieldResult<T> {
  readonly value: T
  readonly errors: readonly ThemeValidationError[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Rejects __proto__ / constructor / prototype declared directly on the entry. */
function collectForbiddenEntryKeyErrors(
  input: Record<string, unknown>
): ThemeValidationError[] {
  const errors: ThemeValidationError[] = []
  for (const key of FORBIDDEN_PROTOTYPE_KEYS) {
    if (Object.hasOwn(input, key)) {
      errors.push({
        path: key,
        reason: 'forbidden prototype-pollution key on entry'
      })
    }
  }
  return errors
}

/** Flags every input color key that is polluting or outside the allowlist. */
function collectColorKeyErrors(
  input: Record<string, unknown>,
  pathPrefix: string
): ThemeValidationError[] {
  const errors: ThemeValidationError[] = []
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_PROTOTYPE_KEYS.has(key)) {
      errors.push({
        path: `${pathPrefix}.${key}`,
        reason: 'forbidden prototype-pollution key'
      })
    } else if (!THEME_COLOR_KEY_SET.has(key as keyof ThemeColors)) {
      errors.push({
        path: `${pathPrefix}.${key}`,
        reason: 'unknown color key'
      })
    }
  }
  return errors
}

function rebuildColors(input: unknown, pathPrefix: string): FieldResult<ThemeColors> {
  if (!isPlainObject(input)) {
    return {
      value: {},
      errors: [{ path: pathPrefix, reason: 'colors must be an object' }]
    }
  }
  const errors = collectColorKeyErrors(input, pathPrefix)
  const out: Partial<Record<keyof ThemeColors, string>> = {}
  for (const key of THEME_COLOR_KEYS) {
    if (!Object.hasOwn(input, key)) {
      continue
    }
    // eslint-disable-next-line security/detect-object-injection -- key is from THEME_COLOR_KEYS allowlist, not user input
    const value = input[key]
    if (typeof value !== 'string' || !HEX_COLOR_REGEX.test(value)) {
      errors.push({
        path: `${pathPrefix}.${key}`,
        reason: 'must be #rgb, #rrggbb, or #rrggbbaa hex string'
      })
      continue
    }
    // eslint-disable-next-line security/detect-object-injection -- key is from THEME_COLOR_KEYS allowlist, not user input
    out[key] = value
  }
  return { value: out, errors }
}

function collidesWithBuiltin(
  canonical: string,
  builtinNames: readonly string[]
): boolean {
  const lower = canonicalizeThemeName(canonical)
  return builtinNames.some((builtin) => canonicalizeThemeName(builtin) === lower)
}

/** Extra name rules that only apply to admin-supplied additional themes. */
function collectAdditionalNameErrors(
  canonical: string,
  builtinNames: readonly string[]
): ThemeValidationError[] {
  if (isReservedThemeName(canonical)) {
    return [{ path: 'name', reason: 'name is reserved' }]
  }
  if (collidesWithBuiltin(canonical, builtinNames)) {
    return [
      {
        path: 'name',
        reason: 'name collides with built-in (case-insensitive)'
      }
    ]
  }
  return []
}

function validateName(
  rawName: unknown,
  context: ThemeValidationContext,
  options: ValidateThemeOptions
): FieldResult<string> {
  if (typeof rawName !== 'string') {
    return { value: '', errors: [{ path: 'name', reason: 'name must be a string' }] }
  }
  const canonical = rawName.normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (!THEME_NAME_REGEX.test(canonical)) {
    return {
      value: canonical,
      errors: [{ path: 'name', reason: 'name fails name regex' }]
    }
  }
  if (context !== 'additional') {
    return { value: canonical, errors: [] }
  }
  return {
    value: canonical,
    errors: collectAdditionalNameErrors(canonical, options.builtinNames)
  }
}

function validateLicense(input: Record<string, unknown>): FieldResult<string | undefined> {
  if (!Object.hasOwn(input, 'license')) {
    return { value: undefined, errors: [] }
  }
  const license = input['license']
  if (typeof license !== 'string') {
    return {
      value: undefined,
      errors: [{ path: 'license', reason: 'license must be a string' }]
    }
  }
  if (!LICENSE_REGEX.test(license)) {
    return {
      value: undefined,
      errors: [{ path: 'license', reason: 'license contains disallowed characters' }]
    }
  }
  if (SCRIPT_BAIT.test(license)) {
    return {
      value: undefined,
      errors: [{ path: 'license', reason: 'license contains script bait' }]
    }
  }
  return { value: license, errors: [] }
}

/** Parses the source URL and keeps only https origins, storing the normalized href. */
function validateSourceUrl(source: string): FieldResult<string | undefined> {
  let url: URL
  try {
    url = new URL(source)
  } catch {
    return {
      value: undefined,
      errors: [{ path: 'source', reason: 'source must be a valid URL' }]
    }
  }
  if (url.protocol === 'https:') {
    return { value: url.href, errors: [] }
  }
  return {
    value: undefined,
    errors: [{ path: 'source', reason: 'source must be https' }]
  }
}

function validateSource(input: Record<string, unknown>): FieldResult<string | undefined> {
  if (!Object.hasOwn(input, 'source')) {
    return { value: undefined, errors: [] }
  }
  const source = input['source']
  if (typeof source !== 'string') {
    return {
      value: undefined,
      errors: [{ path: 'source', reason: 'source must be a string' }]
    }
  }
  if (source.length > MAX_SOURCE_LENGTH) {
    return {
      value: undefined,
      errors: [{ path: 'source', reason: 'source exceeds 256 chars' }]
    }
  }
  if (SCRIPT_BAIT.test(source)) {
    return {
      value: undefined,
      errors: [{ path: 'source', reason: 'source contains script bait' }]
    }
  }
  return validateSourceUrl(source)
}

export function validateTheme(
  input: unknown,
  context: ThemeValidationContext,
  options: ValidateThemeOptions
): ThemeValidationResult {
  if (!isPlainObject(input)) {
    return { ok: false, errors: [{ path: '', reason: 'must be an object' }] }
  }

  const name = validateName(input['name'], context, options)
  const colors = rebuildColors(input['colors'], 'colors')
  const license = validateLicense(input)
  const source = validateSource(input)

  const errors: ThemeValidationError[] = [
    ...collectForbiddenEntryKeyErrors(input),
    ...name.errors,
    ...colors.errors,
    ...license.errors,
    ...source.errors
  ]

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const safe: AdditionalTheme = {
    name: name.value,
    colors: colors.value,
    ...(license.value === undefined ? {} : { license: license.value }),
    ...(source.value === undefined ? {} : { source: source.value })
  }

  const serialized = JSON.stringify(safe)
  if (serialized.length > MAX_THEME_BYTES) {
    return {
      ok: false,
      errors: [{ path: '', reason: 'serialized theme exceeds 4 KiB' }]
    }
  }

  return { ok: true, value: safe }
}
