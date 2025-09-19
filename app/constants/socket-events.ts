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
} as const

export type SocketEventType = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS]