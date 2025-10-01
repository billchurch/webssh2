import type { Socket } from 'socket.io'
import type { Duplex } from 'node:stream'
import type { Services } from '../../services/interfaces.js'
import type { Config } from '../../types/config.js'
import type { SessionId } from '../../types/branded.js'
import type { UnifiedAuthPipeline } from '../../auth/auth-pipeline.js'
import type { AuthMethod } from '../../auth/providers/auth-provider.interface.js'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
} from '../../types/contracts/v1/socket.js'
import type { StructuredLogger } from '../../logging/structured-logger.js'

export interface SSH2Stream extends Duplex {
  setWindow?(rows: number, cols: number): void
}

export interface AdapterSharedState {
  sessionId: SessionId | null
  connectionId: string | null
  shellStream: SSH2Stream | null
  storedPassword: string | null
  originalAuthMethod: AuthMethod | null
  initialTermSettings: { term?: string; rows?: number; cols?: number }
  clientIp: string | null
  clientPort: number | null
  clientSourcePort: number | null
  targetHost: string | null
  targetPort: number | null
  username: string | null
  userAgent: string | null
}

export interface AdapterContext {
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
  config: Config
  services: Services
  authPipeline: UnifiedAuthPipeline
  state: AdapterSharedState
  debug: (...args: unknown[]) => void
  logger: StructuredLogger
}

export function createAdapterSharedState(): AdapterSharedState {
  return {
    sessionId: null,
    connectionId: null,
    shellStream: null,
    storedPassword: null,
    originalAuthMethod: null,
    initialTermSettings: {},
    clientIp: null,
    clientPort: null,
    clientSourcePort: null,
    targetHost: null,
    targetPort: null,
    username: null,
    userAgent: null
  }
}
