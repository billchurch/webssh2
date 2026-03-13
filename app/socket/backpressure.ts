/**
 * Shared WebSocket backpressure utilities.
 *
 * Extracted from service-socket-terminal to be reused by SFTP downloads
 * and any future high-throughput socket emitters.
 *
 * @module socket/backpressure
 */

const LOW_WATER_MARK_DIVISOR = 4
const DRAIN_POLL_MS = 50

/** Minimal socket shape needed for backpressure checks */
export type BackpressureSocket = {
  conn: {
    once(event: string, cb: () => void): void
    removeListener(event: string, cb: () => void): void
  } & Record<string, unknown>
} & Record<string, unknown>

/**
 * Safely reads bufferedAmount from the ws WebSocket via the Engine.IO
 * transport chain. Returns null when unavailable (polling transport,
 * access failure, or during transport upgrade).
 */
export function getWebSocketBufferedBytes(
  socket: BackpressureSocket
): number | null {
  try {
    const conn: unknown = socket.conn
    if (typeof conn !== 'object' || conn === null) {
      return null
    }
    const transport: unknown = (conn as Record<string, unknown>)['transport']
    if (typeof transport !== 'object' || transport === null) {
      return null
    }
    const transportRecord = transport as Record<string, unknown>
    if (transportRecord['name'] !== 'websocket') {
      return null
    }
    const wsSocket: unknown = transportRecord['socket']
    if (typeof wsSocket !== 'object' || wsSocket === null) {
      return null
    }
    const amount: unknown = (wsSocket as Record<string, unknown>)['bufferedAmount']
    if (typeof amount !== 'number') {
      return null
    }
    return amount
  } catch {
    return null
  }
}

/**
 * Pure decision function for backpressure control.
 * Returns 'pause' when buffer exceeds high water mark,
 * 'resume' when buffer drops below low water mark (HWM / 4),
 * or 'none' when no action is needed.
 */
export function computeBackpressureAction(
  bufferedBytes: number | null,
  highWaterMark: number,
  currentlyPaused: boolean
): 'pause' | 'resume' | 'none' {
  if (bufferedBytes === null) {
    return 'none'
  }
  const lowWaterMark = Math.floor(highWaterMark / LOW_WATER_MARK_DIVISOR)
  if (!currentlyPaused && bufferedBytes >= highWaterMark) {
    return 'pause'
  }
  if (currentlyPaused && bufferedBytes < lowWaterMark) {
    return 'resume'
  }
  return 'none'
}

/**
 * Controller that provides an async waitForDrain() method.
 * Callers await this between emits to respect WebSocket backpressure.
 */
export interface BackpressureController {
  /** Resolves immediately if buffer is OK, otherwise waits for drain. */
  waitForDrain(): Promise<void>
  /** Clean up listeners and timers. */
  destroy(): void
}

/**
 * Create a backpressure controller for a Socket.IO socket.
 *
 * Usage in an emit loop:
 *   const bp = createBackpressureController(socket, highWaterMark)
 *   for (const chunk of chunks) {
 *     socket.emit('data', chunk)
 *     await bp.waitForDrain()
 *   }
 *   bp.destroy()
 */
export function createBackpressureController(
  socket: BackpressureSocket,
  highWaterMark: number
): BackpressureController {
  let destroyed = false
  let pendingResolve: (() => void) | null = null
  let timerId: ReturnType<typeof setTimeout> | null = null

  const onDrain = (): void => {
    checkAndResolve()
  }

  const checkAndResolve = (): void => {
    if (pendingResolve === null) {
      return
    }
    const buffered = getWebSocketBufferedBytes(socket)
    const action = computeBackpressureAction(buffered, highWaterMark, true)
    if (action === 'resume' || buffered === null) {
      const resolve = pendingResolve
      pendingResolve = null
      clearTimer()
      socket.conn.removeListener('drain', onDrain)
      resolve()
    } else {
      scheduleTimer()
    }
  }

  const scheduleTimer = (): void => {
    clearTimer()
    timerId = setTimeout(() => {
      timerId = null
      checkAndResolve()
    }, DRAIN_POLL_MS)
  }

  const clearTimer = (): void => {
    if (timerId !== null) {
      clearTimeout(timerId)
      timerId = null
    }
  }

  return {
    waitForDrain(): Promise<void> {
      if (destroyed) {
        return Promise.resolve()
      }
      const buffered = getWebSocketBufferedBytes(socket)
      const action = computeBackpressureAction(buffered, highWaterMark, false)
      if (action !== 'pause') {
        return Promise.resolve()
      }
      return new Promise<void>((resolve) => {
        // Resolve any previously pending waiter (single-waiter semantics)
        if (pendingResolve !== null) {
          const prev = pendingResolve
          pendingResolve = null
          clearTimer()
          socket.conn.removeListener('drain', onDrain)
          prev()
        }
        pendingResolve = resolve
        socket.conn.once('drain', onDrain)
        scheduleTimer()
      })
    },
    destroy(): void {
      destroyed = true
      if (pendingResolve !== null) {
        const resolve = pendingResolve
        pendingResolve = null
        resolve()
      }
      clearTimer()
      socket.conn.removeListener('drain', onDrain)
    }
  }
}
