import { describe, it, expect } from 'vitest'
import SSHConnection from '../../app/ssh'
import type { Config } from '../../app/types/config.ts'

const baseConfig = {
  ssh: {
    term: 'xterm-256color',
    algorithms: { cipher: [], compress: [], hmac: [], kex: [], serverHostKey: [] },
    readyTimeout: 1,
    keepaliveInterval: 1,
    keepaliveCountMax: 1,
    alwaysSendKeyboardInteractivePrompts: false,
    disableInteractiveAuth: false,
  },
} as unknown as Config

void describe('SSH getEnvironment (filtered)', () => {
  it('includes TERM and merges valid env', () => {
    const ssh = new SSHConnection(baseConfig)
    const env = (ssh as any).getEnvironment({ FOO: 'bar', BAR: 123 }) as Record<string, string>
    expect(env).toEqual({ TERM: 'xterm-256color', FOO: 'bar', BAR: '123' })
  })

  it('filters invalid keys and values', () => {
    const ssh = new SSHConnection(baseConfig)
    const env = (ssh as any).getEnvironment({ 'bad-key': '1', OK: '2', BAZ: 'x;rm -rf /' })
    expect(env).toEqual({ TERM: 'xterm-256color', OK: '2' })
  })

  it('respects allowlist', () => {
    const cfg = structuredClone(baseConfig)
    ;(cfg as any).ssh.envAllowlist = ['ONLY']
    const ssh = new SSHConnection(cfg)
    const env = (ssh as any).getEnvironment({ ONLY: 'v', OK: 'ignored' })
    expect(env).toEqual({ TERM: 'xterm-256color', ONLY: 'v' })
  })
})

