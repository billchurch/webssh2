// app/utils/html-transformer.ts
// Pure functions for HTML transformation

/**
 * Transform HTML by modifying asset paths
 * Pure function - no side effects
 * 
 * @param html - HTML string to transform
 * @returns Transformed HTML with updated asset paths
 */
export function transformAssetPaths(html: string): string {
  return html.replaceAll(/(src|href)="(?!http|\/\/)/g, '$1="/ssh/assets/')
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
 * @returns Fully transformed HTML
 */
export function transformHtml(html: string, config: unknown): string {
  const htmlWithAssetPaths = transformAssetPaths(html)
  return injectConfig(htmlWithAssetPaths, config)
}