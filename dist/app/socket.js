// server
// app/socket.ts
import validator from 'validator'
import { EventEmitter } from 'events'
import { createNamespacedDebug } from './logger.js'
import { SSHConnectionError, handleError } from './errors.js'
import { isValidCredentials, maskSensitiveData, validateSshTerm } from './utils.js'
import { MESSAGES } from './constants.js'
const debug = createNamespacedDebug('socket')
class WebSSH2SocketHandler extends EventEmitter {
  socket
  config
  SSHConnectionClass
  ssh = null
  sessionState
  /**
   * Creates a new WebSSH2Socket instance
   * @param socket - The Socket.IO socket instance
   * @param config - The application configuration
   * @param SSHConnectionClass - The SSH connection class constructor
   */
  constructor(socket, config, SSHConnectionClass) {
    super()
    this.socket = socket
    this.config = config
    this.SSHConnectionClass = SSHConnectionClass
    this.ssh = null
    this.sessionState = {
      authenticated: false,
      username: null,
      password: null,
      privateKey: null,
      passphrase: null,
      host: null,
      port: null,
      term: null,
      cols: null,
      rows: null,
    }
    this.initializeSocketEvents()
  }
  initializeSocketEvents() {
    debug(`io.on connection: ${this.socket.id}`)
    // Process query parameters from Socket.IO handshake
    // This handles cases where client connects directly with query params (CDN deployments)
    if (this.socket.handshake && this.socket.handshake.query) {
      const query = this.socket.handshake.query
      if (query.header || query.headerBackground || query.headerStyle) {
        // Only set headerOverride if not already set by HTTP route
        if (!this.socket.request.session.headerOverride) {
          this.socket.request.session.headerOverride = {}
        }
        if (query.header && !this.socket.request.session.headerOverride.text) {
          this.socket.request.session.headerOverride.text = query.header
          debug('Header text from WebSocket query: %s', query.header)
        }
        if (query.headerBackground && !this.socket.request.session.headerOverride.background) {
          this.socket.request.session.headerOverride.background = query.headerBackground
          debug('Header background from WebSocket query: %s', query.headerBackground)
        }
        if (query.headerStyle && !this.socket.request.session.headerOverride.style) {
          this.socket.request.session.headerOverride.style = query.headerStyle
          debug('Header style from WebSocket query: %s', query.headerStyle)
        }
        debug(
          'Header override after WebSocket query processing: %O',
          this.socket.request.session.headerOverride
        )
      }
    }
    if (this.socket.request.session.usedBasicAuth && this.socket.request.session.sshCredentials) {
      const creds = this.socket.request.session.sshCredentials
      debug(
        `handleConnection: ${this.socket.id}, Host: ${creds.host}: HTTP Basic Credentials Exist, creds: %O`,
        maskSensitiveData(creds)
      )
      this.handleAuthenticate(creds)
    } else if (!this.sessionState.authenticated) {
      // Check if interactive auth is disabled
      if (this.config.ssh.disableInteractiveAuth) {
        debug(`handleConnection: ${this.socket.id}, interactive auth disabled`)
        this.handleError('Interactive Auth Disabled')
        return
      }
      debug(`handleConnection: ${this.socket.id}, emitting request_auth`)
      this.socket.emit('authentication', { action: 'request_auth' })
    }
    this.socket.on('authenticate', (...args) => {
      this.handleAuthenticate(args[0])
    })
    this.socket.on('terminal', (...args) => {
      this.handleTerminal(args[0])
    })
    // Exec event allows single-command execution over SSH
    this.socket.on('exec', (...args) => {
      this.handleExec(args[0])
    })
    this.socket.on('disconnect', (...args) => {
      this.handleConnectionClose(undefined, args[0])
    })
  }
  handleKeyboardInteractive(data) {
    debug(`handleKeyboardInteractive: ${this.socket.id}, %O`, data)
    // Send the keyboard-interactive request to the client
    this.socket.emit(
      'authentication',
      Object.assign(
        {
          action: 'keyboard-interactive',
        },
        data
      )
    )
    // Set up a one-time listener for the client's response
    this.socket.once('authentication', (...args) => {
      const clientResponse = args[0]
      const maskedclientResponse = maskSensitiveData(clientResponse, {
        properties: ['responses'],
      })
      debug('handleKeyboardInteractive: Client response masked %O', maskedclientResponse)
      if (clientResponse.action === 'keyboard-interactive' && this.ssh) {
        // Forward the client's response to the SSH connection
        this.ssh.emit('keyboard-interactive-response', clientResponse.responses)
      }
    })
  }
  handleAuthenticate(creds) {
    debug(`handleAuthenticate: ${this.socket.id}, %O`, maskSensitiveData(creds))
    debug(`handleAuthenticate: received cols=${creds.cols}, rows=${creds.rows}`)
    if (isValidCredentials(creds)) {
      // Set term if provided, otherwise use config default
      this.sessionState.term = validateSshTerm(creds.term)
        ? creds.term || null
        : this.config.ssh.term
      // Store terminal dimensions if provided with credentials
      if (creds.cols && validator.isInt(creds.cols.toString())) {
        this.sessionState.cols = parseInt(creds.cols.toString(), 10)
        debug(`handleAuthenticate: storing cols: ${this.sessionState.cols}`)
      }
      if (creds.rows && validator.isInt(creds.rows.toString())) {
        this.sessionState.rows = parseInt(creds.rows.toString(), 10)
        debug(`handleAuthenticate: storing rows: ${this.sessionState.rows}`)
      }
      debug(
        `handleAuthenticate: sessionState now has cols=${this.sessionState.cols}, rows=${this.sessionState.rows}`
      )
      this.initializeConnection(creds)
    } else {
      debug(`handleAuthenticate: ${this.socket.id}, CREDENTIALS INVALID`)
      this.socket.emit('authentication', {
        success: false,
        message: 'Invalid credentials format',
      })
    }
  }
  async initializeConnection(creds) {
    debug(
      `initializeConnection: ${this.socket.id}, INITIALIZING SSH CONNECTION: Host: ${creds.host}, creds: %O`,
      maskSensitiveData(creds)
    )
    // Add private key from config if available and not provided in creds
    if (this.config.user.privateKey && !creds.privateKey) {
      creds.privateKey = this.config.user.privateKey
    }
    // Create new SSH connection instance
    this.ssh = new this.SSHConnectionClass(this.config)
    // Set up SSH event handlers
    this.ssh.on('keyboard-interactive', (data) => {
      this.handleKeyboardInteractive(data)
    })
    try {
      await this.ssh.connect(creds)
      this.sessionState = Object.assign({}, this.sessionState, {
        authenticated: true,
        username: creds.username,
        password: creds.password,
        privateKey: creds.privateKey,
        passphrase: creds.passphrase,
        host: creds.host,
        port: creds.port,
      })
      const authResult = { action: 'auth_result', success: true }
      this.socket.emit('authentication', authResult)
      const permissions = {
        autoLog: this.config.options?.autoLog || false,
        allowReplay: this.config.options?.allowReplay || false,
        allowReconnect: this.config.options?.allowReconnect || false,
        allowReauth: this.config.options?.allowReauth || false,
      }
      this.socket.emit('permissions', permissions)
      this.updateElement('footer', `ssh://${creds.host}:${creds.port}`)
      // Check for header in priority order: URL/WebSocket parameters, environment, then config
      const headerOverride = this.socket.request.session.headerOverride
      let headerText = null
      let headerBackground = null
      let headerStyle = null
      let headerSource = null
      if (headerOverride && (headerOverride.text || headerOverride.style)) {
        headerText = headerOverride.text || null
        headerBackground = headerOverride.background || null
        headerStyle = headerOverride.style || null
        headerSource = 'URL/WebSocket parameters'
        debug(
          'Using header from %s - text: %s, background: %s, style: %s',
          headerSource,
          headerText,
          headerBackground,
          headerStyle
        )
      } else if (this.config.header && this.config.header.text !== null) {
        headerText = this.config.header.text
        headerBackground = this.config.header.background || null
        headerSource = 'environment/config'
        debug(
          'Using header from %s - text: %s, background: %s',
          headerSource,
          headerText,
          headerBackground
        )
      }
      // Send header events based on what's available
      if (headerStyle) {
        // When headerStyle is provided, send BOTH header text and headerStyle
        debug(
          'Header style found from %s, calling updateElement with style: %s',
          headerSource,
          headerStyle
        )
        if (headerText) {
          debug(
            'Header text found from %s, calling updateElement with text: %s',
            headerSource,
            headerText
          )
          this.updateElement('header', headerText)
        }
        this.updateElement('headerStyle', headerStyle)
      } else if (headerText) {
        debug(
          'Header text found from %s, calling updateElement with text: %s',
          headerSource,
          headerText
        )
        this.updateElement('header', headerText)
        // Also send background if available
        if (headerBackground) {
          debug(
            'Header background found from %s, calling updateElement with background: %s',
            headerSource,
            headerBackground
          )
          this.updateElement('headerBackground', headerBackground)
        }
      } else {
        debug(
          'Header not set - config.header: %O, headerOverride: %O',
          this.config.header,
          headerOverride
        )
      }
      this.socket.emit('getTerminal', true)
    } catch (err) {
      const error = err
      debug(
        `initializeConnection: SSH CONNECTION ERROR: ${this.socket.id}, Host: ${creds.host}, Error: ${error.message}`
      )
      const errorMessage =
        error instanceof SSHConnectionError ? error.message : 'SSH connection failed'
      this.socket.emit('authentication', {
        action: 'auth_result',
        success: false,
        message: errorMessage,
      })
    }
  }
  /**
   * Handles terminal data.
   * @param data - The terminal data.
   */
  handleTerminal(data) {
    const { term, rows, cols } = data
    if (term && validateSshTerm(term)) {
      this.sessionState.term = term
    }
    if (rows && validator.isInt(rows.toString())) {
      this.sessionState.rows = parseInt(rows.toString(), 10)
    }
    if (cols && validator.isInt(cols.toString())) {
      this.sessionState.cols = parseInt(cols.toString(), 10)
    }
    this.createShell()
  }
  /**
   * Creates a new SSH shell session.
   */
  async createShell() {
    if (!this.ssh) {
      debug('createShell: SSH not initialized; skipping')
      return
    }
    // Get envVars from socket session if they exist
    const envVars = this.socket.request.session.envVars || null
    const shellOptions = {
      term: this.sessionState.term || 'xterm-color',
      cols: this.sessionState.cols || 80,
      rows: this.sessionState.rows || 24,
    }
    debug(`createShell: Creating shell with options:`, shellOptions)
    try {
      const stream = await this.ssh.shell(shellOptions, envVars)
      stream.on('data', (data) => {
        this.socket.emit('data', data.toString('utf-8'))
      })
      // stream.stderr.on("data", data => debug(`STDERR: ${data}`)) // needed for shell.exec
      stream.on('close', (...args) => {
        debug('close: SSH Stream closed')
        this.handleConnectionClose(args[0], args[1])
      })
      stream.on('end', () => {
        debug('end: SSH Stream ended')
      })
      stream.on('error', (err) => {
        debug('error: SSH Stream error %O', err)
      })
      this.socket.on('data', (...args) => {
        stream.write(args[0])
      })
      this.socket.on('control', (...args) => {
        this.handleControl(args[0])
      })
      this.socket.on('resize', (...args) => {
        this.handleResize(args[0])
      })
    } catch (err) {
      this.handleError('createShell: ERROR', err)
    }
  }
  /**
   * Handles a single exec command request.
   * @param payload - The exec request payload
   */
  async handleExec(payload) {
    if (!this.ssh) {
      debug('handleExec: SSH not initialized; skipping')
      this.socket.emit('ssherror', 'SSH not initialized')
      return
    }
    const command = payload && typeof payload.command === 'string' ? payload.command.trim() : ''
    if (!command) {
      this.socket.emit('ssherror', 'Invalid exec request: command is required')
      return
    }
    // Build options using provided dimensions or stored session defaults
    const usePty = !!payload?.pty
    const execOptions = {
      pty: usePty,
      term: payload?.term || this.sessionState.term || 'xterm-color',
      cols: payload?.cols || this.sessionState.cols || 80,
      rows: payload?.rows || this.sessionState.rows || 24,
    }
    // Environment variables: start from session env, then merge payload.env overrides
    const sessionEnvVars = this.socket.request.session.envVars || null
    const mergedEnvVars = { ...(sessionEnvVars || {}) }
    if (payload?.env && typeof payload.env === 'object') {
      Object.assign(mergedEnvVars, payload.env)
    }
    debug('handleExec: command=%o, options=%o, env=%o', command, execOptions, mergedEnvVars)
    try {
      const stream = await this.ssh.exec(command, execOptions, mergedEnvVars)
      let timeout
      // Forward client input to exec stream when present (interactive PTY exec)
      const onClientData = (...args) => {
        try {
          stream.write(args[0])
        } catch (e) {
          debug('handleExec: error writing to stream %O', e)
        }
      }
      const onClientResize = (...args) => this.handleResize(args[0])
      this.socket.on('data', onClientData)
      this.socket.on('resize', onClientResize)
      if (payload?.timeoutMs && Number.isInteger(payload.timeoutMs) && payload.timeoutMs > 0) {
        timeout = setTimeout(() => {
          try {
            // Try to signal/close the stream on timeout
            if (typeof stream.signal === 'function') {
              stream.signal('SIGTERM')
            }
            if (typeof stream.close === 'function') {
              stream.close()
            }
          } catch (e) {
            debug('handleExec: error during timeout cleanup %O', e)
          }
          this.socket.emit('exec-exit', { code: null, signal: 'TIMEOUT' })
        }, payload.timeoutMs)
      }
      stream.on('data', (data) => {
        const text = data.toString('utf-8')
        // Reuse existing data channel for stdout, plus typed exec-data
        this.socket.emit('data', text)
        this.socket.emit('exec-data', { type: 'stdout', data: text })
      })
      if (stream.stderr && typeof stream.stderr.on === 'function') {
        stream.stderr.on('data', (data) => {
          const text = data.toString('utf-8')
          this.socket.emit('exec-data', { type: 'stderr', data: text })
        })
      }
      stream.on('close', (...args) => {
        if (timeout) {
          clearTimeout(timeout)
        }
        const code = args[0]
        const signal = args[1]
        debug('handleExec: stream closed, code=%o, signal=%o', code, signal)
        // For exec, do not force socket/session close to allow multiple execs
        this.socket.off('data', onClientData)
        this.socket.off('resize', onClientResize)
        this.socket.emit('exec-exit', { code, signal })
      })
      stream.on('error', (err) => {
        if (timeout) {
          clearTimeout(timeout)
        }
        debug('handleExec: stream error %O', err)
        this.socket.off('data', onClientData)
        this.socket.off('resize', onClientResize)
        const error = err
        this.socket.emit('ssherror', `SSH exec error: ${error?.message || String(err)}`)
      })
    } catch (err) {
      this.handleError('exec: ERROR', err)
    }
  }
  handleResize(data) {
    const { rows, cols } = data
    if (rows && validator.isInt(rows.toString())) {
      this.sessionState.rows = parseInt(rows.toString(), 10)
    }
    if (cols && validator.isInt(cols.toString())) {
      this.sessionState.cols = parseInt(cols.toString(), 10)
    }
    if (
      this.ssh &&
      typeof this.ssh.resizeTerminal === 'function' &&
      this.sessionState.rows !== null &&
      this.sessionState.cols !== null
    ) {
      this.ssh.resizeTerminal(this.sessionState.rows, this.sessionState.cols)
    }
  }
  /**
   * Handles control commands.
   * @param controlData - The control command received.
   */
  handleControl(controlData) {
    if (
      validator.isIn(controlData, ['replayCredentials', 'reauth']) &&
      this.ssh &&
      this.ssh.stream
    ) {
      if (controlData === 'replayCredentials') {
        this.replayCredentials()
      } else if (controlData === 'reauth') {
        this.handleReauth()
      }
    } else {
      console.warn(`handleControl: Invalid control command received: ${controlData}`)
    }
  }
  /**
   * Replays stored credentials.
   */
  replayCredentials() {
    if (this.config.options?.allowReplay && this.ssh && this.ssh.stream) {
      this.ssh.stream.write(`${this.sessionState.password}\n`)
    }
  }
  /**
   * Handles reauthentication.
   */
  handleReauth() {
    if (this.config.options?.allowReauth) {
      this.clearSessionCredentials()
      this.socket.emit('authentication', { action: 'reauth' })
    }
  }
  /**
   * Handles errors.
   * @param context - The error context.
   * @param err - The error object.
   */
  handleError(context, err) {
    const errorMessage = err ? `: ${err.message}` : ''
    handleError(new SSHConnectionError(`SSH ${context}${errorMessage}`))
    this.socket.emit('ssherror', `SSH ${context}${errorMessage}`)
    this.handleConnectionClose()
  }
  /**
   * Updates a UI element on the client side.
   * @param element - The element to update.
   * @param value - The new value for the element.
   */
  updateElement(element, value) {
    debug('updateElement called: element=%s, value=%s', element, value)
    this.socket.emit('updateUI', { element, value })
  }
  /**
   * Handles the closure of the connection.
   * @param code - The exit code.
   * @param signal - The signal or reason for closure.
   */
  handleConnectionClose(code, signal) {
    if (this.ssh && typeof this.ssh.end === 'function') {
      try {
        this.ssh.end()
      } catch (e) {
        const error = e
        debug(`handleConnectionClose: error ending SSH: ${error?.message || error}`)
      }
    }
    this.ssh = null
    debug(`handleConnectionClose: ${this.socket.id}, Code: ${code}, Signal: ${signal}`)
    // Ensure socket is disconnected; guard in case already closed
    if (this.socket && this.socket.disconnect) {
      this.socket.disconnect(true)
    }
  }
  /**
   * Clears session credentials.
   */
  async clearSessionCredentials() {
    if (this.socket.request.session.sshCredentials) {
      this.socket.request.session.sshCredentials.username = ''
      this.socket.request.session.sshCredentials.password = undefined
    }
    this.socket.request.session.usedBasicAuth = false
    this.sessionState.authenticated = false
    this.sessionState.username = null
    this.sessionState.password = null
    try {
      await new Promise((resolve, reject) => {
        this.socket.request.session.save((err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    } catch (err) {
      console.error(
        `clearSessionCredentials: ${MESSAGES.FAILED_SESSION_SAVE} ${this.socket.id}:`,
        err
      )
    }
  }
}
export default function (io, config, SSHConnectionClass) {
  io.on('connection', (socket) => new WebSSH2SocketHandler(socket, config, SSHConnectionClass))
}
//# sourceMappingURL=socket.js.map
