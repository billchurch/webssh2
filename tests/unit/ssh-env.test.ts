import { describe, it, expect } from 'vitest'
import SSHConnection from '../../app/ssh.js'
import type { Config } from '../../app/types/config.js'

// Type assertion for accessing private methods in tests
interface SSHConnectionTestable extends SSHConnection {
  getEnvironment(env: Record<string, unknown>): Record<string, string>
}

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
    // Type assertion needed to access private method for testing
    const ssh = new (SSHConnection as unknown as new (config: Config) => SSHConnectionTestable)(baseConfig)
    const env = ssh.getEnvironment({ FOO: 'bar', BAR: 123 })
    expect(env).toEqual({ TERM: 'xterm-256color', FOO: 'bar', BAR: '123' })
  })

  it('filters invalid keys and values', () => {
    // Type assertion needed to access private method for testing
    const ssh = new (SSHConnection as unknown as new (config: Config) => SSHConnectionTestable)(baseConfig)
    const env = ssh.getEnvironment({ 'bad-key': '1', OK: '2', BAZ: 'x;rm -rf /' })
    expect(env).toEqual({ TERM: 'xterm-256color', OK: '2' })
  })

  it('respects allowlist', () => {
    const cfg = globalThis.structuredClone(baseConfig)
    const cfgWithAllowlist = cfg as Config & { ssh: { envAllowlist: string[] } }
    cfgWithAllowlist.ssh.envAllowlist = ['ONLY']
    // Type assertion needed to access private method for testing
    const ssh = new (SSHConnection as unknown as new (config: Config) => SSHConnectionTestable)(cfgWithAllowlist)
    const env = ssh.getEnvironment({ ONLY: 'v', OK: 'ignored' })
    expect(env).toEqual({ TERM: 'xterm-256color', ONLY: 'v' })
  })
})

