import { describe, beforeEach, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type { Socket } from 'socket.io'
import { SOCKET_EVENTS, VALIDATION_MESSAGES } from '../../../app/constants/index.js'
import { createInitialSessionState } from '../../../app/socket/handlers/auth-handler.js'
import type { SessionState } from '../../../app/socket/handlers/auth-handler.js'
import type { Config } from '../../../app/types/config.js'
import { createStructuredLoggerStub, type StructuredLoggerStub } from '../../test-utils.js'
import { TEST_PASSWORDS, TEST_SECRET, TEST_USER_AGENTS } from '../../test-constants.js'

interface ControlHandlerModule {
  handleReplayCredentials: (
    socket: Socket,
    config: Config,
    sessionState: SessionState,
    shellStream: (EventEmitter & { write?: (data: string) => void }) | null
  ) => void
}

let moduleUnderTest: ControlHandlerModule
let loggerStub: StructuredLoggerStub

function createTestConfig(options: Partial<Config['options']> = {}): Config {
  return {
    listen: { ip: '0.0.0.0', port: 8080 },
    http: { origins: [] },
    user: {
      name: null,
      password: null,
      privateKey: null,
      passphrase: null
    },
    ssh: {
      host: null,
      port: 22,
      term: 'xterm-256color',
      readyTimeout: 20000,
      keepaliveInterval: 30000,
      keepaliveCountMax: 3,
      alwaysSendKeyboardInteractivePrompts: false,
      disableInteractiveAuth: false,
      algorithms: {
        cipher: [],
        compress: [],
        hmac: [],
        kex: [],
        serverHostKey: []
      }
    },
    header: {
      text: null,
      background: '#000000'
    },
    options: {
      challengeButton: false,
      autoLog: false,
      allowReauth: true,
      allowReconnect: true,
      allowReplay: true,
      replayCRLF: true,
      ...options
    },
    session: {
      secret: TEST_SECRET,
      name: 'test-session'
    },
    sso: {
      enabled: false,
      csrfProtection: false,
      trustedProxies: [],
      headerMapping: {
        username: 'x-remote-user',
        password: 'x-remote-pass',
        session: 'x-remote-session'
      }
    }
  }
}

function createShellStream(): EventEmitter & { write: ReturnType<typeof vi.fn> } {
  const stream = new EventEmitter() as EventEmitter & { write: ReturnType<typeof vi.fn> }
  stream.write = vi.fn()
  return stream
}

async function importModule(): Promise<void> {
  vi.resetModules()
  loggerStub = createStructuredLoggerStub()
  const debugStub = vi.fn()

  vi.doMock('../../../app/logger.js', () => ({
    createNamespacedDebug: () => debugStub,
    createAppStructuredLogger: () => loggerStub
  }))

  moduleUnderTest = (await import('../../../app/socket/control-handler.js')) as ControlHandlerModule
}

describe('handleReplayCredentials structured logging', () => {
  beforeEach(async () => {
    await importModule()
  })

  it('logs success when credentials replay succeeds', () => {
    const emit = vi.fn()
    const request = {
      session: { sshCredentials: { password: TEST_PASSWORDS.session } },
      headers: { 'user-agent': TEST_USER_AGENTS.DEFAULT }
    }
    const socket = { id: 'socket-1', emit, request } as unknown as Socket

    const sessionState = {
      ...createInitialSessionState(),
      username: 'jane',
      host: 'ssh.example.com',
      port: 2222,
      password: TEST_PASSWORDS.state
    }

    const shellStream = createShellStream()
    const config = createTestConfig({ allowReplay: true, replayCRLF: true })

    moduleUnderTest.handleReplayCredentials(socket, config, sessionState, shellStream)

    expect(shellStream.write).toHaveBeenCalledWith(`${TEST_PASSWORDS.session}\r\n`)
    expect(emit).not.toHaveBeenCalled()

    expect(loggerStub.entries).toHaveLength(1)
    const entry = loggerStub.entries[0]
    expect(entry.level).toBe('info')
    expect(entry.entry.event).toBe('credential_replay')
    expect(entry.entry.context?.status).toBe('success')
    expect(entry.entry.context?.requestId).toBe('socket-1')
    expect(entry.entry.context?.username).toBe('jane')
    expect(entry.entry.context?.targetHost).toBe('ssh.example.com')
    expect(entry.entry.context?.targetPort).toBe(2222)
    expect(entry.entry.data).toMatchObject({
      allowReplay: true,
      lineEnding: 'crlf',
      passwordSource: 'session_credentials'
    })
  })

  it('logs denial when replay disabled by configuration', () => {
    const emit = vi.fn()
    const request = {
      session: { sshCredentials: { password: TEST_PASSWORDS.session } },
      headers: { 'user-agent': TEST_USER_AGENTS.BLOCKED }
    }
    const socket = { id: 'socket-2', emit, request } as unknown as Socket

    const sessionState = {
      ...createInitialSessionState(),
      username: 'alex',
      host: 'ssh.example.com',
      port: 2022,
      password: TEST_PASSWORDS.state
    }

    const shellStream = createShellStream()
    const config = createTestConfig({ allowReplay: false, replayCRLF: false })

    moduleUnderTest.handleReplayCredentials(socket, config, sessionState, shellStream)

    expect(shellStream.write).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith(SOCKET_EVENTS.SSH_ERROR, VALIDATION_MESSAGES.REPLAY_DISABLED)

    expect(loggerStub.entries).toHaveLength(1)
    const entry = loggerStub.entries[0]
    expect(entry.level).toBe('warn')
    expect(entry.entry.context?.status).toBe('failure')
    expect(entry.entry.context?.reason).toBe(VALIDATION_MESSAGES.REPLAY_DISABLED)
    expect(entry.entry.data).toMatchObject({
      allowReplay: false,
      lineEnding: 'cr',
      passwordSource: 'session_credentials'
    })
  })

  it('logs failure when no password is available', () => {
    const emit = vi.fn()
    const request = {
      session: { sshCredentials: {} },
      headers: { 'user-agent': TEST_USER_AGENTS.NO_PASSWORD }
    }
    const socket = { id: 'socket-3', emit, request } as unknown as Socket

    const sessionState = createInitialSessionState()

    const shellStream = createShellStream()
    const config = createTestConfig({ allowReplay: true, replayCRLF: true })

    moduleUnderTest.handleReplayCredentials(socket, config, sessionState, shellStream)

    expect(shellStream.write).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith(SOCKET_EVENTS.SSH_ERROR, VALIDATION_MESSAGES.NO_REPLAY_PASSWORD)

    expect(loggerStub.entries).toHaveLength(1)
    const entry = loggerStub.entries[0]
    expect(entry.level).toBe('warn')
    expect(entry.entry.context?.status).toBe('failure')
    expect(entry.entry.context?.reason).toBe(VALIDATION_MESSAGES.NO_REPLAY_PASSWORD)
    expect(entry.entry.data).toMatchObject({
      allowReplay: true,
      lineEnding: 'crlf',
      passwordSource: 'none'
    })
  })

  it('logs error when shell write fails', () => {
    const emit = vi.fn()
    const request = {
      session: { sshCredentials: { password: TEST_PASSWORDS.session } },
      headers: { 'user-agent': TEST_USER_AGENTS.WRITE_FAIL }
    }
    const socket = { id: 'socket-4', emit, request } as unknown as Socket

    const sessionState = {
      ...createInitialSessionState(),
      username: 'kim',
      host: 'ssh.example.com',
      port: 2222,
      password: TEST_PASSWORDS.state
    }

    const shellStream = createShellStream()
    shellStream.write.mockImplementation(() => {
      throw new Error('stream closed')
    })

    const config = createTestConfig({ allowReplay: true, replayCRLF: true })

    moduleUnderTest.handleReplayCredentials(socket, config, sessionState, shellStream)

    expect(shellStream.write).toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith(SOCKET_EVENTS.SSH_ERROR, 'Failed to replay credentials')

    expect(loggerStub.entries).toHaveLength(1)
    const entry = loggerStub.entries[0]
    expect(entry.level).toBe('error')
    expect(entry.entry.context?.status).toBe('failure')
    expect(entry.entry.context?.reason).toBe('stream closed')
    expect(entry.entry.data).toMatchObject({
      allowReplay: true,
      lineEnding: 'crlf',
      passwordSource: 'session_credentials',
      writeFailure: true
    })
  })
})
