// tests/unit/connection-handler/header-injection.vitest.ts
import { describe, it, expect } from 'vitest'
import type { Request } from 'express'
import { buildTempConfig } from '../../../app/connectionHandler.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'
import type { AuthSession } from '../../../app/auth/auth-utils.js'
import { TEST_SSH } from '../../test-constants.js'

type TestReq = Request & { session?: AuthSession; sessionID?: string }

function makeReq(overrides: Partial<TestReq> = {}): TestReq {
  return {
    path: '/host/',
    protocol: 'https',
    get: ((key: string) => (key === 'host' ? TEST_SSH.HOST : undefined)) as unknown as Request['get'],
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
    sessionID: 'test-session-id',
    ...overrides
  } as TestReq
}

const defaultConfig = createDefaultConfig()

describe('buildTempConfig - tempConfig.header', () => {
  it('omits header when config defaults and no session override are set', () => {
    const req = makeReq()
    const result = buildTempConfig(req, defaultConfig)
    expect(result['header']).toBeUndefined()
  })

  it('sets header.text from config when present', () => {
    const req = makeReq()
    const cfg = {
      ...defaultConfig,
      header: { ...defaultConfig.header, text: 'Test header' }
    }
    const result = buildTempConfig(req, cfg)
    expect(result['header']).toMatchObject({ text: 'Test header' })
    expect(result['header']).not.toHaveProperty('background')
  })

  it('sets header.background from config when set to a non-default value', () => {
    const req = makeReq()
    const cfg = {
      ...defaultConfig,
      header: { ...defaultConfig.header, background: '#ff00aa' }
    }
    const result = buildTempConfig(req, cfg)
    expect(result['header']).toMatchObject({ background: '#ff00aa' })
  })

  it('session headerOverride.text wins over config.header.text', () => {
    const req = makeReq({
      session: {
        sshCredentials: { host: TEST_SSH.HOST, port: TEST_SSH.PORT, term: 'xterm' },
        usedBasicAuth: false,
        authMethod: 'password',
        headerOverride: { text: 'Text from session' }
      }
    })
    const cfg = {
      ...defaultConfig,
      header: { text: 'Text from config', background: '#ff00aa' }
    }
    const result = buildTempConfig(req, cfg)
    expect(result['header']).toMatchObject({
      text: 'Text from session',
      background: '#ff00aa'
    })
  })

  it('session headerOverride.background wins over config.header.background', () => {
    const req = makeReq({
      session: {
        sshCredentials: { host: TEST_SSH.HOST, port: TEST_SSH.PORT, term: 'xterm' },
        usedBasicAuth: false,
        authMethod: 'password',
        headerOverride: { background: '#125325' }
      }
    })
    const cfg = {
      ...defaultConfig,
      header: { text: 'Text from config', background: '#ff00aa' }
    }
    const result = buildTempConfig(req, cfg)
    expect(result['header']).toMatchObject({
      text: 'Text from config',
      background: '#125325'
    })
  })

  it('partial override merges field-wise: text from override, background from config', () => {
    const req = makeReq({
      session: {
        sshCredentials: { host: TEST_SSH.HOST, port: TEST_SSH.PORT, term: 'xterm' },
        usedBasicAuth: false,
        authMethod: 'password',
        headerOverride: { text: 'Text from session' }
      }
    })
    const cfg = {
      ...defaultConfig,
      header: { text: 'Text from config', background: '#ff00aa' }
    }
    const result = buildTempConfig(req, cfg)
    expect(result['header']).toMatchObject({
      text: 'Text from session',
      background: '#ff00aa'
    })
  })

  it('does not emit style field even when session.headerOverride.style is set', () => {
    // SECURITY: the GET path validates text and background but not style.
    // Forwarding style would re-introduce a Tailwind-class injection vector.
    const req = makeReq({
      session: {
        sshCredentials: { host: TEST_SSH.HOST, port: TEST_SSH.PORT, term: 'xterm' },
        usedBasicAuth: false,
        authMethod: 'password',
        headerOverride: {
          text: 'Test',
          background: 'green',
          style: 'bg-red-500 text-white'
        }
      }
    })
    const result = buildTempConfig(req, defaultConfig)
    expect(result['header']).toMatchObject({ text: 'Test', background: 'green' })
    expect(result['header']).not.toHaveProperty('style')
  })

  // Legacy regression: the original PR had a '#000' sentinel gate that
  // didn't match the actual default. After the gate fix, '#000' is no
  // longer special — it flows through as a configured value. This test
  // guards against accidental restoration of the broken sentinel.
  it('treats #000 as a normal configured background after the gate fix', () => {
    const req = makeReq()
    const cfg = {
      ...defaultConfig,
      header: { ...defaultConfig.header, background: '#000' }
    }
    const result = buildTempConfig(req, cfg)
    expect(result['header']).toMatchObject({ background: '#000' })
  })

  it('omits header when both text and background are null', () => {
    const req = makeReq()
    const cfg = {
      ...defaultConfig,
      header: { text: null, background: null }
    }
    const result = buildTempConfig(req, cfg)
    expect(result['header']).toBeUndefined()
  })
})
