// app/types/websocket.ts
// Type-safe WebSocket event handling

import type { SessionId, EventName } from './branded.js'
import type { SshCredentials, SshTerminalOptions, SshErrorInfo } from './ssh.js'
import type { Result } from './result.js'

/**
 * WebSocket connection state
 */
export enum WebSocketState {
  Connecting = 'connecting',
  Open = 'open',
  Closing = 'closing',
  Closed = 'closed',
}

/**
 * Client-to-server event types
 */
export enum ClientEventType {
  Connect = 'connect',
  Disconnect = 'disconnect',
  Data = 'data',
  Resize = 'resize',
  Ping = 'ping',
  Auth = 'auth',
  Exec = 'exec',
  FileUpload = 'file-upload',
  FileDownload = 'file-download',
  Reconnect = 'reconnect',
}

/**
 * Server-to-client event types
 */
export enum ServerEventType {
  Connected = 'connected',
  Disconnected = 'disconnected',
  Data = 'data',
  Error = 'error',
  Ready = 'ready',
  Pong = 'pong',
  AuthRequired = 'auth-required',
  AuthSuccess = 'auth-success',
  AuthFailed = 'auth-failed',
  ExecResult = 'exec-result',
  FileTransferProgress = 'file-transfer-progress',
  FileTransferComplete = 'file-transfer-complete',
  SessionExpired = 'session-expired',
}

/**
 * Client event payloads
 */
export interface ClientEventPayloads {
  [ClientEventType.Connect]: {
    sessionId?: SessionId
    credentials?: SshCredentials
    terminal?: SshTerminalOptions
    reconnect?: boolean
  }
  [ClientEventType.Disconnect]: {
    sessionId: SessionId
    reason?: string
  }
  [ClientEventType.Data]: {
    sessionId: SessionId
    data: string | ArrayBuffer
  }
  [ClientEventType.Resize]: {
    sessionId: SessionId
    cols: number
    rows: number
    width?: number
    height?: number
  }
  [ClientEventType.Ping]: {
    timestamp: number
  }
  [ClientEventType.Auth]: {
    method: 'password' | 'publickey' | 'keyboard-interactive'
    credentials: Partial<SshCredentials>
  }
  [ClientEventType.Exec]: {
    sessionId: SessionId
    command: string
    pty?: boolean
  }
  [ClientEventType.FileUpload]: {
    sessionId: SessionId
    path: string
    content: ArrayBuffer
    mode?: number
  }
  [ClientEventType.FileDownload]: {
    sessionId: SessionId
    path: string
  }
  [ClientEventType.Reconnect]: {
    sessionId: SessionId
    lastEventId?: string
  }
}

/**
 * Server event payloads
 */
export interface ServerEventPayloads {
  [ServerEventType.Connected]: {
    sessionId: SessionId
    serverVersion?: string
    features?: string[]
  }
  [ServerEventType.Disconnected]: {
    sessionId: SessionId
    reason?: string
    canReconnect?: boolean
  }
  [ServerEventType.Data]: {
    sessionId: SessionId
    data: string | ArrayBuffer
    encoding?: 'utf8' | 'binary'
  }
  [ServerEventType.Error]: {
    sessionId?: SessionId
    error: SshErrorInfo
    recoverable?: boolean
  }
  [ServerEventType.Ready]: {
    sessionId: SessionId
    username?: string
    hostname?: string
  }
  [ServerEventType.Pong]: {
    timestamp: number
    latency: number
  }
  [ServerEventType.AuthRequired]: {
    methods: string[]
    prompt?: string
  }
  [ServerEventType.AuthSuccess]: {
    sessionId: SessionId
  }
  [ServerEventType.AuthFailed]: {
    reason: string
    remainingAttempts?: number
  }
  [ServerEventType.ExecResult]: {
    sessionId: SessionId
    stdout: string
    stderr: string
    exitCode: number | null
  }
  [ServerEventType.FileTransferProgress]: {
    sessionId: SessionId
    transferId: string
    bytesTransferred: number
    totalBytes: number
    percentage: number
  }
  [ServerEventType.FileTransferComplete]: {
    sessionId: SessionId
    transferId: string
    success: boolean
    error?: string
  }
  [ServerEventType.SessionExpired]: {
    sessionId: SessionId
    expiredAt: Date
  }
}

/**
 * Type-safe client event emitter
 */
export interface ClientEventEmitter {
  emit<T extends ClientEventType>(
    event: T,
    payload: ClientEventPayloads[T]
  ): void
  
  on<T extends ClientEventType>(
    event: T,
    handler: (payload: ClientEventPayloads[T]) => void
  ): void
  
  off<T extends ClientEventType>(
    event: T,
    handler: (payload: ClientEventPayloads[T]) => void
  ): void
  
  once<T extends ClientEventType>(
    event: T,
    handler: (payload: ClientEventPayloads[T]) => void
  ): void
}

/**
 * Type-safe server event emitter
 */
export interface ServerEventEmitter {
  emit<T extends ServerEventType>(
    event: T,
    payload: ServerEventPayloads[T]
  ): void
  
  on<T extends ServerEventType>(
    event: T,
    handler: (payload: ServerEventPayloads[T]) => void
  ): void
  
  off<T extends ServerEventType>(
    event: T,
    handler: (payload: ServerEventPayloads[T]) => void
  ): void
  
  once<T extends ServerEventType>(
    event: T,
    handler: (payload: ServerEventPayloads[T]) => void
  ): void
}

/**
 * WebSocket message format
 */
export interface WebSocketMessage<T = unknown> {
  readonly id: string
  readonly type: EventName
  readonly payload: T
  readonly timestamp: number
  readonly version?: string
}

/**
 * WebSocket error codes
 */
export enum WebSocketErrorCode {
  Normal = 1000,
  GoingAway = 1001,
  ProtocolError = 1002,
  UnsupportedData = 1003,
  NoStatus = 1005,
  AbnormalClosure = 1006,
  InvalidPayload = 1007,
  PolicyViolation = 1008,
  MessageTooBig = 1009,
  ExtensionMissing = 1010,
  InternalError = 1011,
  ServiceRestart = 1012,
  TryAgainLater = 1013,
  BadGateway = 1014,
  TlsHandshake = 1015,
}

/**
 * WebSocket close event
 */
export interface WebSocketCloseEvent {
  readonly code: WebSocketErrorCode
  readonly reason: string
  readonly wasClean: boolean
}

/**
 * WebSocket connection options
 */
export interface WebSocketOptions {
  readonly url: string
  readonly protocols?: string[]
  readonly reconnect?: boolean
  readonly reconnectAttempts?: number
  readonly reconnectDelay?: number
  readonly pingInterval?: number
  readonly pongTimeout?: number
  readonly messageQueueSize?: number
  readonly binaryType?: 'blob' | 'arraybuffer'
}

/**
 * WebSocket connection statistics
 */
export interface WebSocketStats {
  readonly messagesReceived: number
  readonly messagesSent: number
  readonly bytesReceived: number
  readonly bytesSent: number
  readonly errors: number
  readonly reconnections: number
  readonly latency?: number
  readonly connectedAt?: Date
  readonly lastActivity?: Date
}

/**
 * WebSocket message validator
 */
export type ValidateMessage<T> = (message: unknown) => Result<WebSocketMessage<T>, Error>

/**
 * WebSocket message handler
 */
export type MessageHandler<T> = (message: WebSocketMessage<T>) => void | Promise<void>

/**
 * WebSocket error handler
 */
export type ErrorHandler = (error: Error) => void

/**
 * WebSocket lifecycle hooks
 */
export interface WebSocketLifecycle {
  readonly beforeConnect?: () => void | Promise<void>
  readonly afterConnect?: () => void | Promise<void>
  readonly beforeDisconnect?: (code: WebSocketErrorCode, reason: string) => void | Promise<void>
  readonly afterDisconnect?: (event: WebSocketCloseEvent) => void | Promise<void>
  readonly beforeSend?: <T>(message: WebSocketMessage<T>) => WebSocketMessage<T> | Promise<WebSocketMessage<T>>
  readonly afterReceive?: <T>(message: WebSocketMessage<T>) => void | Promise<void>
  readonly onError?: (error: Error) => void | Promise<void>
}

/**
 * WebSocket message queue for offline support
 */
export interface MessageQueue<T = unknown> {
  readonly maxSize: number
  readonly messages: ReadonlyArray<WebSocketMessage<T>>
  enqueue(message: WebSocketMessage<T>): void
  dequeue(): WebSocketMessage<T> | undefined
  clear(): void
  flush(send: (message: WebSocketMessage<T>) => void): void
}

/**
 * WebSocket rate limiter
 */
export interface RateLimiter {
  readonly maxMessages: number
  readonly windowMs: number
  canSend(): boolean
  recordSend(): void
  reset(): void
}

/**
 * WebSocket authentication result
 */
export interface WebSocketAuthResult {
  readonly success: boolean
  readonly sessionId?: SessionId
  readonly token?: string
  readonly expiresAt?: Date
  readonly permissions?: string[]
}

/**
 * WebSocket room/channel support
 */
export interface WebSocketRoom {
  readonly id: string
  readonly name: string
  readonly members: ReadonlySet<SessionId>
  join(sessionId: SessionId): void
  leave(sessionId: SessionId): void
  broadcast<T>(message: WebSocketMessage<T>, exclude?: SessionId): void
}

/**
 * WebSocket middleware
 */
export type WebSocketMiddleware<T = unknown> = (
  message: WebSocketMessage<T>,
  next: () => void | Promise<void>
) => void | Promise<void>