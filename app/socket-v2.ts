// app/socket-v2.ts
// Refactored WebSSH2Socket using pure handlers and I/O adapters

import type { Server as IOServer } from 'socket.io'
import { createNamespacedDebug } from './logger.js'
import { SocketAdapter } from './socket/adapters/socket-adapter.js'
import { ServiceSocketAdapter } from './socket/adapters/service-socket-adapter.js'
import { SSHConnectionAdapter } from './ssh/connection-adapter.js'
import type { Config } from './types/config.js'
import type { Services } from './services/interfaces.js'
import type { SessionStore } from './state/store.js'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  AuthCredentials,
  TerminalSettings,
} from './types/contracts/v1/socket.js'
import type { SSHCtor } from './types/ssh.js'
import { handleControlMessage } from './socket/control-handler.js'

const debug = createNamespacedDebug('socket:v2')

/**
 * Initialize Socket.IO with the new handler/adapter architecture
 */
export default function init(
  io: IOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  config: Config,
  SSHConnectionClass: SSHCtor,
  services?: Services,
  store?: SessionStore
): void {
  debug('V2 socket init() called - registering connection handler')
  io.on('connection', (socket) => {
    debug(`V2 connection handler triggered for socket ${socket.id}`)
    
    // Use service-based adapter if services are available
    if (services !== undefined && store !== undefined) {
      debug('Using service-based socket adapter')
      // ServiceSocketAdapter sets up all handlers in its constructor
      const serviceAdapter = new ServiceSocketAdapter(socket, config, services, store)
      // Keep reference to prevent GC (adapter manages its own lifecycle via socket events)
      void serviceAdapter //NOSONAR
      return
    }
    
    // Otherwise use the legacy adapters
    debug('Using legacy adapters (no services provided)')
    const socketAdapter = new SocketAdapter(socket, config)
    const sshAdapter = new SSHConnectionAdapter(config, SSHConnectionClass)
    
    // Create handlers that bridge between adapters
    const handlers = {
      // Handle authentication
      async onAuth(credentials: AuthCredentials, _state: SessionState): Promise<void> {
        try {
          // Connect SSH
          const connectionResult = await sshAdapter.connect(credentials)
          
          if (connectionResult.success) {
            // Emit success events
            socketAdapter.emitAuthSuccess()
            socketAdapter.emitPermissions()
            socketAdapter.emitGetTerminal(true)

            // Update UI with connection info
            const connectionString = `ssh://${credentials.host}:${credentials.port}`
            socketAdapter.emitUIUpdate('footer', connectionString)

            // Emit Connected status that tests expect
            socketAdapter.emitUIUpdate('status', 'Connected')

            debug(`Authentication successful for ${socket.id}`)
          } else {
            socketAdapter.emitAuthFailure(connectionResult.error ?? 'Connection failed')
            debug(`Authentication failed for ${socket.id}: ${connectionResult.error}`)
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          socketAdapter.emitAuthFailure(errorMessage)
          debug(`Authentication error for ${socket.id}: ${errorMessage}`)
        }
      },
      
      // Handle terminal setup
      async onTerminal(_settings: TerminalSettings, _state: SessionState): Promise<void> {
        const terminalState = socketAdapter.getTerminalState()
        if (terminalState == null || !sshAdapter.isConnected()) {
          debug(`Terminal setup failed - no terminal state or not connected`)
          return
        }
        
        // Get session environment variables
        const req = socket.request as { session?: { envVars?: Record<string, string> } }
        const sessionEnv = req.session?.envVars ?? {}
        
        // Create shell with terminal settings
        const shellResult = await sshAdapter.shell(
          {
            term: terminalState.term,
            cols: terminalState.cols,
            rows: terminalState.rows,
          },
          sessionEnv
        )
        
        if (shellResult.success && shellResult.stream != null) {
          // Setup stream handlers
          socketAdapter.setShellStream(shellResult.stream)
          
          // Setup data forwarding from client to shell
          const onClientData = (chunk: string): void => {
            try {
              shellResult.stream?.write?.(chunk)
            } catch (error) {
              debug(`Error writing to shell: ${error}`)
            }
          }
          
          socket.on('data', onClientData)
          
          // Cleanup on stream close
          shellResult.stream.on('close', () => {
            socket.off('data', onClientData)
          })
          
          debug(`Shell created successfully for ${socket.id}`)
        } else {
          socketAdapter.emitError(shellResult.error ?? 'Failed to create shell')
          debug(`Shell creation failed for ${socket.id}: ${shellResult.error}`)
        }
      },
      
      // Handle command execution
      async onExec(payload: unknown, state: SessionState): Promise<void> {
        if (!sshAdapter.isConnected()) {
          socketAdapter.emitError('SSH not connected')
          return
        }
        
        // Parse and validate exec request
        const { handleExecRequest } = await import('./socket/handlers/exec-handler.js')
        const req = socket.request as { session?: { envVars?: Record<string, string> } }
        const sessionEnv = req.session?.envVars ?? {}

        const execResult = handleExecRequest(
          payload,
          state.term,
          state.cols,
          state.rows,
          sessionEnv
        )
        
        if (!execResult.success || execResult.state == null) {
          socketAdapter.emitError(execResult.error ?? 'Invalid exec request')
          return
        }
        
        // Execute command
        const streamResult = await sshAdapter.exec(
          execResult.state.command,
          execResult.options ?? {},
          execResult.env
        )
        
        if (streamResult.success && streamResult.stream != null) {
          socketAdapter.setupExecStreamHandlers(streamResult.stream)
          debug(`Exec started for ${socket.id}: ${execResult.state.command}`)
        } else {
          socketAdapter.emitError(streamResult.error ?? 'Exec failed')
          debug(`Exec failed for ${socket.id}: ${streamResult.error}`)
        }
      },
      
      // Handle terminal resize
      onResize(size: { cols: number; rows: number }): void {
        if (sshAdapter.isConnected()) {
          sshAdapter.resizeTerminal(size.rows, size.cols)
          debug(`Terminal resized for ${socket.id}: ${size.cols}x${size.rows}`)
        }
      },
      
      // Handle client data (keystrokes)
      onData(_chunk: string): void {
        // This is handled in onTerminal for the shell stream
        // Left here for completeness
      },
      
      // Handle control messages
      onControl(msg: string): void {
        const state = socketAdapter.getSessionState()
        const shellStream = socketAdapter.getShellStream()

        // Create session state compatible with control handler
        const sessionState = {
          password: state.password
        }

        // Use the control message handler
        handleControlMessage(
          socket,
          config,
          sessionState,
          shellStream,
          msg
        )
      },
      
      // Handle disconnect
      onDisconnect(reason: string): void {
        // Clean up SSH connection
        sshAdapter.end()
        debug(`Socket disconnected: ${socket.id}, reason: ${reason}`)
      },
    }
    
    // Set handlers on the adapter
    socketAdapter.setHandlers(handlers)
    
    debug(`WebSSH2Socket v2 initialized for ${socket.id}`)
  })
}

// Re-export types for compatibility
import type { SessionState } from './socket/handlers/auth-handler.js'