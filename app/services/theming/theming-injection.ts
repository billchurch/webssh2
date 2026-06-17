/**
 * Theming injection helpers — build the client-facing theming payload from a
 * server `ThemingConfig`, then serialize it to a script-safe JSON string for
 * inline `<script>` injection. Script-safe escaping is delegated to the
 * canonical `serializeConfig` helper in `app/utils/html-transformer.ts`, which
 * is the single XSS trust boundary for injected config.
 *
 * Pure functions; no I/O, no side effects.
 */

import type { ThemeColors, ThemingConfig } from '../../types/config.js'
import { serializeConfig } from '../../utils/html-transformer.js'

export type ClientThemingPayload =
  | { readonly enabled: false }
  | {
      readonly enabled: true
      readonly allowCustom: boolean
      readonly themes: readonly string[] | null
      readonly additionalThemes: ReadonlyArray<{
        readonly name: string
        readonly colors: ThemeColors
        readonly license?: string
        readonly source?: string
      }>
      readonly defaultTheme: string
      readonly headerBackground: ThemingConfig['headerBackground']
    }

/**
 * Build the client-facing theming payload. Returns `{ enabled: false }` when
 * theming is disabled so the client can short-circuit without exposing the
 * theme catalog. When enabled, returns a sanitized snapshot containing only
 * the public-facing fields.
 */
export function buildClientThemingPayload(cfg: ThemingConfig): ClientThemingPayload {
  if (cfg.enabled === false) {
    return { enabled: false }
  }
  return {
    enabled: true,
    allowCustom: cfg.allowCustom,
    themes: cfg.themes,
    additionalThemes: cfg.additionalThemes.map((t) => ({
      name: t.name,
      colors: { ...t.colors },
      ...(t.license !== undefined && { license: t.license }),
      ...(t.source !== undefined && { source: t.source })
    })),
    defaultTheme: cfg.defaultTheme,
    headerBackground: cfg.headerBackground
  }
}

/**
 * Serialize a `ThemingConfig` to a script-safe JSON string suitable for inline
 * injection into an HTML `<script>` block. See module header for escape rules.
 */
export function serializeThemingForInjection(cfg: ThemingConfig): string {
  return serializeConfig(buildClientThemingPayload(cfg))
}
