// app/types/config.ts
export interface SSHConfig {
  host: string | null
  port: number
  term: string
  readyTimeout: number
  keepaliveInterval: number
  keepaliveCountMax: number
  disableInteractiveAuth: boolean
  alwaysSendKeyboardInteractivePrompts: boolean
  algorithms: {
    cipher: string[]
    compress: string[]
    hmac: string[]
    kex: string[]
    serverHostKey: string[]
  }
}

export interface WebSSH2Config {
  listen: {
    ip: string
    port: number
  }
  http: {
    origins: string[]
  }
  user: {
    name: string | null
    password: string | null
    privateKey: string | null
    passphrase?: string | null
  }
  ssh: SSHConfig
  useminified?: boolean
  header?: {
    text: string | null
    background?: string
  }
  session?: {
    secret?: string
  }
}

export interface SSHCredentials {
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  host: string
  port: number
  term?: string
}

export interface SessionState {
  authenticated: boolean
  username: string | null
  password: string | null
  privateKey: string | null
  passphrase: string | null
  host: string | null
  port: number | null
  term: string | null
  cols: number | null
  rows: number | null
}
