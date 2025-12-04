import type {
  SftpListRequest,
  SftpStatRequest,
  SftpMkdirRequest,
  SftpDeleteRequest,
  SftpUploadStartRequest,
  SftpUploadChunkRequest,
  SftpUploadCancelRequest,
  SftpDownloadStartRequest,
  SftpDownloadCancelRequest,
  SftpStatusResponse,
  SftpDirectoryResponse,
  SftpStatResponse,
  SftpOperationResponse,
  SftpUploadReadyResponse,
  SftpUploadAckResponse,
  SftpDownloadReadyResponse,
  SftpDownloadChunkResponse,
  SftpProgressResponse,
  SftpCompleteResponse,
  SftpErrorResponse
} from './sftp.js'

// Client → Server: credential authentication
export interface AuthCredentials {
  username: string
  host: string
  port: number
  password?: string
  privateKey?: string
  passphrase?: string
  term?: string
  cols?: number
  rows?: number
}

// Client → Server: terminal settings update
export interface TerminalSettings {
  term?: string
  cols?: number
  rows?: number
  cwd?: string
  env?: Record<string, string>
}

// Client → Server: exec request
export interface ExecRequestPayload {
  command: string
  pty?: boolean
  term?: string
  cols?: number
  rows?: number
  env?: Record<string, string>
  timeoutMs?: number
}

export interface ExecDataPayload {
  type: 'stdout' | 'stderr'
  data: string
}

export interface ExecExitPayload {
  code: number | null
  signal: string | null
}

// Client → Server events
export interface ClientToServerEvents {
  // Send user keystrokes to remote
  data: (chunk: string) => void
  // Terminal resize
  resize: (size: { cols: number; rows: number }) => void
  // Terminal/term settings (optional update)
  terminal: (settings: TerminalSettings) => void
  // Control actions currently supported by server: 'replayCredentials' | 'reauth'
  control: (msg: 'replayCredentials' | 'reauth') => void
  // Interactive authentication
  authenticate: (creds: AuthCredentials) => void
  // Single-command execution
  exec: (payload: ExecRequestPayload) => void
  // SFTP operations
  'sftp-list': (request: SftpListRequest) => void
  'sftp-stat': (request: SftpStatRequest) => void
  'sftp-mkdir': (request: SftpMkdirRequest) => void
  'sftp-delete': (request: SftpDeleteRequest) => void
  'sftp-upload-start': (request: SftpUploadStartRequest) => void
  'sftp-upload-chunk': (request: SftpUploadChunkRequest) => void
  'sftp-upload-cancel': (request: SftpUploadCancelRequest) => void
  'sftp-download-start': (request: SftpDownloadStartRequest) => void
  'sftp-download-cancel': (request: SftpDownloadCancelRequest) => void
}

// Server → Client: authentication protocol messages
export type AuthenticationEvent =
  | { action: 'request_auth' }
  | { action: 'auth_result'; success: boolean; message?: string }
  | {
      action: 'keyboard-interactive'
      name?: string
      instructions?: string
      prompts?: Array<{ prompt: string; echo: boolean }>
    }
  | { action: 'reauth' }

// Server → Client events
export interface ServerToClientEvents {
  // Stream data
  data: (chunk: string) => void
  // Auth flow
  authentication: (payload: AuthenticationEvent) => void
  authFailure: (payload: { error: string; method: string }) => void
  // Permissions negotiated post-auth
  permissions: (p: {
    autoLog: boolean
    allowReplay: boolean
    allowReconnect: boolean
    allowReauth: boolean
  }) => void
  // UI updates (element + value)
  updateUI: (payload: { element: string; value: unknown }) => void
  // Request client to open terminal
  getTerminal: (open: boolean) => void
  // Exec streaming
  'exec-data': (payload: ExecDataPayload) => void
  'exec-exit': (payload: ExecExitPayload) => void
  // Error channels
  ssherror: (message: string) => void
  error?: (message: string) => void
  // SFTP responses
  'sftp-status': (response: SftpStatusResponse) => void
  'sftp-directory': (response: SftpDirectoryResponse) => void
  'sftp-stat-result': (response: SftpStatResponse) => void
  'sftp-operation-result': (response: SftpOperationResponse) => void
  'sftp-upload-ready': (response: SftpUploadReadyResponse) => void
  'sftp-upload-ack': (response: SftpUploadAckResponse) => void
  'sftp-download-ready': (response: SftpDownloadReadyResponse) => void
  'sftp-download-chunk': (response: SftpDownloadChunkResponse) => void
  'sftp-progress': (response: SftpProgressResponse) => void
  'sftp-complete': (response: SftpCompleteResponse) => void
  'sftp-error': (response: SftpErrorResponse) => void
}

export interface InterServerEvents {}

export interface SocketData {
  sessionId?: string
}
