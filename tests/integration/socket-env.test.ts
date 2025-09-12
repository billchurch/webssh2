import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'events'
import initSockets from '../../app/socket'
import type { Config } from '../../app/types/config'

const instances: MockSSH[] = []

class MockSSH {
  public lastShellEnv?: Record<string, string> | null
  constructor(public config: Config) {}
  async connect() {}
  async shell(_opts: any, env: Record<string, string> | null) {
    this.lastShellEnv = env
    const stream = new EventEmitter() as any
    stream.write = () => {}
    stream.end = () => {}
    return stream
  }
  async exec() { throw new Error('not used') }
}

class FakeSocket extends EventEmitter {
  id = 's1'
  request: any
  constructor(session: any) {
    super()
    this.request = { session }
  }
  emit = vi.fn((..._args: any[]) => true)
  disconnect = vi.fn()
}

describe('socket env propagation', () => {
  it('passes filtered env to shell()', async () => {
    const config = {
      ssh: {
        term: 'xterm',
        host: 'h',
        port: 22,
        readyTimeout: 1,
        keepaliveInterval: 1,
        keepaliveCountMax: 1,
        alwaysSendKeyboardInteractivePrompts: false,
        disableInteractiveAuth: false,
        algorithms: { cipher: [], compress: [], hmac: [], kex: [], serverHostKey: [] },
      },
      options: { allowReplay: true, allowReconnect: true, allowReauth: true, autoLog: false },
      user: { name: null, password: null, privateKey: null, passphrase: null },
      header: { text: null, background: 'green' },
      listen: { ip: '0.0.0.0', port: 2222 },
      http: { origins: ['*:*'] },
      session: { secret: 's', name: 'n' },
      sso: { enabled: false, csrfProtection: false, trustedProxies: [], headerMapping: { username: 'x-apm-username', password: 'x-apm-password', session: 'x-apm-session' } },
    } as unknown as Config

    const session = {
      usedBasicAuth: true,
      sshCredentials: { host: 'h', port: 22, username: 'u', password: 'p' },
      envVars: { FOO: 'bar', 'bad-key': 'x' },
    }

    const fakeSocket = new FakeSocket(session)
    const io = { on: (_evt: string, cb: any) => cb(fakeSocket) } as any
    const SSHClass = function(this: any, cfg: Config) {
      const inst = new MockSSH(cfg)
      instances.push(inst)
      return inst
    } as any

    initSockets(io, config, SSHClass)

    // Trigger terminal event to start shell (dimensions only, term managed by server)
    fakeSocket.emit('terminal', { cols: 80, rows: 24 })

    // We expect TERM + FOO only (bad-key filtered)
    const env = instances[0]?.lastShellEnv
    expect(env).toBeTruthy()
    expect(env?.FOO).toBe('bar')
    expect(env).not.toHaveProperty('bad-key')
  })
})
