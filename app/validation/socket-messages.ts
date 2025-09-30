export type {
  AuthCredentials,
  TerminalConfig,
  ResizeParams,
  ExecCommand
} from './socket/types.js'

export { validateAuthMessage } from './socket/auth.js'
export { validateTerminalMessage } from './socket/terminal.js'
export { validateResizeMessage } from './socket/resize.js'
export { validateExecMessage } from './socket/exec.js'
export { validateControlMessage } from './socket/control.js'
