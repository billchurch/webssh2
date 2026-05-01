/**
 * Barrel exports for theming services and a startup-cached injection slice.
 *
 * `getCachedThemingJson` memoizes the script-safe theming JSON produced by
 * `serializeThemingForInjection` so per-request overhead is a single string
 * splice. Startup callers should call `setLoadedThemingForInjection` once
 * after config load to pre-warm the cache; tests can call
 * `resetCachedThemingJsonForTests` to clear it.
 */

import type { ThemingConfig } from '../../types/config.js'
import { serializeThemingForInjection } from './theming-injection.js'

export * from './theme-color-keys.js'
export * from './theme-name.js'
export * from './theme-validator.js'
export * from './theme-loader.js'
export * from './theming-injection.js'

let cached: string | null = null

/**
 * Returns the script-safe theming JSON string, computing it on first access
 * and reusing the cached value thereafter.
 */
export function getCachedThemingJson(cfg: ThemingConfig): string {
  cached ??= serializeThemingForInjection(cfg)
  return cached
}

/**
 * Pre-warm the theming cache at startup with the resolved server config.
 * Idempotent: subsequent calls overwrite the cached value (useful when the
 * config is reloaded in long-running processes / tests).
 */
export function setLoadedThemingForInjection(cfg: ThemingConfig): void {
  cached = serializeThemingForInjection(cfg)
}

/**
 * Test-only helper to drop the cached value so subsequent calls recompute.
 */
export function resetCachedThemingJsonForTests(): void {
  cached = null
}
