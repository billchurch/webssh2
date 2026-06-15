// tests/unit/connection-handler/transport-selection.vitest.ts
import { describe, it, expect } from 'vitest'
import type { Request } from 'express'
import { buildTempConfig } from '../../../app/connectionHandler.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'
import type { Config } from '../../../app/types/config.js'
import { TEST_SSH } from '../../test-constants.js'

type TestReq = Request & { sessionID?: string }

function makeReq(query: Record<string, unknown> = {}): TestReq {
  return {
    path: '/ssh/host/',
    protocol: 'https',
    get: ((key: string) => (key === 'host' ? TEST_SSH.HOST : undefined)) as unknown as Request['get'],
    query,
    sessionID: 'test-session-id'
  } as TestReq
}

const defaultConfig = createDefaultConfig()

function cfgWithTransport(transport: Config['options']['transport']): Config {
  return {
    ...defaultConfig,
    options: { ...defaultConfig.options, transport }
  }
}

function socketOf(result: Partial<Config>): Record<string, unknown> {
  return result['socket'] as Record<string, unknown>
}

describe('buildTempConfig - socket.transports', () => {
  it('omits transports when neither URL parameter nor config is set', () => {
    const result = buildTempConfig(makeReq(), defaultConfig)
    expect(socketOf(result)['transports']).toBeUndefined()
  })

  it('maps the server-wide options.transport config to a transports list', () => {
    const result = buildTempConfig(makeReq(), cfgWithTransport('polling'))
    expect(socketOf(result)['transports']).toEqual(['polling'])
  })

  it('maps "both" to poll-first-then-upgrade order', () => {
    const result = buildTempConfig(makeReq(), cfgWithTransport('both'))
    expect(socketOf(result)['transports']).toEqual(['polling', 'websocket'])
  })

  it('maps "websocket" to websocket only', () => {
    const result = buildTempConfig(makeReq(), cfgWithTransport('websocket'))
    expect(socketOf(result)['transports']).toEqual(['websocket'])
  })

  it('lets the ?transport= URL parameter override the server config', () => {
    const result = buildTempConfig(makeReq({ transport: 'websocket' }), cfgWithTransport('polling'))
    expect(socketOf(result)['transports']).toEqual(['websocket'])
  })

  it('accepts the URL parameter case-insensitively', () => {
    const result = buildTempConfig(makeReq({ transport: 'POLLING' }), defaultConfig)
    expect(socketOf(result)['transports']).toEqual(['polling'])
  })

  it('uses the first value when the URL parameter is repeated', () => {
    const result = buildTempConfig(makeReq({ transport: ['polling', 'websocket'] }), defaultConfig)
    expect(socketOf(result)['transports']).toEqual(['polling'])
  })

  it('falls back to the server config when the URL parameter is unrecognized', () => {
    const result = buildTempConfig(makeReq({ transport: 'nonsense' }), cfgWithTransport('polling'))
    expect(socketOf(result)['transports']).toEqual(['polling'])
  })

  it('omits transports when the URL parameter is unrecognized and no config is set', () => {
    const result = buildTempConfig(makeReq({ transport: 'nonsense' }), defaultConfig)
    expect(socketOf(result)['transports']).toBeUndefined()
  })
})
