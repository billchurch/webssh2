/**
 * Theming injection helpers — build the client-facing theming payload from a
 * server `ThemingConfig`, then serialize it to a script-safe JSON string for
 * inline `<script>` injection. Mirrors the escape strategy used by
 * `injectConfig` in `app/utils/html-transformer.ts`:
 *   - `<` -> `\u003c`  (prevents `</script>` and `<!--` escapes)
 *   - U+2028 (line separator) -> `\u2028`
 *   - U+2029 (paragraph separator) -> `\u2029`
 *
 * Pure functions; no I/O, no side effects.
 */

import type { ThemingConfig } from '../../types/config.js'

export type ClientThemingPayload =
  | { readonly enabled: false }
  | {
      readonly enabled: true
      readonly allowCustom: boolean
      readonly themes: readonly string[] | null
      readonly additionalThemes: ReadonlyArray<{
        readonly name: string
        readonly colors: Record<string, string>
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
      colors: { ...t.colors } as Record<string, string>,
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
  return JSON.stringify(buildClientThemingPayload(cfg))
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}
