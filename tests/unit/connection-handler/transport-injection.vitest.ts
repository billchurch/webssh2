// tests/unit/connection-handler/transport-injection.vitest.ts
// buildTempConfig socket.transports slice (billchurch/webssh2#549)

import { describe, it, expect } from 'vitest'
import { buildTempConfig } from '../../../app/connectionHandler.js'
import type { Config } from '../../../app/types/config.js'
import { makeReq, defaultConfig } from './injection-test-helpers.js'

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
