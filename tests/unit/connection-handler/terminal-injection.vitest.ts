// tests/unit/connection-handler/terminal-injection.vitest.ts
// buildTempConfig terminal slice (billchurch/webssh2#497)

import { describe, it, expect } from 'vitest'
import type { Request } from 'express'
import { buildTempConfig } from '../../../app/connectionHandler.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'
import type { AuthSession } from '../../../app/auth/auth-utils.js'
import type { Config } from '../../../app/types/config.js'
import { TEST_SSH } from '../../test-constants.js'

type TestReq = Request & { session?: AuthSession; sessionID?: string }

function makeReq(): TestReq {
  return {
    path: '/host/',
    protocol: 'https',
    get: ((key: string) =>
      key === 'host' ? TEST_SSH.HOST : undefined) as unknown as Request['get'],
    session: {
      sshCredentials: {
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT,
        term: 'xterm'
      },
      usedBasicAuth: false,
      authMethod: 'password',
      headerOverride: undefined
    },
    sessionID: 'test-session-id'
  } as TestReq
}

const defaultConfig = createDefaultConfig()

function cfgWithShiftEnter(enabled: boolean): Config {
  return {
    ...defaultConfig,
    options: {
      ...defaultConfig.options,
      terminal: { shiftEnterNewline: enabled }
    }
  }
}

describe('buildTempConfig - terminal slice', () => {
  it('injects terminal.shiftEnterNewline when enabled', () => {
    const tempConfig = buildTempConfig(makeReq(), cfgWithShiftEnter(true))
    expect(tempConfig['terminal']).toEqual({ shiftEnterNewline: true })
  })

  it('omits the terminal key entirely when disabled', () => {
    const tempConfig = buildTempConfig(makeReq(), cfgWithShiftEnter(false))
    expect('terminal' in tempConfig).toBe(false)
  })

  it('omits the terminal key when options.terminal is absent', () => {
    const { terminal: _terminal, ...optionsWithout } = defaultConfig.options
    const cfg = { ...defaultConfig, options: optionsWithout } as Config
    const tempConfig = buildTempConfig(makeReq(), cfg)
    expect('terminal' in tempConfig).toBe(false)
  })
})
