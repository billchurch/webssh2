// tests/unit/socket/malformed-payloads.vitest.ts
// Every inbound Socket.IO event must survive malformed payloads and answer
// with an error instead of passing them to the services or throwing.

import { afterEach, beforeEach, describe, expect, it, type Mock } from 'vitest'
import { EventEmitter } from 'node:events'
import socketHandler from '../../../app/socket-v2.js'
import {
  createMockSocket,
  createMockIO,
  createMockConfig,
  setupAuthenticatedSocket,
  trackEmittedEvents,
  waitForAsync,
  createTerminalSession
} from '../socket-v2-test-utils.js'
import { createMockServices } from '../../test-utils.js'
import { TEST_SSH, TEST_USERNAME } from '../../test-constants.js'

type EmittedEvent = { event: string; payload?: unknown }

interface MockServices {
  auth: { authenticate: Mock }
  ssh: { exec: Mock; shell: Mock }
  terminal: { resize: Mock; getTerminal: Mock }
}

const LONG_STRING = 'x'.repeat(70_000)

// Payloads that are invalid for every event except where noted
const NON_OBJECT_PAYLOADS: ReadonlyArray<[string, unknown]> = [
  ['null', null],
  ['undefined', undefined],
  ['a number', 42],
  ['a boolean', true],
  ['an array', ['a', 'b']]
]

const INVALID_PAYLOADS: Readonly<Record<string, ReadonlyArray<[string, unknown]>>> = {
  terminal: [
    ...NON_OBJECT_PAYLOADS.filter(([label]) => label !== 'undefined'),
    ['a string', 'xterm'],
    ['non-numeric rows', { rows: 'abc', cols: 80 }],
    ['out-of-range cols', { rows: 24, cols: 100_000 }],
    ['non-string term', { term: 5 }],
    ['oversized term', { term: LONG_STRING }]
  ],
  resize: [
    ...NON_OBJECT_PAYLOADS,
    ['a string', '80x24'],
    ['non-numeric rows', { rows: 'NaN', cols: 80 }],
    ['zero size', { rows: 0, cols: 0 }],
    ['out-of-range rows', { rows: 1_000_000, cols: 80 }],
    ['missing cols', { rows: 24 }]
  ],
  data: [
    ...NON_OBJECT_PAYLOADS,
    ['an object', { data: 'ls' }]
  ],
  exec: [
    ...NON_OBJECT_PAYLOADS,
    ['a string', 'ls'],
    ['non-string command', { command: 123 }],
    ['empty command', { command: '   ' }],
    ['oversized command', { command: LONG_STRING }],
    ['whitespace-padded command', { command: `${' '.repeat(500_000)}id` }]
  ],
  control: [
    ...NON_OBJECT_PAYLOADS,
    ['an unknown action', 'bogus'],
    ['an object', { action: 'reauth' }]
  ]
}

const INVALID_AUTH_PAYLOADS: ReadonlyArray<[string, unknown]> = [
  ...NON_OBJECT_PAYLOADS,
  ['a string', 'credentials'],
  ['non-string username', { username: 1, host: TEST_SSH.HOST }],
  ['missing host', { username: TEST_USERNAME }],
  ['invalid port', { username: TEST_USERNAME, host: TEST_SSH.HOST, port: 'abc' }],
  ['oversized username', { username: LONG_STRING, host: TEST_SSH.HOST }],
  ['whitespace-padded username', { username: `${' '.repeat(500_000)}${TEST_USERNAME}`, host: TEST_SSH.HOST }],
  ['oversized private key', { username: TEST_USERNAME, host: TEST_SSH.HOST, privateKey: LONG_STRING }],
  ['out-of-range rows', { username: TEST_USERNAME, host: TEST_SSH.HOST, rows: 100_000 }],
  ['non-array responses', { responses: 'secret' }],
  ['non-string responses', { responses: [1, 2] }],
  ['null responses', { responses: null }],
  ['too many responses', { responses: Array.from({ length: 50 }, () => 'a') }]
]

const emitRaw = (socket: EventEmitter, event: string, payload: unknown): void => {
  EventEmitter.prototype.emit.call(socket, event, payload)
}

const failedAuthResults = (events: EmittedEvent[]): EmittedEvent[] =>
  events.filter(e => {
    const payload = e.payload as { action?: string; success?: boolean } | undefined
    return e.event === 'authentication' && payload?.action === 'auth_result' && payload.success === false
  })

describe('malformed Socket.IO payloads', () => {
  let io: ReturnType<typeof createMockIO>
  let mockSocket: ReturnType<typeof createMockSocket>
  let services: MockServices
  let unhandled: unknown[]
  const onUnhandled = (reason: unknown): void => {
    unhandled.push(reason)
  }

  beforeEach(() => {
    io = createMockIO()
    mockSocket = createMockSocket('malformed-socket-id')
    services = createMockServices() as MockServices
    socketHandler(io as never, createMockConfig() as never, services as never)
    unhandled = []
    process.on('unhandledRejection', onUnhandled)
  })

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled)
  })

  const connectUnauthenticated = (): EmittedEvent[] => {
    const onConnection = io.on.mock.calls[0]?.[1] as (socket: unknown) => void
    onConnection(mockSocket)
    return trackEmittedEvents(mockSocket)
  }

  const openTerminal = async (): Promise<{ events: EmittedEvent[]; write: Mock }> => {
    await setupAuthenticatedSocket(io, mockSocket)
    await createTerminalSession(mockSocket)
    await waitForAsync(2)
    const shellResult = (await services.ssh.shell.mock.results[0]?.value) as { value: { write: Mock } }
    return { events: trackEmittedEvents(mockSocket), write: shellResult.value.write }
  }

  describe('before authentication', () => {
    it.each(INVALID_AUTH_PAYLOADS)('authenticate with %s fails the login without calling auth', async (_label, payload) => {
      const events = connectUnauthenticated()

      expect(() => { emitRaw(mockSocket, 'authenticate', payload) }).not.toThrow()
      await waitForAsync(3)

      const failures = failedAuthResults(events)
      expect(failures).toHaveLength(1)
      expect((failures[0]?.payload as { message: string }).message).toBe('Invalid credentials')
      expect(services.auth.authenticate).not.toHaveBeenCalled()
      expect(unhandled).toHaveLength(0)
    })

    for (const [event, payloads] of Object.entries(INVALID_PAYLOADS)) {
      it.each(payloads)(`${event} with %s returns an ssherror`, async (_label, payload) => {
        const events = connectUnauthenticated()

        expect(() => { emitRaw(mockSocket, event, payload) }).not.toThrow()
        await waitForAsync(3)

        const errors = events.filter(e => e.event === 'ssherror')
        expect(errors).toHaveLength(1)
        expect(String(errors[0]?.payload)).toContain(`Invalid ${event} payload`)
        expect(unhandled).toHaveLength(0)
      })
    }

    it.each([
      ...NON_OBJECT_PAYLOADS,
      ['a string', 'x'],
      ['an empty object', {}],
      ['a non-string action', { id: 'p1', action: 5 }],
      ['non-string inputs', { id: 'p1', action: 'submit', inputs: { a: 1 } }]
    ] as Array<[string, unknown]>)('prompt-response with %s returns an ssherror', async (_label, payload) => {
      const events = connectUnauthenticated()

      expect(() => { emitRaw(mockSocket, 'prompt-response', payload) }).not.toThrow()
      await waitForAsync(3)

      const errors = events.filter(e => e.event === 'ssherror')
      expect(errors).toHaveLength(1)
      expect(String(errors[0]?.payload)).toContain('Invalid prompt-response payload')
      expect(unhandled).toHaveLength(0)
    })

    it('never repeats an oversized prompt input key in the reply', async () => {
      const events = connectUnauthenticated()
      const longKey = `${'K'.repeat(100_000)}!`

      emitRaw(mockSocket, 'prompt-response', { id: 'prompt-1', action: 'submit', inputs: { [longKey]: 'v' } })
      await waitForAsync(3)

      const errors = events.filter(e => e.event === 'ssherror')
      expect(errors).toHaveLength(1)
      expect(String(errors[0]?.payload)).toBe('Invalid prompt-response payload: Invalid input key format')
    })

    it.each(NON_OBJECT_PAYLOADS)('every sftp event with %s returns an sftp-error', async (_label, payload) => {
      const events = connectUnauthenticated()
      const sftpEvents = [
        'sftp-list', 'sftp-stat', 'sftp-mkdir', 'sftp-delete', 'sftp-upload-start',
        'sftp-upload-chunk', 'sftp-upload-cancel', 'sftp-download-start', 'sftp-download-cancel'
      ]

      for (const event of sftpEvents) {
        events.length = 0
        expect(() => { emitRaw(mockSocket, event, payload) }).not.toThrow()
        await waitForAsync(2)
        expect(events.filter(e => e.event === 'sftp-error'), event).toHaveLength(1)
      }
      expect(unhandled).toHaveLength(0)
    })

    it.each([...NON_OBJECT_PAYLOADS, ['a string', 'x']] as Array<[string, unknown]>)(
      'prompt-response and sftp events with %s do not throw',
      async (_label, payload) => {
        connectUnauthenticated()
        const events = [
          'prompt-response',
          'hostkey:verify-response',
          'sftp-list',
          'sftp-stat',
          'sftp-mkdir',
          'sftp-delete',
          'sftp-upload-start',
          'sftp-upload-chunk',
          'sftp-upload-cancel',
          'sftp-download-start',
          'sftp-download-cancel'
        ]

        for (const event of events) {
          expect(() => { emitRaw(mockSocket, event, payload) }).not.toThrow()
        }
        await waitForAsync(3)
        expect(unhandled).toHaveLength(0)
      }
    )
  })

  describe('with an open terminal', () => {
    it('writes string keystrokes to the shell', async () => {
      const { events, write } = await openTerminal()

      emitRaw(mockSocket, 'data', 'ls\r')

      expect(write).toHaveBeenCalledWith('ls\r')
      expect(events.filter(e => e.event === 'ssherror')).toHaveLength(0)
    })

    it.each(INVALID_PAYLOADS['data'] ?? [])('never writes data payload %s to the shell', async (_label, payload) => {
      const { events, write } = await openTerminal()

      expect(() => { emitRaw(mockSocket, 'data', payload) }).not.toThrow()

      expect(write).not.toHaveBeenCalled()
      expect(events.filter(e => e.event === 'ssherror')).toHaveLength(1)
    })

    it('survives a shell stream whose write throws', async () => {
      const { write } = await openTerminal()
      write.mockImplementation(() => {
        throw new TypeError('write after end')
      })

      expect(() => { emitRaw(mockSocket, 'data', 'ls\r') }).not.toThrow()
      await waitForAsync(2)
      expect(unhandled).toHaveLength(0)
    })

    it('never passes invalid sizes to the terminal service', async () => {
      await openTerminal()
      services.terminal.resize.mockClear()

      for (const [, payload] of INVALID_PAYLOADS['resize'] ?? []) {
        emitRaw(mockSocket, 'resize', payload)
      }

      expect(services.terminal.resize).not.toHaveBeenCalled()
    })

    it('survives a terminal service that throws on resize', async () => {
      await openTerminal()
      services.terminal.getTerminal.mockReturnValue({ ok: true, value: { id: 'term' } })
      services.terminal.resize.mockImplementation(() => {
        throw new Error('resize exploded')
      })

      expect(() => { emitRaw(mockSocket, 'resize', { rows: 30, cols: 100 }) }).not.toThrow()
      await waitForAsync(2)
      expect(unhandled).toHaveLength(0)
    })

    it('does not run exec for an invalid payload', async () => {
      await openTerminal()

      for (const [, payload] of INVALID_PAYLOADS['exec'] ?? []) {
        emitRaw(mockSocket, 'exec', payload)
      }
      await waitForAsync(3)

      expect(services.ssh.exec).not.toHaveBeenCalled()
    })
  })

  it('applies the username limit to keyboard-interactive responses', async () => {
    const kiIo = createMockIO()
    const kiSocket = createMockSocket('ki-socket-id')
    const kiServices = createMockServices() as MockServices & { ssh: { connect: Mock } }
    const config = createMockConfig() as ReturnType<typeof createMockConfig> & { ssh: { host: string; port: number } }
    config.ssh.host = TEST_SSH.HOST
    config.ssh.port = TEST_SSH.PORT
    socketHandler(kiIo as never, config as never, kiServices as never)
    const onConnection = kiIo.on.mock.calls[0]?.[1] as (socket: unknown) => void
    onConnection(kiSocket)
    const events = trackEmittedEvents(kiSocket)

    emitRaw(kiSocket, 'authenticate', { responses: ['u'.repeat(4096), 'p'] })
    await waitForAsync(3)

    const failures = failedAuthResults(events)
    expect(failures).toHaveLength(1)
    expect((failures[0]?.payload as { message: string }).message).toBe('Invalid credentials')
    expect(kiServices.auth.authenticate).not.toHaveBeenCalled()
    expect(kiServices.ssh.connect).not.toHaveBeenCalled()
  })

  it('accepts the payloads the browser client actually sends', async () => {
    await setupAuthenticatedSocket(io, mockSocket)
    const events = trackEmittedEvents(mockSocket)

    emitRaw(mockSocket, 'terminal', { cols: 0, rows: 0 })
    await waitForAsync(3)
    emitRaw(mockSocket, 'resize', { cols: 120, rows: 40 })
    emitRaw(mockSocket, 'data', 'ls -la\r')
    emitRaw(mockSocket, 'control', 'replayCredentials')
    emitRaw(mockSocket, 'control', 'reauth')
    emitRaw(mockSocket, 'exec', { command: 'uptime' })
    await waitForAsync(3)

    expect(events.filter(e => e.event === 'ssherror')).toEqual([])
    expect(services.ssh.exec).toHaveBeenCalledWith(expect.anything(), 'uptime')
  })

  it('reports a failed exec as an ssherror instead of an unhandled rejection', async () => {
    await setupAuthenticatedSocket(io, mockSocket)
    await createTerminalSession(mockSocket)
    const events = trackEmittedEvents(mockSocket)
    services.ssh.exec.mockRejectedValue(new Error('exec exploded'))

    emitRaw(mockSocket, 'exec', { command: 'uptime' })
    await waitForAsync(3)

    expect(unhandled).toHaveLength(0)
    expect(events.some(e => e.event === 'ssherror')).toBe(true)
  })
})
