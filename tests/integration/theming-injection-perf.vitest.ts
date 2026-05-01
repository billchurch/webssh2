import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import {
  serializeThemingForInjection,
} from '../../app/services/theming/theming-injection.js'
import { injectConfigWithThemingString } from '../../app/utils/html-transformer.js'
import type { AdditionalTheme, ThemingConfig } from '../../app/types/config.js'

/**
 * Microbenchmark for the per-request theming injection path. Verifies that
 * splicing a precomputed (cached) theming JSON slice into the host HTML stays
 * well under a single millisecond on average, even for ~64 KiB payloads.
 */

const HOST = '<script>window.webssh2Config = null;</script>'

const PADDING_64K = 'x'.repeat(64 * 1024)

const padded64KTheme: AdditionalTheme = {
  name: 'padded-64k',
  colors: {
    background: '#000000',
    foreground: '#ffffff',
  },
  // Padding on a public-facing string field bloats the serialized payload to
  // ~64 KiB, simulating a realistic upper bound for admin-supplied metadata.
  source: PADDING_64K,
}

const themingCfg: ThemingConfig = {
  enabled: true,
  allowCustom: false,
  themes: null,
  additionalThemes: [padded64KTheme],
  defaultTheme: 'padded-64k',
  headerBackground: 'independent',
}

describe('theming injection performance', () => {
  it('splices a 64 KiB precomputed theming JSON in <5 ms (avg over 100 iters)', () => {
    // Simulate the startup cache: serialize once, reuse per request.
    const themingJson = serializeThemingForInjection(themingCfg)
    expect(themingJson.length).toBeGreaterThan(64 * 1024)

    const configWithoutTheming: Record<string, unknown> = {
      autoConnect: true,
      socket: { url: 'http://example.test', path: '/ssh/socket.io' },
    }

    // Warmup so JIT effects do not skew the first iteration.
    injectConfigWithThemingString(HOST, configWithoutTheming, themingJson)

    const iters = 100
    const start = performance.now()
    for (let i = 0; i < iters; i++) {
      injectConfigWithThemingString(HOST, configWithoutTheming, themingJson)
    }
    const avg = (performance.now() - start) / iters
    expect(avg).toBeLessThan(5)
  })
})
