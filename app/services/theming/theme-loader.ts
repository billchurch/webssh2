/**
 * Theme loader — processes a raw array of unknown entries from config or env,
 * validates each one via `validateTheme`, and returns a partitioned result with
 * the valid `AdditionalTheme` objects and structured warnings for every entry
 * that failed validation or collided with a built-in or duplicate name.
 * Never throws; all errors are surfaced as `ThemeValidationWarning` items.
 */

import type { AdditionalTheme } from '../../types/config.js'
import { validateTheme } from './theme-validator.js'

export interface ThemeValidationWarning {
  readonly source: string
  readonly path: string
  readonly reason: string
}

export interface LoadAdditionalThemesResult {
  readonly valid: readonly AdditionalTheme[]
  readonly warnings: readonly ThemeValidationWarning[]
}

export interface LoadAdditionalThemesOptions {
  readonly source: string
  readonly builtinNames: readonly string[]
}

export function loadAdditionalThemes(
  raw: readonly unknown[],
  options: LoadAdditionalThemesOptions
): LoadAdditionalThemesResult {
  const valid: AdditionalTheme[] = []
  const warnings: ThemeValidationWarning[] = []
  for (const [index, entry] of raw.entries()) {
    const result = validateTheme(entry, 'additional', {
      builtinNames: options.builtinNames
    })
    if (result.ok) {
      // also block duplicate names within the additional set
      const canonical = result.value.name.toLowerCase()
      const collides = valid.some((t) => t.name.toLowerCase() === canonical)
      if (collides) {
        warnings.push({
          source: options.source,
          path: `[${index}].name`,
          reason: 'duplicate name within additionalThemes'
        })
        continue
      }
      valid.push(result.value)
      continue
    }
    for (const err of result.errors) {
      warnings.push({
        source: options.source,
        path: `[${index}]${err.path === '' ? '' : `.${err.path}`}`,
        reason: err.reason
      })
    }
  }
  return { valid, warnings }
}
