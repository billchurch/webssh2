// tests/unit/connection-handler/transport-injection.vitest.ts
// buildTempConfig socket.transports slice (billchurch/webssh2#549)

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

function cfgWithTransport(transport?: string[]): Config {
  return {
    ...defaultConfig,
    options: {
      ...defaultConfig.options,
      ...(transport === undefined ? {} : { transport })
    }
  }
}

function socketFragment(tempConfig: Partial<Config>): Record<string, unknown> {
  return tempConfig['socket'] as Record<string, unknown>
}

describe('buildTempConfig - socket.transports slice', () => {
  it('omits transports when options.transport is unset', () => {
    const result = buildTempConfig(makeReq(), cfgWithTransport())
    expect('transports' in socketFragment(result)).toBe(false)
  })

  it('injects transports when a non-empty list is configured', () => {
    const result = buildTempConfig(makeReq(), cfgWithTransport(['polling']))
    expect(socketFragment(result)['transports']).toEqual(['polling'])
  })

  it('never injects an empty array', () => {
    const result = buildTempConfig(makeReq(), cfgWithTransport([]))
    expect('transports' in socketFragment(result)).toBe(false)
  })
})
