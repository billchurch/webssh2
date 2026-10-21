// app/process-guards.ts
// Last-resort handlers for errors that escape every other boundary

import { logProcessError, type ProcessErrorKind } from './logger.js'

/**
 * Crash-safe policy:
 *
 * - `unhandledRejection`: log and keep serving. A stray rejected promise does
 *   not leave synchronous state half-updated, and every socket listener
 *   already catches its own rejections, so one bad request must not drop
 *   every other user's SSH session.
 * - `uncaughtException`: log, then exit with code 1 after a short flush
 *   delay. Node does not guarantee consistent state after a synchronous throw
 *   reaches the top of the stack, so the gateway stops cleanly and leaves the
 *   restart to the supervisor (Docker restart policy, systemd, Kubernetes)
 *   instead of running on in a half-broken state.
 */

interface ProcessEventTarget {
  on(event: 'uncaughtException', listener: (error: unknown) => void): unknown
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): unknown
}

export interface ProcessGuardOptions {
  readonly log?: (kind: ProcessErrorKind, error: unknown, action: string) => void
  readonly exit?: (code: number) => void
  readonly exitDelayMs?: number
}

const DEFAULT_EXIT_DELAY_MS = 100

export function installProcessErrorHandlers(
  target: ProcessEventTarget = process,
  options: ProcessGuardOptions = {}
): void {
  const log = options.log ?? logProcessError
  const exit = options.exit ?? ((code: number): void => { process.exit(code) })
  const exitDelayMs = options.exitDelayMs ?? DEFAULT_EXIT_DELAY_MS
  let exiting = false

  target.on('unhandledRejection', (reason) => {
    log('unhandled_rejection', reason, 'continuing to serve')
  })

  target.on('uncaughtException', (error) => {
    if (exiting) {
      log('uncaught_exception', error, 'already shutting down')
      return
    }

    exiting = true
    log('uncaught_exception', error, `exiting with code 1 in ${exitDelayMs}ms`)
    setTimeout(() => {
      exit(1)
    }, exitDelayMs)
  })
}
