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

/**
 * Inject configuration into HTML
 * Pure function - no side effects
 * 
 * @param html - HTML string to modify
 * @param config - Configuration object to inject
 * @returns HTML with injected configuration
 */
export function injectConfig(html: string, config: unknown): string {
  return html.replace(
    'window.webssh2Config = null;',
    `window.webssh2Config = ${JSON.stringify(config)};`
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