// tests/unit/connection-handler/term-injection.vitest.ts
// buildTempConfig ssh.sshterm slice (billchurch/webssh2#572)

import { describe, it, expect } from 'vitest'
import { buildTempConfig } from '../../../app/connectionHandler.js'
import type { Config } from '../../../app/types/config.js'
import { TEST_SSH } from '../../test-constants.js'
import { makeReq, defaultConfig, type TestReq } from './injection-test-helpers.js'

const CONFIGURED_TERM = 'xterm-256color'
const SESSION_TERM = 'vt100'

function cfgWithTerm(term: string): Config {
  return { ...defaultConfig, ssh: { ...defaultConfig.ssh, term } }
}

function manualReq(): TestReq {
  const req = makeReq()
  req.session = undefined
  ;(req as { path: string }).path = '/'
  return req
}

function sessionReq(term: string | undefined): TestReq {
  const req = makeReq()
  req.session = {
    sshCredentials: { host: TEST_SSH.HOST, port: TEST_SSH.PORT, term },
    usedBasicAuth: false,
    authMethod: 'POST',
    headerOverride: undefined
  } as TestReq['session']
  return req
}

function sshFragment(tempConfig: Record<string, unknown>): Record<string, unknown> {
  return tempConfig['ssh'] as Record<string, unknown>
}

describe('buildTempConfig - ssh.sshterm slice (#572)', () => {
  it('injects only sshterm on a manual SSH load with no session', () => {
    const tempConfig = buildTempConfig(manualReq(), cfgWithTerm(CONFIGURED_TERM))
    expect(sshFragment(tempConfig)).toEqual({ sshterm: CONFIGURED_TERM })
    expect(tempConfig['autoConnect']).toBe(false)
  })

  it('omits the ssh key when config.ssh.term is empty', () => {
    const tempConfig = buildTempConfig(manualReq(), cfgWithTerm(''))
    expect('ssh' in tempConfig).toBe(false)
  })

  it('omits the ssh key on telnet routes', () => {
    const tempConfig = buildTempConfig(manualReq(), cfgWithTerm(CONFIGURED_TERM), {
      protocol: 'telnet'
    })
    expect('ssh' in tempConfig).toBe(false)
  })

  it('does not inject when the session lacks POST/basic-auth credentials', () => {
    // makeReq() default session uses authMethod 'password' – not a session-credential flow
    const tempConfig = buildTempConfig(makeReq(), cfgWithTerm(CONFIGURED_TERM))
    expect(sshFragment(tempConfig)).toEqual({ sshterm: CONFIGURED_TERM })
  })

  it('session term wins over the configured default', () => {
    const tempConfig = buildTempConfig(sessionReq(SESSION_TERM), cfgWithTerm(CONFIGURED_TERM))
    expect(sshFragment(tempConfig)).toEqual({
      host: TEST_SSH.HOST,
      port: TEST_SSH.PORT,
      sshterm: SESSION_TERM
    })
    expect(tempConfig['autoConnect']).toBe(true)
  })

  it('falls back to the configured default when the session has no term', () => {
    const tempConfig = buildTempConfig(sessionReq(undefined), cfgWithTerm(CONFIGURED_TERM))
    expect(sshFragment(tempConfig)).toEqual({
      host: TEST_SSH.HOST,
      port: TEST_SSH.PORT,
      sshterm: CONFIGURED_TERM
    })
  })

  it('omits sshterm entirely when neither session nor config provide one', () => {
    const tempConfig = buildTempConfig(sessionReq(undefined), cfgWithTerm(''))
    expect(sshFragment(tempConfig)).toEqual({ host: TEST_SSH.HOST, port: TEST_SSH.PORT })
  })
})
