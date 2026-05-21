// tests/unit/connection-handler/header-injection.vitest.ts
import { describe, it, expect } from 'vitest'
import type { Request } from 'express'
import { buildTempConfig } from '../../../app/connectionHandler.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'
import type { AuthSession } from '../../../app/auth/auth-utils.js'
import type { HeaderOverride } from '../../../app/auth/header-processor.js'
import type { Config } from '../../../app/types/config.js'
import { TEST_SSH } from '../../test-constants.js'

type TestReq = Request & { session?: AuthSession; sessionID?: string }

const baseSshCredentials = {
  host: TEST_SSH.HOST,
  port: TEST_SSH.PORT,
  term: 'xterm'
}

function makeReq(overrides: Partial<TestReq> = {}): TestReq {
  return {
    path: '/host/',
    protocol: 'https',
    get: ((key: string) => (key === 'host' ? TEST_SSH.HOST : undefined)) as unknown as Request['get'],
    session: {
      sshCredentials: baseSshCredentials,
      usedBasicAuth: false,
      authMethod: 'password',
      headerOverride: undefined
    },
    sessionID: 'test-session-id',
    ...overrides
  } as TestReq
}

function reqWithOverride(headerOverride: HeaderOverride): TestReq {
  return makeReq({
    session: {
      sshCredentials: baseSshCredentials,
      usedBasicAuth: false,
      authMethod: 'password',
      headerOverride
    }
  })
}

const defaultConfig = createDefaultConfig()

function cfgWithHeader(text: string | null, background: string | null): Config {
  return {
    ...defaultConfig,
    header: { text, background }
  }
}

describe('buildTempConfig - tempConfig.header', () => {
  it('omits header when config defaults and no session override are set', () => {
    const result = buildTempConfig(makeReq(), defaultConfig)
    expect(result['header']).toBeUndefined()
  })

  it('sets header.text from config when present', () => {
    const result = buildTempConfig(makeReq(), cfgWithHeader('Test header', null))
    expect(result['header']).toMatchObject({ text: 'Test header' })
    expect(result['header']).not.toHaveProperty('background')
  })

  it('sets header.background from config when set to a non-default value', () => {
    const result = buildTempConfig(makeReq(), cfgWithHeader(null, '#ff00aa'))
    expect(result['header']).toMatchObject({ background: '#ff00aa' })
  })

  it('session headerOverride.text wins over config.header.text', () => {
    const req = reqWithOverride({ text: 'Text from session' })
    const cfg = cfgWithHeader('Text from config', '#ff00aa')
    const result = buildTempConfig(req, cfg)
    expect(result['header']).toMatchObject({
      text: 'Text from session',
      background: '#ff00aa'
    })
  })

  it('session headerOverride.background wins over config.header.background', () => {
    const req = reqWithOverride({ background: '#125325' })
    const cfg = cfgWithHeader('Text from config', '#ff00aa')
    const result = buildTempConfig(req, cfg)
    expect(result['header']).toMatchObject({
      text: 'Text from config',
      background: '#125325'
    })
  })

  it('partial override merges field-wise: text from override, background from config', () => {
    const req = reqWithOverride({ text: 'Text from session' })
    const cfg = cfgWithHeader('Text from config', '#ff00aa')
    const result = buildTempConfig(req, cfg)
    expect(result['header']).toMatchObject({
      text: 'Text from session',
      background: '#ff00aa'
    })
  })

  it('does not emit style field even when session.headerOverride.style is set', () => {
    // SECURITY: the GET path validates text and background but not style.
    // Forwarding style would re-introduce a Tailwind-class injection vector.
    const req = reqWithOverride({
      text: 'Test',
      background: 'green',
      style: 'bg-red-500 text-white'
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
    const result = buildTempConfig(makeReq(), cfgWithHeader(null, '#000'))
    expect(result['header']).toMatchObject({ background: '#000' })
  })

  it('omits header when both text and background are null', () => {
    const result = buildTempConfig(makeReq(), cfgWithHeader(null, null))
    expect(result['header']).toBeUndefined()
  })
})
