// Socket event names used throughout the application
// app/constants/socket-events.ts

export const SOCKET_EVENTS = {
  // Client to Server events
  AUTH: 'authenticate',
  TERMINAL: 'terminal',
  EXEC: 'exec',
  RESIZE: 'resize',
  DATA: 'data',
  DISCONNECT: 'disconnect',
  CONTROL: 'control',
  REPLAY_CREDENTIALS: 'replayCredentials',
  
  // Server to Client events
  SSH_ERROR: 'ssherror',
  SSH_DATA: 'data',
  SSH_DISCONNECT: 'disconnect',
  SSH_READY: 'ready',
  SSH_BANNER: 'banner',
  SSH_END: 'end',
  SSH_CLOSE: 'close',
  SSH_AUTH_FAILURE: 'authFailure',
  AUTH_SUCCESS: 'authentication',
  READY: 'ready',
  EXEC_RESULT: 'exec-result',

  // Application events
  AUTHENTICATION: 'authentication',
  PERMISSIONS: 'permissions',
  GET_TERMINAL: 'getTerminal',
  UPDATE_UI: 'updateUI',

  // Exec events
  EXEC_DATA: 'exec-data',
  EXEC_EXIT: 'exec-exit',

  // Terminal events
  TERMINAL_READY: 'terminalReady',
  TERMINAL_DATA: 'terminalData',
  TERMINAL_ERROR: 'terminalError',

  // SFTP Client → Server events
  SFTP_LIST: 'sftp-list',
  SFTP_STAT: 'sftp-stat',
  SFTP_MKDIR: 'sftp-mkdir',
  SFTP_DELETE: 'sftp-delete',
  SFTP_UPLOAD_START: 'sftp-upload-start',
  SFTP_UPLOAD_CHUNK: 'sftp-upload-chunk',
  SFTP_UPLOAD_CANCEL: 'sftp-upload-cancel',
  SFTP_DOWNLOAD_START: 'sftp-download-start',
  SFTP_DOWNLOAD_CANCEL: 'sftp-download-cancel',

  // SFTP Server → Client events
  SFTP_STATUS: 'sftp-status',
  SFTP_DIRECTORY: 'sftp-directory',
  SFTP_STAT_RESULT: 'sftp-stat-result',
  SFTP_OPERATION_RESULT: 'sftp-operation-result',
  SFTP_UPLOAD_READY: 'sftp-upload-ready',
  SFTP_UPLOAD_ACK: 'sftp-upload-ack',
  SFTP_DOWNLOAD_READY: 'sftp-download-ready',
  SFTP_DOWNLOAD_CHUNK: 'sftp-download-chunk',
  SFTP_PROGRESS: 'sftp-progress',
  SFTP_COMPLETE: 'sftp-complete',
  SFTP_ERROR: 'sftp-error',

  // Prompt system events
  /** Server → Client: Send a prompt to the client */
  PROMPT: 'prompt',
  /** Client → Server: Response to a prompt */
  PROMPT_RESPONSE: 'prompt-response',

  // Connection error events
  /** Server → Client: Structured connection error with debug info */
  CONNECTION_ERROR: 'connection-error',
} as const

export type SocketEventType = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS]