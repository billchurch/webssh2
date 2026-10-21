// tests/unit/process-guards.vitest.ts
// Process-level handlers for errors that escape every other boundary

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { EventEmitter } from 'node:events'
import { installProcessErrorHandlers } from '../../app/process-guards.js'
import type { ProcessErrorKind } from '../../app/logger.js'

type LogFn = (kind: ProcessErrorKind, error: unknown, action: string) => void
type ExitFn = (code: number) => void

describe('installProcessErrorHandlers', () => {
  let target: EventEmitter
  let log: Mock<LogFn>
  let exit: Mock<ExitFn>

  beforeEach(() => {
    vi.useFakeTimers()
    target = new EventEmitter()
    log = vi.fn<LogFn>()
    exit = vi.fn<ExitFn>()
    installProcessErrorHandlers(target, { log, exit, exitDelayMs: 50 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('logs unhandled rejections and keeps serving', () => {
    const reason = new Error('stray rejection')

    target.emit('unhandledRejection', reason)
    vi.runAllTimers()

    expect(log).toHaveBeenCalledWith('unhandled_rejection', reason, 'continuing to serve')
    expect(exit).not.toHaveBeenCalled()
  })

  it('logs uncaught exceptions and exits with code 1 after the flush delay', () => {
    const error = new Error('fatal')

    target.emit('uncaughtException', error)

    expect(log).toHaveBeenCalledWith('uncaught_exception', error, 'exiting with code 1 in 50ms')
    expect(exit).not.toHaveBeenCalled()

    vi.advanceTimersByTime(50)
    expect(exit).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('schedules a single exit when several exceptions arrive', () => {
    target.emit('uncaughtException', new Error('first'))
    target.emit('uncaughtException', new Error('second'))
    vi.runAllTimers()

    expect(exit).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenLastCalledWith('uncaught_exception', expect.any(Error), 'already shutting down')
  })

  it('accepts non-Error values', () => {
    target.emit('unhandledRejection', 'just a string')
    target.emit('unhandledRejection', undefined)

    expect(log).toHaveBeenCalledTimes(2)
  })
})
