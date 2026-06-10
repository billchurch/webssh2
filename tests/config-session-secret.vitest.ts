// tests/config-session-secret.vitest.ts
// Issue #535: generated-session-secret detection hook on loadEnhancedConfig.
// Pure tests only (no process.env or config.json usage) — the loadConfigAsync
// integration tests live in tests/config-async.vitest.ts, which owns the
// shared root config.json fixture.

import { describe, it, expect, vi } from 'vitest'
import { loadEnhancedConfig } from '../app/config.js'
import { TEST_SESSION_SECRET } from './test-constants.js'
import type { ConfigFileResolution } from '../app/config/config-loader.js'

const MIN_SECRET_LENGTH = 32

const noFileResolution: ConfigFileResolution = {
  location: 'currentWorkingDirectory',
  exists: false
}

describe('loadEnhancedConfig onGeneratedSecret hook (issue #535)', () => {
  it('invokes the hook when no secret comes from param, env, or file', async () => {
    const onGeneratedSecret = vi.fn()

    const result = await loadEnhancedConfig(noFileResolution, undefined, {}, onGeneratedSecret)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.session.secret.length).toBeGreaterThanOrEqual(MIN_SECRET_LENGTH)
    }
    expect(onGeneratedSecret).toHaveBeenCalledTimes(1)
  })

  it('does not invoke the hook when an explicit sessionSecret is provided', async () => {
    const onGeneratedSecret = vi.fn()

    const result = await loadEnhancedConfig(
      noFileResolution,
      TEST_SESSION_SECRET,
      {},
      onGeneratedSecret
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.session.secret).toBe(TEST_SESSION_SECRET)
    }
    expect(onGeneratedSecret).not.toHaveBeenCalled()
  })

  it('does not invoke the hook when the env provides WEBSSH2_SESSION_SECRET', async () => {
    const onGeneratedSecret = vi.fn()

    const result = await loadEnhancedConfig(
      noFileResolution,
      undefined,
      { WEBSSH2_SESSION_SECRET: TEST_SESSION_SECRET },
      onGeneratedSecret
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.session.secret).toBe(TEST_SESSION_SECRET)
    }
    expect(onGeneratedSecret).not.toHaveBeenCalled()
  })

  it('treats an empty explicit sessionSecret as unset and invokes the hook', async () => {
    const onGeneratedSecret = vi.fn()

    const result = await loadEnhancedConfig(noFileResolution, '', {}, onGeneratedSecret)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.session.secret.length).toBeGreaterThanOrEqual(MIN_SECRET_LENGTH)
    }
    expect(onGeneratedSecret).toHaveBeenCalledTimes(1)
  })

  it('treats an empty env WEBSSH2_SESSION_SECRET as unset and invokes the hook', async () => {
    const onGeneratedSecret = vi.fn()

    const result = await loadEnhancedConfig(
      noFileResolution,
      undefined,
      { WEBSSH2_SESSION_SECRET: '' },
      onGeneratedSecret
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.session.secret.length).toBeGreaterThanOrEqual(MIN_SECRET_LENGTH)
    }
    expect(onGeneratedSecret).toHaveBeenCalledTimes(1)
  })
})
