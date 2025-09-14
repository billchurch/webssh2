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
  createExecOptions,
  mergeEnvironmentVariables,
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

export {
  prepareCredentials,
  createAuthSuccessPayload,
  createAuthFailurePayload,
  createPermissionsPayload,
  buildConnectionString,
  createUIUpdatePayload,
  getConnectionErrorMessage,
  clearSessionOnNetworkError,
  updateSessionCredentials as updateConnectionSessionCredentials,
  clearAuthFailureFlag,
  handleConnectionSuccess,
  handleConnectionFailure,
  type ConnectionCredentials,
  type AuthenticationPayload,
  type PermissionsPayload,
  type UIUpdatePayload,
} from './connection-handler.js'

export {
  isReplayAllowedByConfig,
  getReplayPassword,
  validateReplayRequest,
  formatReplayData,
  shouldUseCRLF,
  writeCredentialsToShell,
  handleReplayCredentials,
  handleReauth,
  handleControlMessage,
  type ControlSession,
  type ReplayOptions,
  type ReplayResult,
} from './control-handler.js'

export {
  isValidCredentialFormat,
  isValidDimension as isValidCredentialDimension,
  parseDimension,
  configureTerminal,
  createCredentialErrorMessage,
  updateSessionCredentials,
  logCredentialUpdate,
  validateAndUpdateCredentials,
  createSessionStateFromCredentials,
  type CredentialUpdate,
  type TerminalConfig,
} from './credential-manager.js'