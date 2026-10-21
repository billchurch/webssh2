// tests/unit/socket/background-rejections.vitest.ts
// Promises started in the background by socket adapters must never reject unhandled

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { EventEmitter } from 'node:events'
import type { AdapterContext } from '../../../app/socket/adapters/service-socket-shared.js'
import { ServiceSocketControl } from '../../../app/socket/adapters/service-socket-control.js'
import { ServiceSocketSftp } from '../../../app/socket/adapters/service-socket-sftp.js'

interface FakeContext {
  context: AdapterContext
  emit: Mock
}

const ok = (): { ok: true; value: undefined } => ({ ok: true, value: undefined })

const createContext = (protocol: 'ssh' | 'telnet', services: Record<string, unknown>): FakeContext => {
  const socket = new EventEmitter() as EventEmitter & { emit: Mock; conn: EventEmitter; id: string }
  const emit = vi.fn()
  socket.emit = emit
  socket.conn = new EventEmitter()
  socket.id = 'background-socket'
  const context = {
    socket,
    config: { ssh: {}, options: {} },
    services: {
      terminal: { destroy: vi.fn(ok) },
      auth: { revokeSession: vi.fn(() => Promise.resolve(ok())) },
      session: { delete: vi.fn(ok) },
      ...services
    },
    state: {
      sessionId: 'session-1',
      connectionId: 'connection-1',
      shellStream: null,
      initialTermSettings: {}
    },
    protocol,
    debug: vi.fn(),
    logger: {
      info: vi.fn(ok),
      warn: vi.fn(ok),
      error: vi.fn(ok),
      debug: vi.fn(ok)
    }
  } as unknown as AdapterContext
  return { context, emit }
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve))
  }
}

describe('background promise rejections', () => {
  let unhandled: unknown[]
  const onUnhandled = (reason: unknown): void => {
    unhandled.push(reason)
  }

  beforeEach(() => {
    unhandled = []
    process.on('unhandledRejection', onUnhandled)
  })

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled)
  })

  it.each(['ssh', 'telnet'] as const)('handleDisconnect contains a rejected %s disconnect', async (protocol) => {
    // A plain function, not vi.fn: vi.fn attaches its own handlers to returned
    // promises, which would hide an unhandled rejection
    let calls = 0
    const disconnect = (): Promise<never> => {
      calls += 1
      return Promise.reject(new Error('disconnect rejected'))
    }
    const { context } = createContext(protocol, { ssh: { disconnect }, telnet: { disconnect } })
    const control = new ServiceSocketControl(context)

    expect(() => { control.handleDisconnect() }).not.toThrow()
    await flush()

    expect(calls).toBe(1)
    expect(unhandled).toEqual([])
    expect(context.state.connectionId).toBeNull()
  })

  it('reports a rejected download stream as an sftp-error', async () => {
    let streamCalls = 0
    const sftp = {
      isEnabled: () => true,
      startDownload: vi.fn(() => Promise.resolve({
        ok: true,
        value: { transferId: 'ignored', fileName: 'file.txt', fileSize: 10 }
      })),
      streamDownloadChunks: (): Promise<never> => {
        streamCalls += 1
        return Promise.reject(new Error('stream rejected'))
      }
    }
    const { context, emit } = createContext('ssh', { sftp })
    const adapter = new ServiceSocketSftp(context)

    await adapter.handleDownloadStart({ remotePath: '/tmp/file.txt' })
    await flush()

    expect(streamCalls).toBe(1)
    expect(unhandled).toEqual([])
    expect(emit).toHaveBeenCalledWith('sftp-error', expect.objectContaining({ code: 'SFTP_CHUNK_ERROR' }))
  })
})
