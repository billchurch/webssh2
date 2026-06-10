// tests/unit/utils/static-cache.vitest.ts
// Tests for pure static asset Cache-Control policy

import { describe, it, expect } from 'vitest'
import {
  cacheControlForAsset,
  CACHE_CONTROL_HTML,
  CACHE_CONTROL_IMMUTABLE,
  CACHE_CONTROL_STABLE,
} from '../../../app/utils/static-cache.js'

describe('cacheControlForAsset', () => {
  it.each([
    ['webssh2.bundle.js', CACHE_CONTROL_STABLE],
    ['webssh2.css', CACHE_CONTROL_STABLE],
    ['xterm.css', CACHE_CONTROL_STABLE],
    ['favicon.ico', CACHE_CONTROL_STABLE],
  ])('returns short public caching for stable-named asset %s', (filePath, expected) => {
    expect(cacheControlForAsset(filePath)).toBe(expected)
  })

  it.each([
    ['client.htm', CACHE_CONTROL_HTML],
    ['index.html', CACHE_CONTROL_HTML],
  ])('returns no-cache for HTML file %s', (filePath, expected) => {
    expect(cacheControlForAsset(filePath)).toBe(expected)
  })

  it.each([
    ['vendor-AbC123xyz9.js', CACHE_CONTROL_IMMUTABLE],
    ['app-12345678.css', CACHE_CONTROL_IMMUTABLE],
    ['font-abcdef12.woff2', CACHE_CONTROL_IMMUTABLE],
  ])('returns long-lived immutable caching for hashed asset %s', (filePath, expected) => {
    expect(cacheControlForAsset(filePath)).toBe(expected)
  })

  it.each([
    ['app-abc.js'], // hash segment too short
    ['file-12345678.png'], // extension not in hashed-asset allowlist
  ])('does not treat near-miss %s as immutable', (filePath) => {
    expect(cacheControlForAsset(filePath)).toBe(CACHE_CONTROL_STABLE)
  })

  it('matches hashed assets by full path, not just basename', () => {
    expect(cacheControlForAsset('/srv/public/assets/vendor-AbC123xyz9.js')).toBe(
      CACHE_CONTROL_IMMUTABLE
    )
  })

  it('expected header values stay aligned with the HTTP caching policy', () => {
    expect(CACHE_CONTROL_HTML).toBe('no-cache')
    expect(CACHE_CONTROL_STABLE).toBe('public, max-age=3600')
    expect(CACHE_CONTROL_IMMUTABLE).toBe('public, max-age=31536000, immutable')
  })
})
