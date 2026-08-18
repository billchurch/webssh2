// tests/unit/socket/ssh-config-terminal-defaults.vitest.ts
// buildTerminalDefaults term fallback chain (billchurch/webssh2#572)

import { describe, it, expect } from 'vitest'
import { buildTerminalDefaults } from '../../../app/socket/adapters/ssh-config.js'
import {
  createAdapterSharedState,
  type AdapterContext
} from '../../../app/socket/adapters/service-socket-shared.js'
import { TERMINAL_DEFAULTS } from '../../../app/constants/terminal.js'

const CONFIG_TERM = 'linux'
const CLIENT_TERM = 'vt220'
const INITIAL_TERM = 'screen'

function makeContext(configTerm: string, initialTerm?: string): AdapterContext {
  const state = createAdapterSharedState()
  if (initialTerm !== undefined) {
    state.initialTermSettings.term = initialTerm
  }
  return {
    socket: { request: {} } as unknown as AdapterContext['socket'],
    config: { ssh: { term: configTerm } } as unknown as AdapterContext['config'],
    state
  } as unknown as AdapterContext
}

describe('buildTerminalDefaults - term fallback (#572)', () => {
  it('prefers the client-supplied term', () => {
    const result = buildTerminalDefaults({ term: CLIENT_TERM }, makeContext(CONFIG_TERM, INITIAL_TERM))
    expect(result.term).toBe(CLIENT_TERM)
  })

  it('falls back to initial (session) term settings', () => {
    const result = buildTerminalDefaults(undefined, makeContext(CONFIG_TERM, INITIAL_TERM))
    expect(result.term).toBe(INITIAL_TERM)
  })

  it('falls back to config.ssh.term when client and session are silent', () => {
    const result = buildTerminalDefaults(undefined, makeContext(CONFIG_TERM))
    expect(result.term).toBe(CONFIG_TERM)
  })

  it('falls back to the hard default when config.ssh.term is empty', () => {
    const result = buildTerminalDefaults(undefined, makeContext(''))
    expect(result.term).toBe(TERMINAL_DEFAULTS.DEFAULT_TERM)
  })
})
