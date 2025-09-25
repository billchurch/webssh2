import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import initSockets from '../../app/socket.js'
import type { Config } from '../../app/types/config.js'
import type { SSHCtor } from '../../app/socket.js'
import { MOCK_CREDENTIALS, SSO_HEADERS, TEST_MINIMAL_SECRET } from '../test-constants.js'

const instances: MockSSH[] = []

class MockSSH {
  public lastShellEnv?: Record<string, string> | null
  constructor(public config: Config) {}
  async connect(): Promise<void> {
    // no-op - mock connection
  }
  shell(_opts: unknown, env: Record<string, string> | null): Promise<EventEmitter & { write: () => void; end: () => void }> {
    this.lastShellEnv = env
    const stream = new EventEmitter() as EventEmitter & { write: () => void; end: () => void }
    stream.write = (): void => {
      // no-op - mock stream write
    }
    stream.end = (): void => {
      // no-op - mock stream end
    }
    return Promise.resolve(stream)
  }
  exec(): Promise<EventEmitter> { throw new Error('not used') }
}

class FakeSocket extends EventEmitter {
  id = 's1'
  request: { session: unknown }
  constructor(session: unknown) {
    super()
    this.request = { session }
  }
  emit = vi.fn((..._args: unknown[]): boolean => true)
  disconnect = vi.fn()
}

void describe('socket env propagation', () => {
  it('passes filtered env to shell()', () => {
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
      session: { secret: TEST_MINIMAL_SECRET, name: 'n' },
      sso: { enabled: false, csrfProtection: false, trustedProxies: [], headerMapping: SSO_HEADERS },
    } as unknown as Config

    const session = {
      usedBasicAuth: true,
      sshCredentials: MOCK_CREDENTIALS.basic,
      envVars: { FOO: 'bar', 'bad-key': 'x' },
    }

    const fakeSocket = new FakeSocket(session)
    const io = { on: (_evt: string, cb: (socket: FakeSocket) => void): void => { cb(fakeSocket) } } as any
    const SSHClass = class extends MockSSH {
      constructor(cfg: Config) {
        super(cfg)
        instances.push(this)
      }
    } as unknown as SSHCtor

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
