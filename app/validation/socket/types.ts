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
}

export interface TerminalConfig {
  term?: string
  rows: number
  cols: number
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
