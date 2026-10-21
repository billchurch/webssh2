export interface AuthCredentials {
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  host: string
  port: number
  term?: string
  cols?: number
  rows?: number
  forwardAllKeyboardInteractivePrompts?: boolean
}

export interface TerminalConfig {
  term?: string
  rows: number
  cols: number
}

export interface TerminalSettingsUpdate {
  term?: string
  rows?: number
  cols?: number
}

export interface ResizeParams {
  rows: number
  cols: number
}

export interface ExecCommand {
  command: string
  env?: Record<string, string>
  pty?: boolean
  term?: string
  cols?: number
  rows?: number
  timeoutMs?: number
}

export type AuthenticateMessage =
  | { kind: 'credentials'; credentials: AuthCredentials }
  | { kind: 'keyboard-interactive'; responses: string[] }
