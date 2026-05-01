import { describe, expect, it } from 'vitest'
import { loadEnhancedConfig } from '../../app/config.js'
import type { ConfigFileResolution } from '../../app/config/config-loader.js'

const noFileResolution: ConfigFileResolution = {
  location: 'currentWorkingDirectory',
  exists: false,
}

// Must be >= 32 chars to pass session secret strength validation
const TEST_SESSION_SECRET = 'test-secret-that-is-at-least-32-chars-long'

describe('startup with malformed theming env', () => {
  it('does not throw and yields empty additionalThemes on garbage', async () => {
    const result = await loadEnhancedConfig(noFileResolution, TEST_SESSION_SECRET, {
      WEBSSH2_THEMING_ENABLED: 'true',
      WEBSSH2_THEMING_ADDITIONAL_THEMES: 'GARBAGE!!!',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.options.theming?.additionalThemes).toEqual([])
    }
  })

  it('does not throw on bad base64 JSON', async () => {
    const b64 = Buffer.from('not json', 'utf8').toString('base64')
    const result = await loadEnhancedConfig(noFileResolution, TEST_SESSION_SECRET, {
      WEBSSH2_THEMING_ENABLED: 'true',
      WEBSSH2_THEMING_ADDITIONAL_THEMES: b64,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.options.theming?.additionalThemes).toEqual([])
    }
  })

  it('preserves theming.enabled=true even with garbage additional themes', async () => {
    const result = await loadEnhancedConfig(noFileResolution, TEST_SESSION_SECRET, {
      WEBSSH2_THEMING_ENABLED: 'true',
      WEBSSH2_THEMING_ADDITIONAL_THEMES: 'GARBAGE!!!',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.options.theming?.enabled).toBe(true)
    }
  })
})
