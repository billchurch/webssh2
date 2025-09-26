/**
 * Terminal service implementation
 */

import type {
  TerminalService,
  Terminal,
  TerminalOptions,
  Dimensions,
  ServiceDependencies
} from '../interfaces.js'
import type { SessionId } from '../../types/branded.js'
import type { Result } from '../../state/types.js'
import { ok, err } from '../../state/types.js'
import type { SessionStore } from '../../state/store.js'
import debug from 'debug'

const logger = debug('webssh2:services:terminal')

/**
 * Terminal registry for managing terminal instances
 */
class TerminalRegistry {
  private readonly terminals = new Map<SessionId, Terminal>()

  add(terminal: Terminal): void {
    this.terminals.set(terminal.sessionId, terminal)
  }

  get(sessionId: SessionId): Terminal | undefined {
    return this.terminals.get(sessionId)
  }

  remove(sessionId: SessionId): void {
    this.terminals.delete(sessionId)
  }

  clear(): void {
    this.terminals.clear()
  }

  getAll(): Terminal[] {
    return Array.from(this.terminals.values())
  }
}

export class TerminalServiceImpl implements TerminalService {
  private readonly registry = new TerminalRegistry()
  private readonly defaultRows: number
  private readonly defaultCols: number
  private readonly defaultTerm: string

  constructor(
    private readonly deps: ServiceDependencies,
    private readonly store: SessionStore
  ) {
    const terminalConfig = deps.config.terminal ?? {}
    this.defaultRows = terminalConfig.rows ?? 24
    this.defaultCols = terminalConfig.cols ?? 80
    this.defaultTerm = terminalConfig.term ?? 'xterm-256color'
  }

  /**
   * Create a terminal
   */
  create(options: TerminalOptions): Result<Terminal> {
    try {
      logger('Creating terminal for session:', options.sessionId)

      // Check if terminal already exists
      const existing = this.registry.get(options.sessionId)
      if (existing !== undefined) {
        logger('Terminal already exists for session:', options.sessionId)
        return ok(existing)
      }

      // Create terminal instance
      const terminal: Terminal = {
        id: `term-${options.sessionId}`,
        sessionId: options.sessionId,
        term: options.term ?? this.defaultTerm,
        rows: options.rows ?? this.defaultRows,
        cols: options.cols ?? this.defaultCols,
        env: options.env ?? {}
      }

      // Add to registry
      this.registry.add(terminal)

      // Update store state
      this.store.dispatch(options.sessionId, {
        type: 'TERMINAL_INIT',
        payload: {
          term: terminal.term,
          rows: terminal.rows,
          cols: terminal.cols,
          environment: terminal.env,
          cwd: options.cwd ?? null
        }
      })

      logger('Terminal created:', terminal.id)
      return ok(terminal)
    } catch (error) {
      logger('Failed to create terminal:', error)
      return err(error instanceof Error ? error : new Error('Failed to create terminal'))
    }
  }

  /**
   * Resize terminal
   */
  resize(sessionId: SessionId, dimensions: Dimensions): Result<void> {
    try {
      const terminal = this.registry.get(sessionId)
      if (terminal === undefined) {
        return err(new Error('Terminal not found'))
      }

      logger('Resizing terminal:', terminal.id, dimensions)

      // Validate dimensions
      if (dimensions.rows <= 0 || dimensions.cols <= 0) {
        return err(new Error('Invalid terminal dimensions'))
      }

      if (dimensions.rows > 1000 || dimensions.cols > 1000) {
        return err(new Error('Terminal dimensions too large'))
      }

      // Update terminal
      terminal.rows = dimensions.rows
      terminal.cols = dimensions.cols

      // Update store state
      this.store.dispatch(sessionId, {
        type: 'TERMINAL_RESIZE',
        payload: dimensions
      })

      logger('Terminal resized:', terminal.id)
      return ok(undefined)
    } catch (error) {
      logger('Failed to resize terminal:', error)
      return err(error instanceof Error ? error : new Error('Failed to resize terminal'))
    }
  }

  /**
   * Write to terminal
   * Note: This updates metadata only - actual data handling is done by streams
   */
  write(sessionId: SessionId, _data: string): Result<void> {
    try {
      const terminal = this.registry.get(sessionId)
      if (terminal === undefined) {
        return err(new Error('Terminal not found'))
      }

      // Update activity timestamp in store
      const state = this.store.getState(sessionId)
      if (state !== undefined) {
        // Dispatch a metadata update to track activity
        this.store.dispatch(sessionId, {
          type: 'METADATA_UPDATE',
          payload: {
            updatedAt: Date.now()
          }
        })
      }

      return ok(undefined)
    } catch (error) {
      logger('Failed to write to terminal:', error)
      return err(error instanceof Error ? error : new Error('Failed to write to terminal'))
    }
  }

  /**
   * Destroy terminal
   */
  destroy(sessionId: SessionId): Result<void> {
    try {
      const terminal = this.registry.get(sessionId)
      if (terminal === undefined) {
        return err(new Error('Terminal not found'))
      }

      logger('Destroying terminal:', terminal.id)

      // Remove from registry
      this.registry.remove(sessionId)

      // Update store state if session exists
      const state = this.store.getState(sessionId)
      if (state !== undefined) {
        this.store.dispatch(sessionId, {
          type: 'TERMINAL_DESTROY',
          payload: {}
        })
      }

      logger('Terminal destroyed:', terminal.id)
      return ok(undefined)
    } catch (error) {
      logger('Failed to destroy terminal:', error)
      return err(error instanceof Error ? error : new Error('Failed to destroy terminal'))
    }
  }

  /**
   * Get terminal info
   */
  getTerminal(sessionId: SessionId): Result<Terminal | null> {
    try {
      const terminal = this.registry.get(sessionId)
      return ok(terminal ?? null)
    } catch (error) {
      logger('Failed to get terminal:', error)
      return err(error instanceof Error ? error : new Error('Failed to get terminal'))
    }
  }

  /**
   * Update terminal environment
   */
  updateEnvironment(sessionId: SessionId, env: Record<string, string>): Result<void> {
    try {
      const terminal = this.registry.get(sessionId)
      if (terminal === undefined) {
        return err(new Error('Terminal not found'))
      }

      logger('Updating terminal environment:', terminal.id)

      // Merge environment variables
      terminal.env = { ...terminal.env, ...env }

      // Update store state
      this.store.dispatch(sessionId, {
        type: 'TERMINAL_UPDATE_ENV',
        payload: { environment: terminal.env }
      })

      return ok(undefined)
    } catch (error) {
      logger('Failed to update environment:', error)
      return err(error instanceof Error ? error : new Error('Failed to update environment'))
    }
  }

  /**
   * Get all terminals
   */
  getAllTerminals(): Terminal[] {
    return this.registry.getAll()
  }

  /**
   * Clean up all terminals
   */
  cleanup(): void {
    logger('Cleaning up all terminals')
    const terminals = this.registry.getAll()
    for (const terminal of terminals) {
      this.destroy(terminal.sessionId)
    }
    this.registry.clear()
  }
}