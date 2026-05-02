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
const FORBIDDEN_PROTOTYPE_KEYS = ['__proto__', 'constructor', 'prototype']
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function rebuildColors(
  input: unknown,
  errors: ThemeValidationError[],
  pathPrefix: string
): ThemeColors {
  const out: Partial<Record<keyof ThemeColors, string>> = {}
  if (!isPlainObject(input)) {
    errors.push({ path: pathPrefix, reason: 'colors must be an object' })
    return out as ThemeColors
  }
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_PROTOTYPE_KEYS.includes(key)) {
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
  return out as ThemeColors
}

export function validateTheme(
  input: unknown,
  context: ThemeValidationContext,
  options: ValidateThemeOptions
): ThemeValidationResult {
  const errors: ThemeValidationError[] = []

  if (!isPlainObject(input)) {
    return { ok: false, errors: [{ path: '', reason: 'must be an object' }] }
  }

  for (const key of FORBIDDEN_PROTOTYPE_KEYS) {
    if (Object.hasOwn(input, key)) {
      errors.push({
        path: key,
        reason: 'forbidden prototype-pollution key on entry'
      })
    }
  }

  const rawName = input['name']
  let canonicalName = ''
  if (typeof rawName === 'string') {
    const canonical = rawName.normalize('NFKC').trim().replace(/\s+/g, ' ')
    if (!THEME_NAME_REGEX.test(canonical)) {
      errors.push({ path: 'name', reason: 'name fails name regex' })
    } else if (context === 'additional') {
      if (isReservedThemeName(canonical)) {
        errors.push({ path: 'name', reason: 'name is reserved' })
      } else {
        const lower = canonicalizeThemeName(canonical)
        for (const builtin of options.builtinNames) {
          if (canonicalizeThemeName(builtin) === lower) {
            errors.push({
              path: 'name',
              reason: 'name collides with built-in (case-insensitive)'
            })
            break
          }
        }
      }
    }
    canonicalName = canonical
  } else {
    errors.push({ path: 'name', reason: 'name must be a string' })
  }

  const colors = rebuildColors(input['colors'], errors, 'colors')

  let licenseOut: string | undefined
  if (Object.hasOwn(input, 'license')) {
    const license = input['license']
    if (typeof license !== 'string') {
      errors.push({ path: 'license', reason: 'license must be a string' })
    } else if (!LICENSE_REGEX.test(license)) {
      errors.push({
        path: 'license',
        reason: 'license contains disallowed characters'
      })
    } else if (SCRIPT_BAIT.test(license)) {
      errors.push({ path: 'license', reason: 'license contains script bait' })
    } else {
      licenseOut = license
    }
  }

  let sourceOut: string | undefined
  if (Object.hasOwn(input, 'source')) {
    const source = input['source']
    if (typeof source !== 'string') {
      errors.push({ path: 'source', reason: 'source must be a string' })
    } else if (source.length > 256) {
      errors.push({ path: 'source', reason: 'source exceeds 256 chars' })
    } else if (SCRIPT_BAIT.test(source)) {
      errors.push({ path: 'source', reason: 'source contains script bait' })
    } else {
      try {
        const url = new URL(source)
        if (url.protocol === 'https:') {
          sourceOut = url.href
        } else {
          errors.push({ path: 'source', reason: 'source must be https' })
        }
      } catch {
        errors.push({ path: 'source', reason: 'source must be a valid URL' })
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const safe: AdditionalTheme = {
    name: canonicalName,
    colors,
    ...(licenseOut === undefined ? {} : { license: licenseOut }),
    ...(sourceOut === undefined ? {} : { source: sourceOut })
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
