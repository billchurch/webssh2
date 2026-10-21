export type {
  AuthCredentials,
  TerminalConfig,
  ResizeParams,
  ExecCommand
} from './socket/types.js'
export type { ControlAction } from './socket/fields.js'

export { validateAuthMessage, validateAuthenticateMessage } from './socket/auth.js'
export { validateTerminalMessage, validateTerminalSettingsMessage } from './socket/terminal.js'
export { validateResizeMessage } from './socket/resize.js'
export { validateExecMessage, validateExecRequestMessage } from './socket/exec.js'
export { validateControlMessage } from './socket/control.js'
export { validateDataMessage } from './socket/data.js'
