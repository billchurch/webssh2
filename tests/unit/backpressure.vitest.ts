// tests/unit/backpressure.vitest.ts
import { describe, it, expect, vi } from 'vitest'
import {
  getWebSocketBufferedBytes,
  computeBackpressureAction,
  createBackpressureController,
  type BackpressureSocket
} from '../../app/socket/backpressure.js'

function makeMockSocket(
  bufferedAmount: number,
  transportName: string = 'websocket'
): BackpressureSocket {
  return {
    conn: {
      transport: {
        name: transportName,
        socket: { bufferedAmount }
      },
      once: vi.fn(),
      removeListener: vi.fn()
    } as never
  } as BackpressureSocket
}

describe('computeBackpressureAction', () => {
  const HWM = 16384
  const LWM = Math.floor(HWM / 4) // 4096

  it('returns "none" when bufferedBytes is null', () => {
    expect(computeBackpressureAction(null, HWM, false)).toBe('none')
    expect(computeBackpressureAction(null, HWM, true)).toBe('none')
  })

  it('returns "pause" when buffer >= HWM and not paused', () => {
    expect(computeBackpressureAction(HWM, HWM, false)).toBe('pause')
    expect(computeBackpressureAction(HWM + 1000, HWM, false)).toBe('pause')
  })

  it('returns "none" when buffer < HWM and not paused', () => {
    expect(computeBackpressureAction(0, HWM, false)).toBe('none')
    expect(computeBackpressureAction(HWM - 1, HWM, false)).toBe('none')
  })

  it('returns "resume" when buffer < LWM and paused', () => {
    expect(computeBackpressureAction(0, HWM, true)).toBe('resume')
    expect(computeBackpressureAction(LWM - 1, HWM, true)).toBe('resume')
  })

  it('returns "none" when paused but buffer between LWM and HWM (hysteresis)', () => {
    expect(computeBackpressureAction(LWM, HWM, true)).toBe('none')
    expect(computeBackpressureAction(HWM - 1, HWM, true)).toBe('none')
  })

  it('returns "none" when already paused and still above HWM', () => {
    expect(computeBackpressureAction(HWM, HWM, true)).toBe('none')
    expect(computeBackpressureAction(HWM + 5000, HWM, true)).toBe('none')
  })
})

describe('getWebSocketBufferedBytes', () => {
  it('returns bufferedAmount when transport is websocket', () => {
    expect(getWebSocketBufferedBytes(makeMockSocket(12345))).toBe(12345)
  })

  it('returns null when transport is not websocket', () => {
    expect(getWebSocketBufferedBytes(makeMockSocket(0, 'polling'))).toBeNull()
  })

  it('returns null when conn is missing', () => {
    const socket = makeMockSocket(0)
    ;(socket as unknown as { conn: undefined }).conn = undefined
    expect(getWebSocketBufferedBytes(socket)).toBeNull()
  })

  it('returns null when transport is missing', () => {
    const socket = makeMockSocket(0)
    const conn = socket.conn as unknown as Record<string, unknown>
    conn['transport'] = undefined
    expect(getWebSocketBufferedBytes(socket)).toBeNull()
  })

  it('returns 0 when buffer is empty', () => {
    expect(getWebSocketBufferedBytes(makeMockSocket(0))).toBe(0)
  })
})

describe('createBackpressureController', () => {
  it('waitForDrain resolves immediately when buffer is below HWM', async () => {
    const socket = makeMockSocket(100)
    const controller = createBackpressureController(socket, 16384)
    await controller.waitForDrain()
    controller.destroy()
  })

  it('waitForDrain blocks when buffer exceeds HWM', async () => {
    let currentBuffered = 20000
    const listeners = new Map<string, () => void>()
    const conn = {
      transport: {
        name: 'websocket',
        socket: { get bufferedAmount() { return currentBuffered } }
      },
      once: vi.fn((event: string, cb: () => void) => { listeners.set(event, cb) }),
      removeListener: vi.fn()
    }
    const socket = { conn } as unknown as BackpressureSocket

    const controller = createBackpressureController(socket, 16384)
    let resolved = false
    const promise = controller.waitForDrain().then(() => { resolved = true })

    await Promise.resolve()
    expect(resolved).toBe(false)

    currentBuffered = 1000
    const drainCb = listeners.get('drain')
    if (drainCb) drainCb()

    await promise
    expect(resolved).toBe(true)
    controller.destroy()
  })

  it('destroy resolves pending waitForDrain', async () => {
    const socket = makeMockSocket(20000)
    const controller = createBackpressureController(socket, 16384)

    let resolved = false
    const promise = controller.waitForDrain().then(() => { resolved = true })

    controller.destroy()
    await promise
    expect(resolved).toBe(true)
  })

  it('waitForDrain resolves immediately after destroy', async () => {
    const socket = makeMockSocket(20000)
    const controller = createBackpressureController(socket, 16384)
    controller.destroy()
    await controller.waitForDrain()
  })
})
