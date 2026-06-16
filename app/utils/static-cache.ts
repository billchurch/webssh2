// app/utils/static-cache.ts
// Pure Cache-Control policy for statically served client assets
//
// The bundled client (node_modules/webssh2_client/client/public) may ship
// either content-hashed filenames (Vite's `[name]-[hash].ext`, e.g.
// `webssh2-<hash>.js`, current in 5.1.0+) or stable names (webssh2.bundle.js,
// webssh2.css, ... in older builds). This policy handles each: content-hashed
// files are safe to cache for a year as immutable, since a content change
// yields a new filename. Stable-named files, whose content changes between
// releases while the filename does not, must NOT be marked immutable; they get
// a short public max-age with ETag revalidation. HTML entry points are never
// cached without revalidation.

const ONE_HOUR_SECONDS = 3600
const ONE_YEAR_SECONDS = 31_536_000

/** HTML entry points: always revalidate before reuse. */
export const CACHE_CONTROL_HTML = 'no-cache'

/** Content-hashed assets: safe to cache for a year without revalidation. */
export const CACHE_CONTROL_IMMUTABLE = `public, max-age=${ONE_YEAR_SECONDS}, immutable`

/** Stable-named assets: short cache, then ETag revalidation. */
export const CACHE_CONTROL_STABLE = `public, max-age=${ONE_HOUR_SECONDS}`

// Matches Vite-style content-hashed filenames, e.g. `vendor-AbC123xyz9.js`.
// Static pattern with non-overlapping adjacent parts (`-`, `\w`, `.` are
// mutually exclusive), so backtracking stays linear (sonarjs/slow-regex).
// A false negative (e.g. a `-` inside the hash's last 8 chars) safely falls
// back to the short-lived stable policy, never to a wrong `immutable`.
const HASHED_ASSET_PATTERN = /-\w{8,}\.(?:js|css|woff2?)$/

/**
 * Determine the Cache-Control header value for a static asset path.
 *
 * @param filePath - Absolute or relative path of the file being served
 * @returns Cache-Control header value
 * @pure
 */
export function cacheControlForAsset(filePath: string): string {
  if (filePath.endsWith('.htm') || filePath.endsWith('.html')) {
    return CACHE_CONTROL_HTML
  }
  if (HASHED_ASSET_PATTERN.test(filePath)) {
    return CACHE_CONTROL_IMMUTABLE
  }
  return CACHE_CONTROL_STABLE
}
