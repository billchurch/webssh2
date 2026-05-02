// app/utils/html-transformer.ts
// Pure functions for HTML transformation

/** Placeholder string in the client HTML that gets replaced with the runtime config. */
const CONFIG_PLACEHOLDER = 'window.webssh2Config = null;'

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

/**
 * Inject configuration into HTML
 * Pure function - no side effects
 *
 * Script-safe: escapes characters that could break out of a `<script>` tag or
 * cause unintended JavaScript execution:
 *   - `<` → `<`  (prevents `</script>` and `<!--` injection)
 *   - U+2028 (line separator) → `\u2028` (valid JS line terminator)
 *   - U+2029 (paragraph separator) → `\u2029` (valid JS line terminator)
 *
 * @param html - HTML string to modify
 * @param config - Configuration object to inject
 * @returns HTML with injected configuration
 */
export function injectConfig(html: string, config: unknown): string {
  const safeJson = JSON.stringify(config)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
  return html.replace(
    CONFIG_PLACEHOLDER,
    `window.webssh2Config = ${safeJson};`
  )
}

/**
 * Transform HTML with asset paths and config injection
 * Composition of pure transformation functions
 *
 * @param html - HTML string to transform
 * @param config - Configuration object to inject
 * @param basePath - Base path for assets (default: '/ssh/assets/')
 * @returns Fully transformed HTML
 */
export function transformHtml(html: string, config: unknown, basePath?: string): string {
  const htmlWithAssetPaths = transformAssetPaths(html, basePath)
  return injectConfig(htmlWithAssetPaths, config)
}

/**
 * Inject configuration with a pre-serialized theming JSON slice.
 *
 * The base config object is stringified and script-safe-escaped using the same
 * rules as `injectConfig`. The provided `themingJson` (already script-safe)
 * is then spliced in as a `theming` property before the closing brace.
 *
 * Edge case: when `configWithoutTheming` serializes to `{}`, the result is
 * `{"theming":<json>}` rather than the malformed `{,"theming":<json>}`.
 *
 * The parameter is narrowed to `Record<string, unknown>` so callers cannot
 * accidentally pass `null`, an array, or a primitive - any of which would
 * stringify to a non-object form and produce malformed merged JSON.
 *
 * @param html - HTML string to modify
 * @param configWithoutTheming - Plain config object (must NOT contain a `theming` key)
 * @param themingJson - Pre-serialized, script-safe theming JSON string
 * @returns HTML with merged configuration injected
 */
export function injectConfigWithThemingString(
  html: string,
  configWithoutTheming: Record<string, unknown>,
  themingJson: string
): string {
  const base = JSON.stringify(configWithoutTheming)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
  const merged = base === '{}'
    ? `{"theming":${themingJson}}`
    : `${base.slice(0, -1)},"theming":${themingJson}}`
  return html.replace(
    CONFIG_PLACEHOLDER,
    `window.webssh2Config = ${merged};`
  )
}
