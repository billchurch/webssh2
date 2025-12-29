import type { AuthCredentials, TerminalSettings } from '../../types/contracts/v1/socket.js'
import type { Config } from '../../types/config.js'
import { createConnectionId, type SessionId } from '../../types/branded.js'
import type { Services, KeyboardInteractiveHandler } from '../../services/interfaces.js'
import { TERMINAL_DEFAULTS } from '../../constants/terminal.js'
import type { AdapterContext } from './service-socket-shared.js'

type OptionalCredentials = Pick<AuthCredentials, 'password' | 'privateKey' | 'passphrase'>

/**
 * Options for keyboard-interactive authentication handling
 */
export interface KeyboardInteractiveOptions {
  /** Handler callback for forwarding prompts to the client */
  onKeyboardInteractive?: KeyboardInteractiveHandler
  /** When true, all prompts are forwarded (bypasses auto-password for first round) */
  forwardAllPrompts?: boolean
}

function mapOptionalCredentials(credentials: OptionalCredentials): Partial<OptionalCredentials> {
  const result: Partial<OptionalCredentials> = {}

  if (credentials.password !== undefined && credentials.password !== '') {
    result.password = credentials.password
  }

  if (credentials.privateKey !== undefined && credentials.privateKey !== '') {
    result.privateKey = credentials.privateKey
  }

  if (credentials.passphrase !== undefined && credentials.passphrase !== '') {
    result.passphrase = credentials.passphrase
  }

  return result
}

export function buildSSHConfig(
  credentials: AuthCredentials,
  sessionId: SessionId,
  config: Config,
  keyboardInteractiveOptions?: KeyboardInteractiveOptions
): Parameters<Services['ssh']['connect']>[0] {
  const algorithms: Record<string, string[]> = {
    cipher: config.ssh.algorithms.cipher,
    compress: config.ssh.algorithms.compress,
    hmac: config.ssh.algorithms.hmac,
    kex: config.ssh.algorithms.kex,
    serverHostKey: config.ssh.algorithms.serverHostKey
  }

  const optionalCreds = mapOptionalCredentials(credentials)

  // Determine forwardAllPrompts from credentials or options
  const forwardAllPrompts = credentials.forwardAllKeyboardInteractivePrompts === true ||
    keyboardInteractiveOptions?.forwardAllPrompts === true

  const result: Parameters<Services['ssh']['connect']>[0] = {
    sessionId,
    host: credentials.host,
    port: credentials.port,
    username: credentials.username,
    readyTimeout: config.ssh.readyTimeout,
    keepaliveInterval: config.ssh.keepaliveInterval,
    algorithms,
    ...optionalCreds
  }

  // Add keyboard-interactive options if handler provided
  if (keyboardInteractiveOptions?.onKeyboardInteractive !== undefined) {
    result.onKeyboardInteractive = keyboardInteractiveOptions.onKeyboardInteractive
  }

  if (forwardAllPrompts) {
    result.forwardAllPrompts = true
  }

  return result
}

export function buildTerminalDefaults(
  settings: TerminalSettings | undefined,
  context: AdapterContext
): {
  term: string
  rows: number
  cols: number
  env: Record<string, string>
} {
  const req = context.socket.request as { session?: { envVars?: Record<string, string> } }
  const envVars = req.session?.envVars ?? {}
  const { initialTermSettings } = context.state

  return {
    term: settings?.term ?? initialTermSettings.term ?? TERMINAL_DEFAULTS.DEFAULT_TERM,
    rows: settings?.rows ?? initialTermSettings.rows ?? TERMINAL_DEFAULTS.DEFAULT_ROWS,
    cols: settings?.cols ?? initialTermSettings.cols ?? TERMINAL_DEFAULTS.DEFAULT_COLS,
    env: envVars
  }
}

export function createConnectionIdentifier(context: AdapterContext): ReturnType<typeof createConnectionId> | null {
  if (context.state.connectionId === null) {
    return null
  }

  return createConnectionId(context.state.connectionId)
}
