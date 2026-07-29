// tests/config-transport-file.vitest.ts
// Issue #549: options.transport config.json normalization coverage.
// Exercises loadConfigAsync's config.json load path (normalizeFileConfigTransport
// in app/config.ts) — the env-var path is covered by
// tests/unit/config/env-mapper-transport.vitest.ts.

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import { loadConfigAsync, resetConfigForTesting } from '../app/config.js'
import { logTransportConfigWarning } from '../app/logger.js'
import { setupTestEnvironment, type ConfigFileManager } from './test-utils.js'
import type * as LoggerModule from '../app/logger.js'

// Partial mock so we can assert on logTransportConfigWarning; all other
// logger exports keep their real implementations.
vi.mock('../app/logger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof LoggerModule>()
  return {
    ...actual,
    logTransportConfigWarning: vi.fn()
  }
})

const requireConfigManager = (
  env: ReturnType<typeof setupTestEnvironment>
): ConfigFileManager => {
  if (env.configManager === undefined) {
    throw new Error('Expected config manager in test environment')
  }
  return env.configManager
}

describe('config.json options.transport normalization (#549)', () => {
  let testEnv: ReturnType<typeof setupTestEnvironment>

  beforeEach(() => {
    testEnv = setupTestEnvironment({ withConfigFile: true })
    resetConfigForTesting()
    vi.clearAllMocks()
  })

  afterEach(() => {
    testEnv.cleanup()
  })

  it('normalizes a string form to a single-entry array', async () => {
    const configManager = requireConfigManager(testEnv)
    configManager.writeConfig({ options: { transport: 'polling' } })

    const config = await loadConfigAsync()

    expect(config.options.transport).toEqual(['polling'])
    expect(logTransportConfigWarning).not.toHaveBeenCalled()
  })

  it('normalizes an array form, preserving order', async () => {
    const configManager = requireConfigManager(testEnv)
    configManager.writeConfig({ options: { transport: ['polling', 'websocket'] } })

    const config = await loadConfigAsync()

    expect(config.options.transport).toEqual(['polling', 'websocket'])
    expect(logTransportConfigWarning).not.toHaveBeenCalled()
  })

  it('drops an invalid value and warns with source config.json', async () => {
    const configManager = requireConfigManager(testEnv)
    configManager.writeConfig({ options: { transport: 'smtp,gopher' } })

    const config = await loadConfigAsync()

    expect(config.options.transport).toBeUndefined()
    expect(logTransportConfigWarning).toHaveBeenCalledTimes(1)
    expect(logTransportConfigWarning).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'config.json' })
    )
  })

  it('leaves options.transport undefined when absent from config.json', async () => {
    const configManager = requireConfigManager(testEnv)
    configManager.writeConfig({})

    const config = await loadConfigAsync()

    expect(config.options.transport).toBeUndefined()
    expect(logTransportConfigWarning).not.toHaveBeenCalled()
  })
})
