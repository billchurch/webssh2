// tests/unit/sftp-download-backpressure.vitest.ts
import { describe, it, expect, vi } from 'vitest'
import {
  createBackpressureController,
  type BackpressureSocket
} from '../../app/socket/backpressure.js'

describe('SFTP Download Backpressure', () => {
  it('controller resolves immediately when buffer is low', async () => {
    const socket = makeMockSocket(100)
    const controller = createBackpressureController(socket, 16384)

    const start = Date.now()
    await controller.waitForDrain()
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(50)
    controller.destroy()
  })

  it('controller blocks when buffer is high and resumes on drain', async () => {
    let buffered = 20000
    const listeners = new Map<string, () => void>()
    const socket = {
      conn: {
        transport: {
          name: 'websocket',
          socket: { get bufferedAmount() { return buffered } }
        },
        once: vi.fn((event: string, cb: () => void) => {
          listeners.set(event, cb)
        }),
        removeListener: vi.fn()
      } as never
    } as BackpressureSocket

    const controller = createBackpressureController(socket, 16384)

    let resolved = false
    const drainPromise = controller.waitForDrain().then(() => {
      resolved = true
    })

    await Promise.resolve()
    expect(resolved).toBe(false)

    buffered = 1000
    const drainCb = listeners.get('drain')
    if (drainCb !== undefined) {
      drainCb()
    }

    await drainPromise
    expect(resolved).toBe(true)
    controller.destroy()
  })

  it('controller destroy resolves pending waitForDrain', async () => {
    const socket = makeMockSocket(20000)
    const controller = createBackpressureController(socket, 16384)

    let resolved = false
    const promise = controller.waitForDrain().then(() => { resolved = true })

    controller.destroy()
    await promise
    expect(resolved).toBe(true)
  })
})

function makeMockSocket(bufferedAmount: number): BackpressureSocket {
  return {
    conn: {
      transport: {
        name: 'websocket',
        socket: { bufferedAmount }
      },
      once: vi.fn(),
      removeListener: vi.fn()
    } as never
  } as BackpressureSocket
}
