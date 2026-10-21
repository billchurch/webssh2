// tests/unit/socket/ssh-config-env-allowlist.vitest.ts
// buildTerminalDefaults enforces ssh.envAllowlist (billchurch/webssh2#586)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseEnvVars } from '../../../app/validation/index.js'
import {
  createAdapterSharedState,
  type AdapterContext
} from '../../../app/socket/adapters/service-socket-shared.js'
import type * as LoggerModule from '../../../app/logger.js'

const debugSpy = vi.hoisted(() => vi.fn())

vi.mock('../../../app/logger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof LoggerModule>()
  return {
    ...actual,
    createNamespacedDebug: () => debugSpy
  }
})

const { buildTerminalDefaults } = await import('../../../app/socket/adapters/ssh-config.js')

// Same shape as `?env=LANG:C,FOO:bar` stored on the session by the GET routes
const URL_ENV = 'LANG:C,FOO:bar'

function makeContext(
  envVars: Record<string, string> | undefined,
  envAllowlist?: string[]
): AdapterContext {
  const ssh: Record<string, unknown> = { term: '' }
  if (envAllowlist !== undefined) {
    ssh['envAllowlist'] = envAllowlist
  }
  return {
    socket: { request: { session: { envVars } } } as unknown as AdapterContext['socket'],
    config: { ssh } as unknown as AdapterContext['config'],
    state: createAdapterSharedState()
  } as unknown as AdapterContext
}

function sessionEnv(): Record<string, string> {
  const parsed = parseEnvVars(URL_ENV)
  expect(parsed).not.toBeNull()
  return parsed as Record<string, string>
}

describe('buildTerminalDefaults - ssh.envAllowlist (#586)', () => {
  beforeEach(() => {
    debugSpy.mockClear()
  })

  it('sends only allowlisted keys when the allowlist is set', () => {
    const result = buildTerminalDefaults(undefined, makeContext(sessionEnv(), ['LANG']))
    expect(result.env).toEqual({ LANG: 'C' })
  })

  it('logs dropped key names but not their values', () => {
    buildTerminalDefaults(undefined, makeContext(sessionEnv(), ['LANG']))

    const call = debugSpy.mock.calls.find(
      ([message]) => message === 'Dropped env vars filtered by ssh.envAllowlist'
    )
    expect(call).toBeDefined()
    expect(call?.[1]).toEqual({ keys: ['FOO'] })
    expect(JSON.stringify(debugSpy.mock.calls)).not.toContain('bar')
  })

  it('sends every key unchanged when the allowlist is unset', () => {
    const env = sessionEnv()
    const result = buildTerminalDefaults(undefined, makeContext(env))
    expect(result.env).toEqual({ LANG: 'C', FOO: 'bar' })
    expect(result.env).toBe(env)
  })

  it('sends nothing when the allowlist is empty', () => {
    const result = buildTerminalDefaults(undefined, makeContext(sessionEnv(), []))
    expect(result.env).toEqual({})
  })

  it('returns an empty env when the session has none', () => {
    const result = buildTerminalDefaults(undefined, makeContext(undefined, ['LANG']))
    expect(result.env).toEqual({})
    expect(debugSpy).not.toHaveBeenCalledWith(
      'Dropped env vars filtered by ssh.envAllowlist',
      expect.anything()
    )
  })
})
