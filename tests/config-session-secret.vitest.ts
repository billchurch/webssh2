// tests/config-session-secret.vitest.ts
// Issue #535: WEBSSH2_SESSION_SECRET fallback, legacy alias deprecation,
// and generated-secret startup warning.

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import fs from 'node:fs'
import { loadConfigAsync, loadEnhancedConfig, resetConfigForTesting } from '../app/config.js'
import {
  logDeprecatedEnvVarWarning,
  logGeneratedSessionSecretWarning
} from '../app/logger.js'
import { setupTestEnvironment, type ConfigFileManager } from './test-utils.js'
import { MY_SESSION_SECRET, TEST_SESSION_SECRET } from './test-constants.js'
import type { ConfigFileResolution } from '../app/config/config-loader.js'
import type * as LoggerModule from '../app/logger.js'

vi.mock('../app/logger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof LoggerModule>()
  return {
    ...actual,
    logDeprecatedEnvVarWarning: vi.fn(),
    logGeneratedSessionSecretWarning: vi.fn()
  }
})

const CANONICAL_ENV = 'WEBSSH2_SESSION_SECRET'
const LEGACY_ENV = 'WEBSSH_SESSION_SECRET'
const MIN_SECRET_LENGTH = 32

const requireConfigManager = (
  env: ReturnType<typeof setupTestEnvironment>
): ConfigFileManager => {
  if (env.configManager === undefined) {
    throw new Error('Expected config manager in test environment')
  }
  return env.configManager
}

const removeConfigFile = (configManager: ConfigFileManager): void => {
  if (configManager.configExists()) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.unlinkSync(configManager.configPath)
  }
}

describe('session secret configuration (issue #535)', () => {
  let testEnv: ReturnType<typeof setupTestEnvironment>
  let originalCanonical: string | undefined
  let originalLegacy: string | undefined

  beforeEach(() => {
    // setupTestEnvironment saves/clears WEBSSH2_* vars, but the legacy
    // WEBSSH_SESSION_SECRET name is outside that prefix — handle both
    // explicitly to avoid cross-test pollution.
    originalCanonical = process.env['WEBSSH2_SESSION_SECRET']
    originalLegacy = process.env['WEBSSH_SESSION_SECRET']
    testEnv = setupTestEnvironment({ withConfigFile: true })
    delete process.env['WEBSSH2_SESSION_SECRET']
    delete process.env['WEBSSH_SESSION_SECRET']
    resetConfigForTesting()
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env['WEBSSH2_SESSION_SECRET']
    delete process.env['WEBSSH_SESSION_SECRET']
    testEnv.cleanup()
    if (originalCanonical === undefined) {
      delete process.env['WEBSSH2_SESSION_SECRET']
    } else {
      process.env['WEBSSH2_SESSION_SECRET'] = originalCanonical
    }
    if (originalLegacy === undefined) {
      delete process.env['WEBSSH_SESSION_SECRET']
    } else {
      process.env['WEBSSH_SESSION_SECRET'] = originalLegacy
    }
  })

  describe('loadConfigAsync', () => {
    it('uses WEBSSH2_SESSION_SECRET for session.secret', async () => {
      removeConfigFile(requireConfigManager(testEnv))
      process.env['WEBSSH2_SESSION_SECRET'] = TEST_SESSION_SECRET

      const config = await loadConfigAsync()

      expect(config.session.secret).toBe(TEST_SESSION_SECRET)
      expect(logDeprecatedEnvVarWarning).not.toHaveBeenCalled()
      expect(logGeneratedSessionSecretWarning).not.toHaveBeenCalled()
    })

    it('honors legacy WEBSSH_SESSION_SECRET and emits a deprecation warning', async () => {
      removeConfigFile(requireConfigManager(testEnv))
      process.env['WEBSSH_SESSION_SECRET'] = TEST_SESSION_SECRET

      const config = await loadConfigAsync()

      expect(config.session.secret).toBe(TEST_SESSION_SECRET)
      expect(logDeprecatedEnvVarWarning).toHaveBeenCalledTimes(1)
      expect(logDeprecatedEnvVarWarning).toHaveBeenCalledWith(LEGACY_ENV, CANONICAL_ENV)
      expect(logGeneratedSessionSecretWarning).not.toHaveBeenCalled()
    })

    it('prefers WEBSSH2_SESSION_SECRET when both env vars are set', async () => {
      removeConfigFile(requireConfigManager(testEnv))
      process.env['WEBSSH2_SESSION_SECRET'] = TEST_SESSION_SECRET
      process.env['WEBSSH_SESSION_SECRET'] = MY_SESSION_SECRET

      const config = await loadConfigAsync()

      expect(config.session.secret).toBe(TEST_SESSION_SECRET)
      expect(logDeprecatedEnvVarWarning).not.toHaveBeenCalled()
      expect(logGeneratedSessionSecretWarning).not.toHaveBeenCalled()
    })

    it('generates a random secret and warns when no secret is configured', async () => {
      removeConfigFile(requireConfigManager(testEnv))

      const config = await loadConfigAsync()

      expect(typeof config.session.secret).toBe('string')
      expect(config.session.secret.length).toBeGreaterThanOrEqual(MIN_SECRET_LENGTH)
      expect(logGeneratedSessionSecretWarning).toHaveBeenCalledTimes(1)
      expect(logDeprecatedEnvVarWarning).not.toHaveBeenCalled()
    })

    it('does not warn when the secret comes from config.json', async () => {
      const configManager = requireConfigManager(testEnv)
      configManager.writeConfig({ session: { secret: MY_SESSION_SECRET } })

      const config = await loadConfigAsync()

      expect(config.session.secret).toBe(MY_SESSION_SECRET)
      expect(logGeneratedSessionSecretWarning).not.toHaveBeenCalled()
      expect(logDeprecatedEnvVarWarning).not.toHaveBeenCalled()
    })
  })

  describe('loadEnhancedConfig onGeneratedSecret hook', () => {
    const noFileResolution: ConfigFileResolution = {
      location: 'currentWorkingDirectory',
      exists: false
    }

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
  })
})
