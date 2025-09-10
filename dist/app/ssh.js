// server
// app/ssh.ts
import { Client as SSH } from 'ssh2'
import { EventEmitter } from 'events'
import { createNamespacedDebug } from './logger.js'
import { SSHConnectionError, handleError } from './errors.js'
import { maskSensitiveData } from './utils.js'
const debug = createNamespacedDebug('ssh')
/**
 * SSHConnection class handles SSH connections and operations.
 * @extends EventEmitter
 */
class SSHConnection extends EventEmitter {
  config
  conn = null
  stream = null
  creds = null
  constructor(config) {
    super()
    this.config = config
  }
  /**
   * Validates the format of a private key, supporting modern SSH key formats
   * @param key - The private key string to validate
   * @returns Whether the key appears to be valid
   */
  validatePrivateKey(key) {
    if (!key || typeof key !== 'string') {
      return false
    }
    // Trim whitespace for consistent validation
    const trimmedKey = key.trim()
    // Patterns for various private key formats
    const keyPatterns = [
      // OpenSSH format (modern default for all key types)
      /^-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*-----END OPENSSH PRIVATE KEY-----$/,
      // Traditional RSA format
      /^-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*-----END (?:RSA )?PRIVATE KEY-----$/,
      // EC (ECDSA) private key format
      /^-----BEGIN EC PRIVATE KEY-----[\s\S]*-----END EC PRIVATE KEY-----$/,
      // DSA private key format
      /^-----BEGIN DSA PRIVATE KEY-----[\s\S]*-----END DSA PRIVATE KEY-----$/,
      // PKCS#8 format (can contain any key type)
      /^-----BEGIN PRIVATE KEY-----[\s\S]*-----END PRIVATE KEY-----$/,
      // Encrypted PKCS#8 format
      /^-----BEGIN ENCRYPTED PRIVATE KEY-----[\s\S]*-----END ENCRYPTED PRIVATE KEY-----$/,
    ]
    // Test against all supported formats
    return keyPatterns.some((pattern) => pattern.test(trimmedKey))
  }
  /**
   * Checks if a private key is encrypted
   * @param key - The private key to check
   * @returns Whether the key is encrypted
   */
  isEncryptedKey(key) {
    if (!key || typeof key !== 'string') {
      return false
    }
    // Check for various encryption indicators
    return (
      // Traditional encrypted RSA format
      key.includes('Proc-Type: 4,ENCRYPTED') ||
      // Encrypted PKCS#8 format
      key.includes('-----BEGIN ENCRYPTED PRIVATE KEY-----') ||
      // OpenSSH encrypted format - contains encryption headers
      (key.includes('-----BEGIN OPENSSH PRIVATE KEY-----') &&
        (key.includes('bcrypt') || key.includes('aes') || key.includes('3des')))
    )
  }
  /**
   * Attempts to connect using the provided credentials
   * @param creds - The credentials object
   * @returns A promise that resolves with the SSH connection
   */
  connect(creds) {
    debug('connect: %O', maskSensitiveData(creds))
    this.creds = creds
    if (this.conn) {
      this.conn.end()
    }
    this.conn = new SSH()
    // Build a single connection config with preferred auth order
    const sshConfig = this.getSSHConfig(creds, true)
    debug('Initial connection config: %O', maskSensitiveData(sshConfig))
    return new Promise((resolve, reject) => {
      this.setupConnectionHandlers(resolve, reject)
      try {
        this.conn.connect(sshConfig)
      } catch (err) {
        reject(new SSHConnectionError(`Connection failed: ${err.message}`))
      }
    })
  }
  /**
   * Sets up SSH connection event handlers
   * @param resolve - Promise resolve function
   * @param reject - Promise reject function
   */
  setupConnectionHandlers(resolve, reject) {
    this.conn.on('ready', () => {
      debug(`connect: ready: ${this.creds.host}`)
      resolve(this.conn)
    })
    this.conn.on('error', (err) => {
      // Sometimes err.message is empty, use err.code or err.toString() as fallback
      const errorMessage = err.message || err.code || err.toString() || 'Unknown error'
      debug(`connect: error: ${errorMessage}`)
      // Check if this is a connection error (DNS, network, etc) vs authentication error
      const isConnectionError =
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('EHOSTUNREACH') ||
        errorMessage.includes('ENETUNREACH') ||
        errorMessage.includes('getaddrinfo') ||
        // Also check err.level if it's a system-level error
        (err.level === 'client-socket' && !errorMessage.includes('authentication'))
      if (isConnectionError) {
        // This is a connection error, not an auth error
        const displayMessage =
          errorMessage === 'Error'
            ? `Connection failed: Unable to connect to ${this.creds.host}:${this.creds.port || 22}`
            : `Connection failed: ${errorMessage}`
        const error = new SSHConnectionError(displayMessage)
        handleError(error)
        reject(error)
        return
      }
      // Authentication failures are handled within a single connection via authHandler
      const error = new SSHConnectionError('All authentication methods failed')
      handleError(error)
      reject(error)
    })
    this.conn.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
      this.handleKeyboardInteractive(name, instructions, lang, prompts, finish)
    })
  }
  /**
   * Handles keyboard-interactive authentication prompts.
   * @param name - The name of the authentication request.
   * @param instructions - The instructions for the keyboard-interactive prompt.
   * @param lang - The language of the prompt.
   * @param prompts - The list of prompts provided by the server.
   * @param finish - The callback to complete the keyboard-interactive authentication.
   */
  handleKeyboardInteractive(name, instructions, _lang, prompts, finish) {
    debug('handleKeyboardInteractive: Keyboard-interactive auth %O', prompts)
    // Check if we should always send prompts to the client
    if (this.config.ssh.alwaysSendKeyboardInteractivePrompts) {
      this.sendPromptsToClient(name, instructions, prompts, finish)
      return
    }
    const responses = []
    let shouldSendToClient = false
    for (const prompt of prompts) {
      if (prompt.prompt.toLowerCase().includes('password') && this.creds.password) {
        responses.push(this.creds.password)
      } else {
        shouldSendToClient = true
        break
      }
    }
    if (shouldSendToClient) {
      this.sendPromptsToClient(name, instructions, prompts, finish)
    } else {
      finish(responses)
    }
  }
  /**
   * Sends prompts to the client for keyboard-interactive authentication.
   *
   * @param name - The name of the authentication method.
   * @param instructions - The instructions for the authentication.
   * @param prompts - The prompts to be sent to the client.
   * @param finish - The callback function to be called when the client responds.
   */
  sendPromptsToClient(name, instructions, prompts, finish) {
    this.emit('keyboard-interactive', {
      name: name,
      instructions: instructions,
      prompts: prompts.map((p) => ({ prompt: p.prompt, echo: p.echo })),
    })
    this.once('keyboard-interactive-response', (responses) => {
      finish(responses)
    })
  }
  /**
   * Generates the SSH configuration object based on credentials.
   * @param creds - The credentials object
   * @param useKey - Whether to attempt key authentication
   * @returns The SSH configuration object
   */
  getSSHConfig(creds, useKey) {
    const config = {
      host: creds.host,
      port: creds.port,
      username: creds.username,
      // Keep keyboard-interactive available; authHandler controls order
      tryKeyboard: true,
      algorithms: this.config.ssh.algorithms,
      readyTimeout: this.config.ssh.readyTimeout,
      keepaliveInterval: this.config.ssh.keepaliveInterval,
      keepaliveCountMax: this.config.ssh.keepaliveCountMax,
      debug: createNamespacedDebug('ssh2'),
    }
    // Populate available credentials
    const authOrder = []
    // Prefer private key first (if provided and allowed)
    if (useKey && (creds.privateKey || this.config.user.privateKey)) {
      const privateKey = creds.privateKey || this.config.user.privateKey
      if (!this.validatePrivateKey(privateKey)) {
        throw new SSHConnectionError('Invalid private key format')
      }
      config['privateKey'] = privateKey
      if (this.isEncryptedKey(privateKey)) {
        const passphrase = creds.passphrase || this.config.user.passphrase
        if (!passphrase) {
          throw new SSHConnectionError('Encrypted private key requires a passphrase')
        }
        config['passphrase'] = passphrase
      }
      authOrder.push('publickey')
    }
    // Then try password if present
    if (creds.password) {
      config['password'] = creds.password
      authOrder.push('password')
    }
    // Finally, allow keyboard-interactive as a fallback
    authOrder.push('keyboard-interactive')
    // Use a single connection to iterate through methods in order
    config['authHandler'] = authOrder
    return config
  }
  /**
   * Opens an interactive shell session over the SSH connection.
   * @param options - Options for the shell
   * @param envVars - Environment variables to set
   * @returns A promise that resolves with the SSH shell stream
   */
  shell(options, envVars) {
    // Separate PTY options from environment options
    // SSH2 expects them as separate parameters
    const ptyOptions = {
      term: options.term,
      rows: options.rows,
      cols: options.cols,
      width: options.width,
      height: options.height,
    }
    // Only include environment options if we have envVars
    const envOptions = envVars
      ? {
          env: this.getEnvironment(envVars),
        }
      : {}
    debug(`shell: Creating shell with PTY options:`, ptyOptions, 'and env options:', envOptions)
    return new Promise((resolve, reject) => {
      // Pass PTY options as first param, env options as second
      this.conn.shell(ptyOptions, envOptions, (err, stream) => {
        if (err) {
          reject(err)
        } else {
          this.stream = stream
          resolve(stream)
        }
      })
    })
  }
  /**
   * Executes a single non-interactive command over the SSH connection.
   * Optionally requests a PTY when options.pty is true to emulate TTY behavior.
   *
   * @param command - The command to execute
   * @param options - Execution options
   * @param envVars - Environment variables to set for the command
   * @returns Resolves with the SSH exec stream
   */
  exec(command, options = {}, envVars) {
    const execOptions = {}
    // Include environment vars if provided (same behavior as shell())
    if (envVars) {
      execOptions['env'] = this.getEnvironment(envVars)
    }
    // PTY request if needed
    if (options.pty) {
      execOptions['pty'] = {
        term: options.term,
        rows: options.rows,
        cols: options.cols,
        width: options.width,
        height: options.height,
      }
    }
    debug('exec: Executing command with options:', command, execOptions)
    return new Promise((resolve, reject) => {
      this.conn.exec(command, execOptions, (err, stream) => {
        if (err) {
          reject(err)
        } else {
          this.stream = stream
          resolve(stream)
        }
      })
    })
  }
  /**
   * Resizes the terminal window for the current SSH session.
   * @param rows - The number of rows for the terminal.
   * @param cols - The number of columns for the terminal.
   */
  resizeTerminal(rows, cols) {
    if (this.stream && typeof this.stream.setWindow === 'function') {
      this.stream.setWindow(rows, cols)
    }
  }
  /**
   * Ends the SSH connection and stream.
   */
  end() {
    if (this.stream) {
      this.stream.end()
      this.stream = null
    }
    if (this.conn) {
      this.conn.end()
      this.conn = null
    }
  }
  /**
   * Gets the environment variables for the SSH session
   * @param envVars - Environment variables from URL
   * @returns Combined environment variables
   */
  getEnvironment(envVars) {
    const env = {
      TERM: this.config.ssh.term,
    }
    if (envVars) {
      Object.keys(envVars).forEach((key) => {
        const value = envVars[key]
        if (value !== undefined) {
          env[key] = value
        }
      })
    }
    return env
  }
}
export default SSHConnection
//# sourceMappingURL=ssh.js.map
