/**
 * Expect-style authentication for telnet login prompts.
 *
 * A state machine that optionally automates login/password entry
 * by matching incoming data against configurable prompt patterns.
 * When no auth is configured (or on timeout), falls through to
 * pass-through mode where all data goes directly to the client.
 */

// ── Types ────────────────────────────────────────────────────────────

export type TelnetAuthState =
  | 'waiting-login'
  | 'waiting-password'
  | 'waiting-result'
  | 'authenticated'
  | 'pass-through'
  | 'failed'

export interface TelnetAuthResult {
  ok: boolean
  state: TelnetAuthState
  bufferedData: Buffer
}

export interface TelnetAuthOptions {
  username?: string
  password?: string
  loginPrompt?: RegExp
  passwordPrompt?: RegExp
  failurePattern?: RegExp
  expectTimeout: number
}

interface ProcessDataResult {
  writeToSocket: Buffer | null
  forwardToClient: Buffer | null
}

// ── TelnetAuthenticator ──────────────────────────────────────────────

export class TelnetAuthenticator {
  private readonly options: TelnetAuthOptions
  private currentState: TelnetAuthState
  private buffer: Buffer = Buffer.alloc(0)
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null

  constructor(options: TelnetAuthOptions) {
    this.options = options
    this.currentState = resolveInitialState(options)
  }

  /**
   * Get current authentication state.
   */
  get state(): TelnetAuthState {
    return this.currentState
  }

  /**
   * Process incoming data from the telnet connection.
   *
   * Returns what to write to the socket (e.g. username/password) and
   * what data to forward to the client terminal.
   *
   * In pass-through state, all data goes directly to forwardToClient.
   */
  processData(data: Buffer): ProcessDataResult {
    switch (this.currentState) {
      case 'waiting-login':
        return this.handleWaitingLogin(data)
      case 'waiting-password':
        return this.handleWaitingPassword(data)
      case 'waiting-result':
        return this.handleWaitingResult(data)
      case 'authenticated':
      case 'pass-through':
        return { writeToSocket: null, forwardToClient: data }
      case 'failed':
        return { writeToSocket: null, forwardToClient: data }
    }
  }

  /**
   * Start the auth timeout. Call after connection is established.
   * On timeout, transitions to pass-through and flushes buffered data.
   */
  startTimeout(onTimeout: (bufferedData: Buffer) => void): void {
    this.cancelTimeout()
    this.timeoutHandle = setTimeout(() => {
      if (isWaitingState(this.currentState)) {
        const buffered = this.buffer
        this.buffer = Buffer.alloc(0)
        this.currentState = 'pass-through'
        onTimeout(buffered)
      }
    }, this.options.expectTimeout)
  }

  /**
   * Cancel the timeout (call on successful auth or explicit cancel).
   */
  cancelTimeout(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }
  }

  /**
   * Clean up resources (timers).
   */
  destroy(): void {
    this.cancelTimeout()
  }

  // ── Private state handlers ─────────────────────────────────────────

  private handleWaitingLogin(data: Buffer): ProcessDataResult {
    this.buffer = Buffer.concat([this.buffer, data])
    const loginPrompt = this.options.loginPrompt

    if (loginPrompt === undefined) {
      return noAction()
    }

    const text = this.buffer.toString('utf-8')
    if (loginPrompt.test(text)) {
      this.buffer = Buffer.alloc(0)
      const nextState = hasPassword(this.options)
        ? 'waiting-password'
        : 'waiting-result'
      this.currentState = nextState
      return {
        writeToSocket: Buffer.from(`${this.options.username ?? ''}\r\n`),
        forwardToClient: null,
      }
    }

    return noAction()
  }

  private handleWaitingPassword(data: Buffer): ProcessDataResult {
    this.buffer = Buffer.concat([this.buffer, data])
    const passwordPrompt = this.options.passwordPrompt

    if (passwordPrompt === undefined) {
      return noAction()
    }

    const text = this.buffer.toString('utf-8')
    if (passwordPrompt.test(text)) {
      this.buffer = Buffer.alloc(0)
      this.currentState = 'waiting-result'
      return {
        writeToSocket: Buffer.from(`${this.options.password ?? ''}\r\n`),
        forwardToClient: null,
      }
    }

    return noAction()
  }

  private handleWaitingResult(data: Buffer): ProcessDataResult {
    this.buffer = Buffer.concat([this.buffer, data])
    const text = this.buffer.toString('utf-8')

    // Check for explicit failure
    if (this.options.failurePattern?.test(text) === true) {
      this.currentState = 'failed'
      this.buffer = Buffer.alloc(0)
      this.cancelTimeout()
      return { writeToSocket: null, forwardToClient: data }
    }

    // Heuristic: if we received data without a failure match, consider
    // authentication successful. We look for any content arriving (the
    // server sent something back that is not a failure message).
    if (text.length > 0) {
      this.currentState = 'authenticated'
      this.buffer = Buffer.alloc(0)
      this.cancelTimeout()
      return { writeToSocket: null, forwardToClient: data }
    }

    return noAction()
  }
}

// ── Module-level helpers ─────────────────────────────────────────────

function resolveInitialState(options: TelnetAuthOptions): TelnetAuthState {
  if (options.loginPrompt === undefined || options.username === undefined) {
    return 'pass-through'
  }
  return 'waiting-login'
}

function hasPassword(options: TelnetAuthOptions): boolean {
  return options.password !== undefined
}

function isWaitingState(state: TelnetAuthState): boolean {
  return state === 'waiting-login'
    || state === 'waiting-password'
    || state === 'waiting-result'
}

function noAction(): ProcessDataResult {
  return { writeToSocket: null, forwardToClient: null }
}
