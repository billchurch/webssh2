// tests/unit/socket/socket-event-guard.vitest.ts
// Boundary guard for inbound socket events and the credential-safe debug hook (#579)

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { EventEmitter } from 'node:events'
import { format } from 'node:util'
import createDebug from 'debug'
import socketHandler from '../../../app/socket-v2.js'
import {
  describeInboundEvent,
  registerGuardedListener,
  summarizePayload
} from '../../../app/socket/adapters/socket-event-guard.js'
import type { AdapterContext } from '../../../app/socket/adapters/service-socket-shared.js'
import { ServiceSocketTerminal } from '../../../app/socket/adapters/service-socket-terminal.js'
import { createMockSocket, createMockIO, createMockConfig } from '../socket-v2-test-utils.js'
import { createMockServices } from '../../test-utils.js'
import { TEST_PASSWORDS, TEST_SSH, TEST_USERNAME } from '../../test-constants.js'

const SECRET = TEST_PASSWORDS.secret123
const KEYSTROKES = `${TEST_PASSWORDS.basic123}\r`

interface FakeContext {
  context: AdapterContext
  socket: EventEmitter & { emit: Mock }
  logger: { warn: Mock; error: Mock; info: Mock; debug: Mock }
}

const createFakeContext = (): FakeContext => {
  const socket = new EventEmitter() as EventEmitter & { emit: Mock }
  const realEmit = EventEmitter.prototype.emit.bind(socket)
  socket.emit = vi.fn()
  const logger = {
    warn: vi.fn(() => ({ ok: true, value: undefined })),
    error: vi.fn(() => ({ ok: true, value: undefined })),
    info: vi.fn(() => ({ ok: true, value: undefined })),
    debug: vi.fn(() => ({ ok: true, value: undefined }))
  }
  const context = {
    socket,
    config: {},
    services: {},
    state: { sessionId: null, connectionId: null, shellStream: null, initialTermSettings: {} },
    protocol: 'ssh',
    debug: vi.fn(),
    logger
  } as unknown as AdapterContext
  // Keep a way to dispatch to registered listeners despite the emit spy
  ;(socket as unknown as { dispatch: typeof realEmit }).dispatch = realEmit
  return { context, socket, logger }
}

const dispatch = (socket: EventEmitter, event: string, payload: unknown): boolean =>
  (socket as unknown as { dispatch: (event: string, payload: unknown) => boolean }).dispatch(event, payload)

describe('registerGuardedListener', () => {
  it('passes validated payloads to the handler', () => {
    const { context, socket } = createFakeContext()
    const handle = vi.fn()
    registerGuardedListener(context, 'resize', () => ({ ok: true, value: { rows: 1, cols: 2 } }), handle)

    dispatch(socket, 'resize', { rows: '1' })

    expect(handle).toHaveBeenCalledWith({ rows: 1, cols: 2 })
  })

  it('answers invalid payloads with ssherror and a structured warning', () => {
    const { context, socket, logger } = createFakeContext()
    const handle = vi.fn()
    registerGuardedListener(context, 'resize', () => ({ ok: false, error: new Error('bad size') }), handle)

    dispatch(socket, 'resize', null)

    expect(handle).not.toHaveBeenCalled()
    expect(socket.emit).toHaveBeenCalledWith('ssherror', 'Invalid resize payload: bad size')
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: 'socket_payload_invalid' }))
  })

  it('caps validator messages before they reach the reply or the log', () => {
    const { context, socket, logger } = createFakeContext()
    const longMessage = `bad key ${'Q'.repeat(100_000)}`
    const onInvalid = vi.fn()
    registerGuardedListener(context, 'resize', () => ({ ok: false, error: new Error(longMessage) }), vi.fn())
    registerGuardedListener(context, 'authenticate', () => ({ ok: false, error: new Error(longMessage) }), vi.fn(), onInvalid)

    dispatch(socket, 'resize', {})
    dispatch(socket, 'authenticate', {})

    const reply = String(socket.emit.mock.calls[0]?.[1])
    expect(reply.length).toBeLessThan(300)
    const logged = JSON.stringify(logger.warn.mock.calls)
    expect(logged).not.toContain('Q'.repeat(300))
    expect((onInvalid.mock.calls[0]?.[0] as Error).message.length).toBeLessThan(250)
  })

  it('uses the custom reply for invalid payloads when given', () => {
    const { context, socket } = createFakeContext()
    const onInvalid = vi.fn()
    registerGuardedListener(context, 'authenticate', () => ({ ok: false, error: new Error('nope') }), vi.fn(), onInvalid)

    dispatch(socket, 'authenticate', 'x')

    expect(onInvalid).toHaveBeenCalledWith(expect.objectContaining({ message: 'nope' }))
    expect(socket.emit).not.toHaveBeenCalled()
  })

  it('contains synchronous throws from the handler', () => {
    const { context, socket, logger } = createFakeContext()
    registerGuardedListener(context, 'data', () => ({ ok: true, value: 'x' }), () => {
      throw new Error('boom')
    })

    expect(() => dispatch(socket, 'data', 'x')).not.toThrow()
    expect(socket.emit).toHaveBeenCalledWith('ssherror', 'Request failed')
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: 'socket_handler_error' }))
  })

  it('contains rejected promises from async handlers', async () => {
    const { context, socket } = createFakeContext()
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      registerGuardedListener(context, 'terminal', () => ({ ok: true, value: {} }), () =>
        Promise.reject(new Error('async boom')))

      dispatch(socket, 'terminal', {})
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setImmediate(resolve))

      expect(unhandled).not.toHaveBeenCalled()
      expect(socket.emit).toHaveBeenCalledWith('ssherror', 'Request failed')
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('contains validators that throw', () => {
    const { context, socket } = createFakeContext()
    registerGuardedListener(context, 'control', () => {
      throw new Error('validator bug')
    }, vi.fn())

    expect(() => dispatch(socket, 'control', 'x')).not.toThrow()
    expect(socket.emit).toHaveBeenCalledWith('ssherror', 'Request failed')
  })
})

describe('summarizePayload', () => {
  it.each([
    [null, { type: 'null' }],
    [undefined, { type: 'undefined' }],
    [42, { type: 'number' }],
    ['abc', { type: 'string', length: 3 }],
    [Buffer.from('abcd'), { type: 'buffer', length: 4 }],
    [[1, 2], { type: 'array', length: 2 }]
  ])('describes %o by shape only', (value, expected) => {
    expect(summarizePayload(value)).toEqual(expected)
  })

  it('lists object keys and credential presence without values', () => {
    const summary = summarizePayload({ username: TEST_USERNAME, password: SECRET, privateKey: '' })

    expect(summary).toEqual({
      type: 'object',
      keyCount: 3,
      keys: ['username', 'password', 'privateKey'],
      password_present: true,
      privateKey_present: false
    })
    expect(JSON.stringify(summary)).not.toContain(SECRET)
  })
})

describe('describeInboundEvent', () => {
  it.each([null, undefined, 'str', 7, [], [null]])('never throws on %o', (value) => {
    for (const event of ['authenticate', 'data', 'resize', 'prompt-response', 'sftp-list']) {
      expect(() => describeInboundEvent(event, [value])).not.toThrow()
    }
  })

  it('replaces long strings with a size summary', () => {
    const described = JSON.stringify(describeInboundEvent('exec', [{ command: 'x'.repeat(100_000) }]))

    expect(described.length).toBeLessThan(200)
    expect(described).toContain('"length":100000')
  })

  it('summarizes buffers and bare long strings', () => {
    const described = JSON.stringify(describeInboundEvent('sftp-upload-chunk', ['y'.repeat(5000), Buffer.alloc(10)]))

    expect(described).not.toContain('yyyy')
    expect(described).toContain('"type":"buffer"')
  })

  it('never copies an oversized object key into the output', () => {
    const longKey = 'k'.repeat(100_010)
    const described = JSON.stringify(describeInboundEvent('resize', [{ [longKey]: 1, rows: 24 }]))

    expect(described).not.toContain('k'.repeat(100))
    expect(described.length).toBeLessThan(500)
  })

  it('summarizes nested oversized keys and wide objects or arrays', () => {
    const nested = { outer: { ['n'.repeat(5000)]: true } }
    const wide = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`key${i}`, i]))
    const described = JSON.stringify(describeInboundEvent('terminal', [nested, wide, Array.from({ length: 1000 }, () => 0)]))

    expect(described).not.toContain('n'.repeat(100))
    expect(described).toContain('"keyCount":1000')
    expect(described).toContain('"type":"array","length":1000')
    expect(described.length).toBeLessThan(2000)
  })

  it('masks sensitive fields for non-summary events', () => {
    const described = JSON.stringify(describeInboundEvent('sftp-list', [{ path: '/tmp', password: SECRET }]))

    expect(described).toContain('/tmp')
    expect(described).not.toContain(SECRET)
  })
})

describe('onAny debug hook (#579)', () => {
  let lines: string[]
  let previousNamespaces: string
  const originalLog = createDebug.log

  beforeEach(() => {
    lines = []
    previousNamespaces = createDebug.disable()
    createDebug.enable('webssh2:socket:service-adapter')
    createDebug.log = (...args: unknown[]): void => {
      lines.push(format(...args))
    }
  })

  afterEach(() => {
    createDebug.log = originalLog
    createDebug.disable()
    if (previousNamespaces !== '') {
      createDebug.enable(previousNamespaces)
    }
  })

  const fireOnAny = (event: string, ...args: unknown[]): string => {
    const io = createMockIO()
    const socket = createMockSocket('debug-socket-id')
    socketHandler(io as never, createMockConfig() as never, createMockServices() as never)
    const onConnection = io.on.mock.calls[0]?.[1] as (s: unknown) => void
    onConnection(socket)
    const listener = socket.onAny.mock.calls[0]?.[0] as (event: string, ...args: unknown[]) => void
    lines = []
    listener(event, ...args)
    return lines.join('\n')
  }

  it('does not log keyboard-interactive responses', () => {
    const output = fireOnAny('authenticate', { responses: [TEST_USERNAME, SECRET] })

    expect(output).toContain("Received event 'authenticate'")
    expect(output).not.toContain(SECRET)
  })

  it('logs that a password or key was present without the values', () => {
    const output = fireOnAny('authenticate', {
      username: TEST_USERNAME,
      host: TEST_SSH.HOST,
      password: SECRET,
      privateKey: SECRET
    })

    expect(output).toContain('password_present')
    expect(output).toContain('privateKey_present')
    expect(output).not.toContain(SECRET)
  })

  it('does not log prompt-response inputs', () => {
    const output = fireOnAny('prompt-response', { id: 'p1', action: 'submit', inputs: { password: SECRET } })

    expect(output).toContain("Received event 'prompt-response'")
    expect(output).not.toContain(SECRET)
  })

  it('does not log data keystrokes', () => {
    const output = fireOnAny('data', KEYSTROKES)

    expect(output).toContain("Received event 'data'")
    expect(output).not.toContain(TEST_PASSWORDS.basic123)
  })

  it('does not log hostkey verify responses', () => {
    const output = fireOnAny('hostkey:verify-response', { action: SECRET })

    expect(output).not.toContain(SECRET)
  })

  it('does not log an oversized key sent with resize', () => {
    const longKey = 'z'.repeat(100_010)
    const output = fireOnAny('resize', { [longKey]: 1 })

    expect(output).toContain("Received event 'resize'")
    expect(output).not.toContain('z'.repeat(100))
  })

  it('still logs non-sensitive events through the masker', () => {
    const output = fireOnAny('resize', { rows: 24, cols: 80 })

    expect(output).toContain("Received event 'resize'")
    expect(output).toContain('rows')
  })

  it.each([null, 'str', 5, [null]])('survives authenticate payload %o', (payload) => {
    expect(() => fireOnAny('authenticate', payload)).not.toThrow()
  })
})

describe('ServiceSocketTerminal input guards', () => {
  const createTerminal = (): { terminal: ServiceSocketTerminal; write: Mock; resize: Mock } => {
    const { context } = createFakeContext()
    const write = vi.fn()
    const resize = vi.fn(() => ({ ok: true, value: undefined }))
    context.state.shellStream = { write } as unknown as AdapterContext['state']['shellStream']
    context.state.sessionId = 'session-1' as AdapterContext['state']['sessionId']
    ;(context as { services: unknown }).services = {
      terminal: { getTerminal: () => ({ ok: true, value: { id: 't' } }), resize }
    }
    return { terminal: new ServiceSocketTerminal(context), write, resize }
  }

  it.each([null, undefined, 42, {}, ['a']])('handleData ignores %o', (value) => {
    const { terminal, write } = createTerminal()

    expect(() => { terminal.handleData(value) }).not.toThrow()
    expect(write).not.toHaveBeenCalled()
  })

  it('handleData contains a throwing stream write', () => {
    const { terminal, write } = createTerminal()
    write.mockImplementation(() => {
      throw new TypeError('invalid chunk')
    })

    expect(() => { terminal.handleData('ls') }).not.toThrow()
  })

  it.each([null, 'x', 5, {}, { rows: 'a', cols: 'b' }])('handleResize ignores %o', (value) => {
    const { terminal, resize } = createTerminal()

    expect(() => { terminal.handleResize(value) }).not.toThrow()
    expect(resize).not.toHaveBeenCalled()
  })

  it('handleResize contains a throwing terminal service', () => {
    const { terminal, resize } = createTerminal()
    resize.mockImplementation(() => {
      throw new Error('resize failed')
    })

    expect(() => { terminal.handleResize({ rows: 10, cols: 10 }) }).not.toThrow()
  })
})
