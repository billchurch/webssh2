// app/socket/index.ts
// Central exports for socket handlers

export {
  handleSocketAuth,
  type AuthResult,
} from './auth-handler.js'

export {
  createShell,
  handleResize,
  normalizeDimension,
  type ShellOptions,
  type ResizeDimensions,
} from './shell-handler.js'

export {
  executeCommand,
  parseExecPayload,
  type ExecOptions,
  type ExecResult,
} from './exec-handler.js'

export {
  isReplayAllowed,
  getReplayCredentials,
  isReconnectAllowed,
  getReplayCRLF,
  type ReplaySession,
} from './replay-handler.js'