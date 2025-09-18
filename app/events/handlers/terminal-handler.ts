/**
 * Terminal I/O event handlers
 */

import { randomUUID } from 'node:crypto'
import type { EventBus } from '../event-bus.js'
import type { TerminalService, SSHService } from '../../services/interfaces.js'
import type { SessionStore } from '../../state/store.js'
import { EventPriority } from '../types.js'
import { isEventType } from '../types.js'
import debug from 'debug'

const logger = debug('webssh2:events:terminal')

/**
 * Active command executions
 */
interface ActiveExec {
  execId: string
  sessionId: string
  command: string
  startTime: number
}

/**
 * Create and register terminal event handlers
 */
export function createTerminalHandlers(
  eventBus: EventBus,
  terminalService: TerminalService,
  sshService: SSHService,
  sessionStore: SessionStore
): void {
  const activeExecs = new Map<string, ActiveExec>()

  // Handle terminal data input (from client)
  eventBus.subscribe('terminal.data.in', async (event) => {
    const { sessionId, data } = event.payload

    logger('Terminal input for session %s: %d bytes', sessionId,
      typeof data === 'string' ? data.length : data.length)

    try {
      // Write data to terminal
      const dataStr = typeof data === 'string' ? data : data.toString()
      const result = await terminalService.write(sessionId, dataStr)

      if (!result.ok) {
        logger('Failed to write to terminal for session %s: %s', sessionId, result.error.message)

        await eventBus.publish({
          type: 'system.warning',
          payload: {
            message: 'Terminal write failed',
            details: { error: result.error.message },
            sessionId
          }
        }, EventPriority.NORMAL)
      }
    } catch (error) {
      logger('Error handling terminal input for session %s: %O', sessionId, error)

      await eventBus.publish({
        type: 'system.error',
        payload: {
          error: error instanceof Error ? error : new Error('Terminal write failed'),
          context: 'TerminalHandler.terminal.data.in',
          sessionId
        }
      }, EventPriority.NORMAL)
    }
  })

  // Handle terminal resize
  eventBus.subscribe('terminal.resize', async (event) => {
    const { sessionId, rows, cols } = event.payload

    logger('Terminal resize for session %s: %dx%d', sessionId, cols, rows)

    try {
      // Update terminal dimensions in store
      sessionStore.dispatch(sessionId, {
        type: 'TERMINAL_RESIZE',
        payload: { rows, cols }
      })

      // Resize terminal
      const result = await terminalService.resize(sessionId, { rows, cols })

      if (!result.ok) {
        logger('Failed to resize terminal for session %s: %s', sessionId, result.error.message)

        await eventBus.publish({
          type: 'system.warning',
          payload: {
            message: 'Terminal resize failed',
            details: { error: result.error.message },
            sessionId
          }
        }, EventPriority.LOW)
      } else {
        logger('Terminal resized for session %s', sessionId)
      }
    } catch (error) {
      logger('Error resizing terminal for session %s: %O', sessionId, error)
    }
  })

  // Handle command execution
  eventBus.subscribe('terminal.command', async (event) => {
    const { sessionId, command } = event.payload
    const execId = randomUUID()

    logger('Executing command for session %s: %s (exec: %s)', sessionId, command, execId)

    // Track active execution
    activeExecs.set(execId, {
      execId,
      sessionId: String(sessionId),
      command,
      startTime: Date.now()
    })

    try {
      // Publish exec start event
      await eventBus.publish({
        type: 'terminal.exec.start',
        payload: {
          sessionId,
          command,
          execId
        }
      }, EventPriority.NORMAL)

      // Note: SSHService.exec expects connectionId, not sessionId
      // This is a design mismatch that needs to be resolved
      // For now, we'll log the intent
      logger('Would execute command: %s for session %s', command, sessionId)

      // Simulate execution result for now
      const simulatedCode = 0

      // Publish simulated data
      await eventBus.publish({
        type: 'terminal.exec.data',
        payload: {
          sessionId,
          execId,
          type: 'stdout',
          data: `Command "${command}" would be executed\n`
        }
      }, EventPriority.NORMAL)

      // Publish exec exit event
      await eventBus.publish({
        type: 'terminal.exec.exit',
        payload: {
          sessionId,
          execId,
          code: simulatedCode,
          signal: null
        }
      }, EventPriority.NORMAL)

      logger('Command executed for session %s: exit code %d', sessionId, simulatedCode)
    } catch (error) {
      logger('Error executing command for session %s: %O', sessionId, error)

      // Publish error exit
      await eventBus.publish({
        type: 'terminal.exec.exit',
        payload: {
          sessionId,
          execId,
          code: -1,
          signal: null
        }
      }, EventPriority.NORMAL)

      await eventBus.publish({
        type: 'system.error',
        payload: {
          error: error instanceof Error ? error : new Error('Command execution failed'),
          context: 'TerminalHandler.terminal.command',
          sessionId
        }
      }, EventPriority.NORMAL)
    } finally {
      // Clean up tracking
      activeExecs.delete(execId)
    }
  })

  // Handle connection ready - initialize terminal
  eventBus.subscribe('connection.ready', async (event) => {
    if (isEventType(event, 'connection.ready')) {
      const { sessionId, connectionId } = event.payload

      logger('Connection ready, initializing terminal for session %s', sessionId)

      try {
        // Get terminal state from store
        const state = sessionStore.getState(sessionId)
        if (state === undefined) {
          logger('No session state found for %s', sessionId)
          return
        }

        // Initialize terminal
        sessionStore.dispatch(sessionId, {
          type: 'TERMINAL_INIT',
          payload: {
            term: state.terminal.term,
            cols: state.terminal.cols,
            rows: state.terminal.rows,
            environment: state.terminal.environment,
            cwd: state.terminal.cwd
          }
        })

        // Create shell
        const result = await sshService.shell(connectionId, {
          term: state.terminal.term,
          cols: state.terminal.cols,
          rows: state.terminal.rows,
          env: state.terminal.environment
        })

        if (result.ok) {
          logger('Terminal initialized for session %s', sessionId)

          // Set up data forwarding from SSH to client
          result.value.on('data', (data: Buffer) => {
            eventBus.publish({
              type: 'terminal.data.out',
              payload: {
                sessionId,
                data
              }
            }, EventPriority.NORMAL).catch(error => {
              logger('Failed to publish terminal output: %O', error)
            })
          })
        } else {
          logger('Failed to initialize terminal for session %s: %s', sessionId, result.error.message)

          await eventBus.publish({
            type: 'system.error',
            payload: {
              error: result.error,
              context: 'TerminalHandler.connection.ready',
              sessionId,
              connectionId
            }
          }, EventPriority.HIGH)
        }
      } catch (error) {
        logger('Error initializing terminal for session %s: %O', sessionId, error)

        await eventBus.publish({
          type: 'system.error',
          payload: {
            error: error instanceof Error ? error : new Error('Terminal initialization failed'),
            context: 'TerminalHandler.connection.ready',
            sessionId,
            connectionId
          }
        }, EventPriority.HIGH)
      }
    }
  })

  // Handle session destruction - clean up terminal
  eventBus.subscribe('session.destroyed', async (event) => {
    if (isEventType(event, 'session.destroyed')) {
      const { sessionId } = event.payload

      logger('Session destroyed, cleaning up terminal for %s', sessionId)

      try {
        // Destroy terminal
        await terminalService.destroy(sessionId)

        // Cancel any active executions
        for (const [execId, exec] of activeExecs) {
          if (exec.sessionId === String(sessionId)) {
            activeExecs.delete(execId)
          }
        }

        // Dispatch terminal destroy to store
        sessionStore.dispatch(sessionId, {
          type: 'TERMINAL_DESTROY',
          payload: {}
        })

        logger('Terminal cleaned up for session %s', sessionId)
      } catch (error) {
        logger('Error cleaning up terminal for session %s: %O', sessionId, error)
      }
    }
  })

  logger('Terminal event handlers registered')
}

/**
 * Create terminal buffer handler for recording/replay
 */
export function createTerminalBufferHandler(
  eventBus: EventBus,
  bufferSize: number = 10000
): void {
  const terminalBuffers = new Map<string, Array<{ timestamp: number; data: string | Buffer }>>()

  // Buffer terminal output
  eventBus.subscribe('terminal.data.out', (event) => {
    if (isEventType(event, 'terminal.data.out')) {
      const { sessionId, data } = event.payload
      const key = String(sessionId)

      let buffer = terminalBuffers.get(key)
      if (buffer === undefined) {
        buffer = []
        terminalBuffers.set(key, buffer)
      }

      buffer.push({
        timestamp: Date.now(),
        data
      })

      // Limit buffer size
      if (buffer.length > bufferSize) {
        buffer.shift()
      }
    }
  })

  // Clean up buffers on session destroy
  eventBus.subscribe('session.destroyed', (event) => {
    if (isEventType(event, 'session.destroyed')) {
      const { sessionId } = event.payload
      terminalBuffers.delete(String(sessionId))
      logger('Terminal buffer cleared for session %s', sessionId)
    }
  })

  // Handle recording start
  eventBus.subscribe('recording.start', async (event) => {
    if (isEventType(event, 'recording.start')) {
      const { sessionId, recordingId } = event.payload
      const buffer = terminalBuffers.get(String(sessionId))

      if (buffer !== undefined) {
        // Send buffered data to recording
        for (const entry of buffer) {
          await eventBus.publish({
            type: 'recording.data',
            payload: {
              sessionId,
              recordingId,
              timestamp: entry.timestamp,
              data: entry.data.toString()
            }
          }, EventPriority.LOW)
        }
      }

      logger('Recording started for session %s with %d buffered entries',
        sessionId, buffer?.length ?? 0)
    }
  })

  logger('Terminal buffer handler registered')
}

/**
 * Create terminal metrics handler
 */
export function createTerminalMetricsHandler(eventBus: EventBus): void {
  const metrics = {
    dataIn: 0,
    dataOut: 0,
    resizes: 0,
    commands: 0,
    execs: 0
  }

  eventBus.subscribe('terminal.data.in', (event) => {
    if (isEventType(event, 'terminal.data.in')) {
      const data = event.payload.data
      metrics.dataIn += typeof data === 'string' ? data.length : data.length
    }
  })

  eventBus.subscribe('terminal.data.out', (event) => {
    if (isEventType(event, 'terminal.data.out')) {
      const data = event.payload.data
      metrics.dataOut += typeof data === 'string' ? data.length : data.length
    }
  })

  eventBus.subscribe('terminal.resize', () => {
    metrics.resizes++
  })

  eventBus.subscribe('terminal.command', () => {
    metrics.commands++
  })

  eventBus.subscribe('terminal.exec.start', () => {
    metrics.execs++
  })

  // Periodically publish metrics
  setInterval(() => {
    eventBus.publish({
      type: 'system.metrics',
      payload: {
        metric: 'terminal.stats',
        value: 1,
        tags: {
          dataIn: String(metrics.dataIn),
          dataOut: String(metrics.dataOut),
          resizes: String(metrics.resizes),
          commands: String(metrics.commands),
          execs: String(metrics.execs)
        }
      }
    }).catch(error => {
      logger('Failed to publish terminal metrics: %O', error)
    })
  }, 60000) // Every minute

  logger('Terminal metrics handler registered')
}