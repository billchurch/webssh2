export interface AlgorithmsConfig {
  cipher: string[]
  compress: string[]
  hmac: string[]
  kex: string[]
  serverHostKey: string[]
}

export interface SSHConfig {
  host: string | null
  port: number
  term: string
  readyTimeout: number
  keepaliveInterval: number
  keepaliveCountMax: number
  alwaysSendKeyboardInteractivePrompts: boolean
  disableInteractiveAuth: boolean
  algorithms: AlgorithmsConfig
}

export interface HeaderConfig {
  text: string | null
  background: string
}

export interface OptionsConfig {
  challengeButton: boolean
  autoLog: boolean
  allowReauth: boolean
  allowReconnect: boolean
  allowReplay: boolean
}

export interface SessionConfig {
  secret: string
  name: string
}

export interface SsoConfig {
  enabled: boolean
  csrfProtection: boolean
  trustedProxies: string[]
  headerMapping: {
    username: string
    password: string
    session: string
  }
}

export interface Config {
  listen: { ip: string; port: number }
  http: { origins: string[] }
  user: {
    name: string | null
    password: string | null
    privateKey: string | null
    passphrase: string | null
  }
  ssh: SSHConfig
  header: HeaderConfig
  options: OptionsConfig
  session: SessionConfig
  sso: SsoConfig
  getCorsConfig?: () => { origin: string[]; methods: string[]; credentials: boolean }
}
