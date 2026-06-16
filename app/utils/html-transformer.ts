// app/utils/html-transformer.ts
// Pure functions for HTML transformation

/**
 * Transform HTML by modifying asset paths
 * Pure function - no side effects
 *
 * @param html - HTML string to transform
 * @param basePath - Base path for assets (default: '/ssh/assets/')
 * @returns Transformed HTML with updated asset paths
 */
export function transformAssetPaths(html: string, basePath: string = '/ssh/assets/'): string {
  return html.replaceAll(/(src|href)="(?!http|\/\/)/g, `$1="${basePath}`)
}

/** Placeholder string in the client HTML that gets replaced with the runtime config. */
const CONFIG_PLACEHOLDER = 'window.webssh2Config = null;'

/** Inert JSON data block placeholder (client >= 5.1.0); preferred injection point. */
const JSON_BLOCK_PLACEHOLDER =
  '<script type="application/json" id="webssh2-config">null</script>'

/**
 * Script-safe escape for embedding JSON inside an HTML `<script>` element
 * (executable or `type="application/json"`). Escapes the only sequences that
 * can break out of a script element or terminate JS parsing:
 *   - `<`        -> `<`  (prevents `</script>` and `<!--`; JSON.parse restores `<`)
 *   - U+2028     -> `\u2028`
 *   - U+2029     -> `\u2029`
 * This is the single XSS trust boundary for injected config — every injection
 * site MUST route through it.
 */
function escapeForScript(json: string): string {
  return json
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}

/** Serialize a config object to a script-safe JSON string. */
export function serializeConfig(config: unknown): string {
  return escapeForScript(JSON.stringify(config))
}

/** Inject a pre-serialized, script-safe JSON string into both placeholders. */
function injectSerialized(html: string, serialized: string): string {
  return html
    .replace(
      JSON_BLOCK_PLACEHOLDER,
      `<script type="application/json" id="webssh2-config">${serialized}</script>`
    )
    .replace(CONFIG_PLACEHOLDER, `window.webssh2Config = ${serialized};`)
}

/**
 * Inject configuration into HTML. Pure function.
 *
 * Replaces both the inert JSON data block (preferred by client >= 5.1.0) and
 * the legacy `window.webssh2Config` inline script (transition fallback for
 * older/custom client builds). On an old-client template lacking the JSON
 * block, the block replacement is a harmless no-op.
 */
export function injectConfig(html: string, config: unknown): string {
  return injectSerialized(html, serializeConfig(config))
}

export function transformHtml(html: string, config: unknown, basePath?: string): string {
  const htmlWithAssetPaths = transformAssetPaths(html, basePath)
  return injectConfig(htmlWithAssetPaths, config)
}

/**
 * Inject configuration merged with a pre-serialized, script-safe theming JSON
 * slice, into both placeholders. `configWithoutTheming` is narrowed to a plain
 * object so it cannot serialize to a non-object form. Edge case: an empty base
 * object yields `{"theming":<json>}` rather than `{,"theming":<json>}`.
 *
 * SECURITY: `themingJson` MUST already be script-safe — every `<`, U+2028, and
 * U+2029 escaped via `serializeConfig` (or `serializeThemingForInjection`,
 * which delegates to it). It is spliced in verbatim WITHOUT re-escaping, so
 * passing raw `JSON.stringify()` output here is a security bug (XSS).
 */
export function injectConfigWithThemingString(
  html: string,
  configWithoutTheming: Record<string, unknown>,
  themingJson: string
): string {
  const base = serializeConfig(configWithoutTheming)
  const merged =
    base === '{}'
      ? `{"theming":${themingJson}}`
      : `${base.slice(0, -1)},"theming":${themingJson}}`
  return injectSerialized(html, merged)
}
