// tests/unit/config/host-key-config.vitest.ts
// Tests for host key verification mode expansion

import { describe, it, expect } from 'vitest'
import { resolveHostKeyMode } from '../../../app/config/config-processor.js'
import type { HostKeyVerificationConfig } from '../../../app/types/config.js'

/**
 * Build a HostKeyVerificationConfig with overrides
 */
function buildHostKeyConfig(
  overrides?: Partial<HostKeyVerificationConfig>
): HostKeyVerificationConfig {
  return {
    enabled: false,
    mode: 'hybrid',
    unknownKeyAction: 'prompt',
    serverStore: {
      enabled: true,
      dbPath: '/data/hostkeys.db',
    },
    clientStore: {
      enabled: true,
    },
    ...overrides,
  }
}

describe('resolveHostKeyMode', () => {
  it.each([
    { mode: 'server', expectedServer: true, expectedClient: false },
    { mode: 'client', expectedServer: false, expectedClient: true },
    { mode: 'hybrid', expectedServer: true, expectedClient: true }
  ] as const)(
    'should set serverStore=$expectedServer, clientStore=$expectedClient for mode $mode',
    ({ mode, expectedServer, expectedClient }) => {
      const config = buildHostKeyConfig({ mode })
      const result = resolveHostKeyMode(config)

      expect(result.serverStore.enabled).toBe(expectedServer)
      expect(result.clientStore.enabled).toBe(expectedClient)
    }
  )

  it('should allow explicit flags to override mode defaults', () => {
    // mode=server normally sets clientStore=false, but explicit flag overrides
    const config = buildHostKeyConfig({
      mode: 'server',
      clientStore: { enabled: true },
    })
    const result = resolveHostKeyMode(config, {
      clientStoreExplicit: true,
    })

    expect(result.serverStore.enabled).toBe(true)
    expect(result.clientStore.enabled).toBe(true)
  })

  it('should allow explicit serverStore=false to override mode=hybrid', () => {
    const config = buildHostKeyConfig({
      mode: 'hybrid',
      serverStore: { enabled: false, dbPath: '/data/hostkeys.db' },
    })
    const result = resolveHostKeyMode(config, {
      serverStoreExplicit: true,
    })

    expect(result.serverStore.enabled).toBe(false)
    expect(result.clientStore.enabled).toBe(true)
  })

  it('should default to enabled=false', () => {
    const config = buildHostKeyConfig()
    const result = resolveHostKeyMode(config)

    expect(result.enabled).toBe(false)
  })

  it('should preserve enabled=true when set', () => {
    const config = buildHostKeyConfig({ enabled: true })
    const result = resolveHostKeyMode(config)

    expect(result.enabled).toBe(true)
  })

  it('should preserve unknownKeyAction', () => {
    const config = buildHostKeyConfig({ unknownKeyAction: 'reject' })
    const result = resolveHostKeyMode(config)

    expect(result.unknownKeyAction).toBe('reject')
  })

  it('should preserve dbPath from input', () => {
    const config = buildHostKeyConfig({
      serverStore: { enabled: true, dbPath: '/custom/path.db' },
    })
    const result = resolveHostKeyMode(config)

    expect(result.serverStore.dbPath).toBe('/custom/path.db')
  })

  it('should not mutate the input config', () => {
    const config = buildHostKeyConfig({ mode: 'server' })
    const original = structuredClone(config)
    resolveHostKeyMode(config)

    expect(config).toEqual(original)
  })
})
