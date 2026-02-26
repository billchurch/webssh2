/**
 * TelnetServiceImpl - Full ProtocolService implementation for telnet.
 *
 * Assembles TelnetNegotiator (IAC handling), TelnetAuthenticator
 * (expect-style login), and TelnetConnectionPool into a unified
 * service that can connect, open a shell, resize, and disconnect.
 *
 * Key difference from SSH:
 *   SSH: connect() authenticates -> shell() opens a channel
 *   Telnet: connect() establishes TCP -> shell() returns a stream
 *           that handles IAC negotiation + optional auth inline
 */

import type {
  ProtocolService,
  ProtocolConnection,
  TelnetConnectionConfig,
  ShellOptions,
  ServiceDependencies,
} from '../interfaces.js'
import { type ConnectionId, createConnectionId } from '../../types/branded.js'
import { type Result, ok, err } from '../../state/types.js'
import { Duplex } from 'node:stream'
import { TelnetConnectionPool, type TelnetConnection } from './telnet-connection-pool.js'
import { TelnetNegotiator } from './telnet-negotiation.js'
import { TelnetAuthenticator, type TelnetAuthOptions } from './telnet-auth.js'
import { randomUUID } from 'node:crypto'
import { Socket as NetSocket } from 'node:net'
import debug from 'debug'

const logger = debug('webssh2:services:telnet')

/**
 * Per-connection metadata not stored on the pool interface.
 * Tracks auth config needed to build the authenticator in shell().
 */
interface ConnectionMeta {
  config: TelnetConnectionConfig
}

// ── ShellDuplex ────────────────────────────────────────────────────────

/**
 * A proper Duplex stream for the telnet shell.
 *
 * Writable side (client -> server): forwards data to the net.Socket.
 * Readable side (server -> client): receives IAC-stripped data via pushData().
 */
class ShellDuplex extends Duplex {
  private readonly socket: NetSocket

  constructor(socket: NetSocket) {
    super()
    this.socket = socket
  }

  /**
   * Push data to the readable side (called by the telnet data handler).
   */
  pushData(chunk: Buffer): void {
    this.push(chunk)
  }

  override _write(
    chunk: Buffer,
    _encoding: string,
    callback: (error?: Error | null) => void,
  ): void {
    this.socket.write(chunk, callback)
  }

  override _read(_size: number): void {
    // Data is pushed via pushData() from the socket data handler.
    // No pull-based reading needed.
  }

  override _destroy(
    _error: Error | null,
    callback: (error?: Error | null) => void,
  ): void {
    callback(null)
  }
}

// ── TelnetServiceImpl ──────────────────────────────────────────────────

export class TelnetServiceImpl implements ProtocolService {
  private readonly pool = new TelnetConnectionPool()
  private readonly meta = new Map<ConnectionId, ConnectionMeta>()

  constructor(private readonly deps: ServiceDependencies) {}

  /**
   * Establish a TCP connection to the telnet server.
   *
   * Unlike SSH, authentication is NOT performed here. It happens
   * inside the shell stream via the optional TelnetAuthenticator.
   */
  async connect(config: TelnetConnectionConfig): Promise<Result<ProtocolConnection>> {
    const connectionId = createConnectionId(randomUUID())

    return new Promise((resolve) => {
      const socket = new NetSocket()
      let settled = false

      const settle = (result: Result<ProtocolConnection>): void => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        resolve(result)
      }

      const timer = setTimeout(() => {
        socket.destroy()
        settle(err(new Error('Connection timed out')))
      }, config.timeout)

      socket.on('error', (error: Error) => {
        socket.destroy()
        settle(err(error))
      })

      socket.connect({ host: config.host, port: config.port }, () => {
        logger('TCP connection established to %s:%d', config.host, config.port)

        // Pause the socket so data is buffered until shell() attaches listeners
        socket.pause()

        const connection: TelnetConnection = {
          id: connectionId,
          sessionId: config.sessionId,
          protocol: 'telnet',
          status: 'connected',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          host: config.host,
          port: config.port,
          socket,
        }

        if (config.username !== undefined) {
          connection.username = config.username
        }

        this.pool.add(connection)
        this.meta.set(connectionId, { config })
        settle(ok(connection))
      })
    })
  }

  /**
   * Open a shell stream for an existing telnet connection.
   *
   * Returns a Duplex stream where:
   *   write() (client -> server): forwards data to net.Socket
   *   data event (server -> client): IAC-stripped, auth-processed data
   */
  async shell(
    connectionId: ConnectionId,
    options: ShellOptions,
  ): Promise<Result<Duplex>> {
    const connection = this.pool.get(connectionId)
    if (connection === undefined) {
      return Promise.resolve(err(new Error('Connection not found')))
    }

    const negotiator = new TelnetNegotiator(options.term ?? 'xterm-256color')
    negotiator.setWindowSize(options.cols ?? 80, options.rows ?? 24)
    connection.negotiator = negotiator

    const socket = connection.socket
    const shellStream = new ShellDuplex(socket)

    // Build optional authenticator from stored config
    const authenticator = this.buildAuthenticator(connectionId)
    if (authenticator !== null) {
      connection.authenticator = authenticator
    }

    // ── Readable side: server -> client ──────────────────────────
    const handleSocketData = createSocketDataHandler(
      connection,
      negotiator,
      authenticator,
      shellStream,
      socket,
    )

    socket.on('data', handleSocketData)

    // Start auth timeout if authenticator is present
    if (authenticator !== null) {
      authenticator.startTimeout((bufferedData) => {
        if (bufferedData.length > 0) {
          shellStream.pushData(bufferedData)
        }
      })
    }

    // Clean up on stream close
    const cleanup = (): void => {
      socket.removeListener('data', handleSocketData)
      if (authenticator !== null) {
        authenticator.destroy()
      }
    }

    shellStream.on('close', cleanup)
    shellStream.on('error', cleanup)
    socket.on('close', () => {
      cleanup()
      if (!shellStream.destroyed) {
        shellStream.destroy()
      }
    })
    socket.on('error', () => {
      cleanup()
      if (!shellStream.destroyed) {
        shellStream.destroy()
      }
    })

    // Send initial NAWS if dimensions provided
    if (options.cols !== undefined && options.rows !== undefined) {
      socket.write(negotiator.encodeNaws(options.cols, options.rows))
    }

    // Resume the socket now that we have data listeners attached
    socket.resume()

    return Promise.resolve(ok(shellStream))
  }

  /**
   * Resize the terminal window (send NAWS subnegotiation).
   */
  resize(connectionId: ConnectionId, rows: number, cols: number): Result<void> {
    const connection = this.pool.get(connectionId)
    if (connection === undefined) {
      return err(new Error('Connection not found'))
    }

    const negotiator = connection.negotiator
    if (negotiator === undefined) {
      return err(new Error('Negotiator not initialized (shell not opened)'))
    }

    negotiator.setWindowSize(cols, rows)
    connection.socket.write(negotiator.encodeNaws(cols, rows))
    return ok(undefined)
  }

  /**
   * Disconnect a telnet connection.
   */
  disconnect(connectionId: ConnectionId): Promise<Result<void>> {
    const connection = this.pool.get(connectionId)
    if (connection === undefined) {
      return Promise.resolve(ok(undefined))
    }

    logger('Disconnecting telnet connection %s', connectionId)

    if (connection.authenticator !== undefined) {
      connection.authenticator.destroy()
    }

    connection.socket.destroy()
    this.pool.remove(connectionId)
    this.meta.delete(connectionId)

    return Promise.resolve(ok(undefined))
  }

  /**
   * Get the status of a connection.
   */
  getConnectionStatus(connectionId: ConnectionId): Result<ProtocolConnection | null> {
    const connection = this.pool.get(connectionId)
    return ok(connection ?? null)
  }

  // ── Private helpers ────────────────────────────────────────────────

  /**
   * Build a TelnetAuthenticator from stored config if auth options
   * (loginPrompt + username) were provided during connect().
   */
  private buildAuthenticator(connectionId: ConnectionId): TelnetAuthenticator | null {
    const meta = this.meta.get(connectionId)
    if (meta === undefined) {
      return null
    }

    const { config } = meta

    if (config.loginPrompt === undefined || config.username === undefined) {
      return null
    }

    const authOptions: TelnetAuthOptions = {
      username: config.username,
      loginPrompt: config.loginPrompt,
      expectTimeout: config.expectTimeout ?? 10000,
    }

    if (config.password !== undefined) {
      authOptions.password = config.password
    }
    if (config.passwordPrompt !== undefined) {
      authOptions.passwordPrompt = config.passwordPrompt
    }
    if (config.failurePattern !== undefined) {
      authOptions.failurePattern = config.failurePattern
    }

    return new TelnetAuthenticator(authOptions)
  }
}

// ── Module-level helpers ─────────────────────────────────────────────

/**
 * Check if authenticator has completed (authenticated or pass-through).
 */
function isAuthComplete(auth: TelnetAuthenticator): boolean {
  return auth.state === 'authenticated'
    || auth.state === 'pass-through'
    || auth.state === 'failed'
}

/**
 * Create a socket data handler that processes inbound telnet data.
 *
 * Runs data through the IAC negotiator, sends negotiation responses
 * back to the socket, and optionally processes through the authenticator
 * before pushing clean data to the shell stream.
 */
function createSocketDataHandler(
  connection: TelnetConnection,
  negotiator: TelnetNegotiator,
  authenticator: TelnetAuthenticator | null,
  shellStream: ShellDuplex,
  socket: NetSocket,
): (data: Buffer) => void {
  return (data: Buffer): void => {
    connection.lastActivity = Date.now()
    const { cleanData, responses } = negotiator.processInbound(data)

    for (const response of responses) {
      socket.write(response)
    }

    if (cleanData.length === 0) {
      return
    }

    if (authenticator !== null && !isAuthComplete(authenticator)) {
      const authResult = authenticator.processData(cleanData)
      if (authResult.writeToSocket !== null) {
        socket.write(authResult.writeToSocket)
      }
      if (authResult.forwardToClient !== null && authResult.forwardToClient.length > 0) {
        shellStream.pushData(authResult.forwardToClient)
      }
      return
    }

    shellStream.pushData(cleanData)
  }
}
