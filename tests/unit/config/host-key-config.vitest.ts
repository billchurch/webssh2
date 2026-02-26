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
  it('should set serverStore=true, clientStore=false for mode "server"', () => {
    const config = buildHostKeyConfig({ mode: 'server' })
    const result = resolveHostKeyMode(config)

    expect(result.serverStore.enabled).toBe(true)
    expect(result.clientStore.enabled).toBe(false)
  })

  it('should set serverStore=false, clientStore=true for mode "client"', () => {
    const config = buildHostKeyConfig({ mode: 'client' })
    const result = resolveHostKeyMode(config)

    expect(result.serverStore.enabled).toBe(false)
    expect(result.clientStore.enabled).toBe(true)
  })

  it('should set both stores true for mode "hybrid"', () => {
    const config = buildHostKeyConfig({ mode: 'hybrid' })
    const result = resolveHostKeyMode(config)

    expect(result.serverStore.enabled).toBe(true)
    expect(result.clientStore.enabled).toBe(true)
  })

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
    const original = JSON.parse(JSON.stringify(config)) as typeof config
    resolveHostKeyMode(config)

    expect(config).toEqual(original)
  })
})
