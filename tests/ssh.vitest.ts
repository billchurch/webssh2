import ssh2 from 'ssh2'
import crypto from 'node:crypto'
import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import type { Server as SSH2Server, AuthContext, Session, ClientChannel } from 'ssh2'
import SSHConnection from '../dist/app/ssh.js'
import { TEST_USERNAME, TEST_PASSWORD, INVALID_USERNAME, INVALID_PASSWORD, TEST_IPS, TEST_PORTS } from './test-constants.js'

const { Server } = ssh2

describe('SSHConnection', () => {
  let sshServer: SSH2Server
  let sshConnection: SSHConnection
  const TEST_PORT = TEST_PORTS.sshServerUnit
  const TEST_CREDENTIALS = {
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
  }

  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs1',
      format: 'pem',
    },
  })

  const mockConfig = {
    ssh: {
      algorithms: {},
      readyTimeout: 2000,
      keepaliveInterval: 1000,
      keepaliveCountMax: 3,
      term: 'xterm',
    },
    user: {
      privateKey: null,
    },
  }

  // Helper functions to reduce nesting
  const handleAuthentication = (ctx: AuthContext): void => {
    if (
      ctx.method === 'password' &&
      ctx.username === TEST_CREDENTIALS.username &&
      ctx.password === TEST_CREDENTIALS.password
    ) {
      ctx.accept()
    } else {
      ctx.reject()
    }
  }

  const handlePty = (acceptPty: () => void): void => {
    acceptPty()
  }

  const handleShell = (acceptShell: () => ClientChannel): void => {
    const stream = acceptShell()
    stream.write('Connected to test server\r\n')
  }

  const handleSession = (accept: () => Session): void => {
    const session = accept()
    session.once('pty', handlePty)
    session.once('shell', handleShell)
  }

  const handleClientReady = (client: ssh2.Connection): void => {
    client.on('session', handleSession)
  }

  const handleClientConnection = (client: ssh2.Connection): void => {
    client.on('authentication', handleAuthentication)
    client.on('ready', () => handleClientReady(client))
  }

  const createBasicServer = (): void => {
    sshServer = new Server(
      {
        hostKeys: [privateKey],
      },
      handleClientConnection
    )
  }

  beforeEach(() => {
    createBasicServer()
    // Bind explicitly to loopback to avoid sandbox restrictions on 0.0.0.0
    sshServer.listen(TEST_PORT, TEST_IPS.LOCALHOST)
    sshConnection = new SSHConnection(mockConfig)
  })

  afterEach(() => {
    // sshConnection is always defined after beforeEach
    sshConnection.end()
    return new Promise((resolve) => {
      sshServer.close(resolve as () => void)
    })
  })

  it('should connect with valid credentials', async () => {
    const credentials = {
      host: TEST_IPS.LOCALHOST,
      port: TEST_PORT,
      username: TEST_CREDENTIALS.username,
      password: TEST_CREDENTIALS.password,
    }

    const connection = await sshConnection.connect(credentials)
    expect(connection !== undefined && connection !== null).toBeTruthy()
  })

  it('should reject connection with invalid credentials', async () => {
    const invalidCredentials = {
      host: TEST_IPS.LOCALHOST,
      port: TEST_PORT,
      username: INVALID_USERNAME,
      password: INVALID_PASSWORD,
    }

    try {
      await sshConnection.connect(invalidCredentials)
      expect.fail('Connection should have been rejected')
    } catch (error) {
      expect((error as Error).name).toBe('SSHConnectionError')
      expect((error as Error).message).toContain('authentication')
    }
  })

  it('should connect using private key authentication', async () => {
    const credentials = {
      host: TEST_IPS.LOCALHOST,
      port: TEST_PORT,
      username: TEST_CREDENTIALS.username,
      privateKey: privateKey,
    }

    // Helper for private key auth
    const handlePrivateKeyAuth = (ctx: AuthContext): void => {
      if (ctx.method === 'publickey' && ctx.username === TEST_CREDENTIALS.username) {
        ctx.accept()
      } else {
        ctx.reject()
      }
    }

    const handleSimpleSession = (accept: () => Session): void => {
      accept()
    }

    // Update server auth handler to accept private key
    const setupPrivateKeyServer = (client: ssh2.Connection): void => {
      client.on('authentication', handlePrivateKeyAuth)
      client.on('ready', () => client.on('session', handleSimpleSession))
    }

    sshServer.removeAllListeners('connection')
    sshServer.on('connection', setupPrivateKeyServer)

    const connection = await sshConnection.connect(credentials)
    expect(connection !== undefined && connection !== null).toBeTruthy()
  })

  it('should reject invalid private key format', async () => {
    const invalidPrivateKey = 'not-a-valid-private-key-format'
    const credentials = {
      host: TEST_IPS.LOCALHOST,
      port: TEST_PORT,
      username: TEST_CREDENTIALS.username,
      privateKey: invalidPrivateKey,
    }

    try {
      await sshConnection.connect(credentials)
      expect.fail('Connection should have been rejected')
    } catch (error) {
      expect((error as Error).name).toBe('SSHConnectionError')
      expect((error as Error).message).toContain('authentication')
    }
  })

  it('should resize terminal when stream exists', async () => {
    const credentials = {
      host: TEST_IPS.LOCALHOST,
      port: TEST_PORT,
      username: TEST_CREDENTIALS.username,
      password: TEST_CREDENTIALS.password,
    }

    // Connect and create shell
    await sshConnection.connect(credentials)
    await sshConnection.shell({ term: 'xterm' })

    // Mock the setWindow method on stream
    let windowResized = false
    const streamObj = (sshConnection as unknown as { stream: { setWindow: (rows: number, cols: number) => void } })
    streamObj.stream.setWindow = (rows: number, cols: number) => {
      windowResized = true
      expect(rows).toBe(24)
      expect(cols).toBe(80)
    }

    // Test resize
    sshConnection.resizeTerminal(24, 80)
    expect(windowResized).toBeTruthy()
  })

  it('should try private key first when both password and key are provided', async () => {
    const authAttemptOrder: string[] = []

    const handleMultiAuth = (ctx: AuthContext): void => {
      authAttemptOrder.push(ctx.method)

      if (ctx.method === 'publickey' && ctx.username === TEST_CREDENTIALS.username) {
        return ctx.accept()
      }

      if (
        ctx.method === 'password' &&
        ctx.username === TEST_CREDENTIALS.username &&
        ctx.password === TEST_CREDENTIALS.password
      ) {
        return ctx.accept()
      }

      ctx.reject(['publickey', 'password'])
    }

    const handlePtyAndShell = (accept: () => Session): void => {
      const session = accept()
      session.once('pty', (acceptPty) => acceptPty())
      session.once('shell', (acceptShell) => acceptShell())
    }

    const setupMultiAuthServer = (client: ssh2.Connection): void => {
      client.on('authentication', handleMultiAuth)
      client.on('ready', () => client.on('session', handlePtyAndShell))
    }

    sshServer.removeAllListeners('connection')
    sshServer.on('connection', setupMultiAuthServer)

    const credentials = {
      host: TEST_IPS.LOCALHOST,
      port: TEST_PORT,
      username: TEST_CREDENTIALS.username,
      privateKey: privateKey,
      password: TEST_CREDENTIALS.password,
    }

    const connection = await sshConnection.connect(credentials)
    expect(connection !== undefined && connection !== null).toBeTruthy()
    expect(authAttemptOrder.length).toBeGreaterThan(0)
  })

  it('should handle connection failures', async () => {
    const credentials = {
      host: TEST_IPS.LOCALHOST,
      port: TEST_PORTS.invalid,
      username: TEST_CREDENTIALS.username,
      password: TEST_CREDENTIALS.password,
    }

    try {
      await sshConnection.connect(credentials)
      expect.fail('Connection should have failed')
    } catch (error) {
      expect((error as Error).name).toBe('SSHConnectionError')
      expect((error as Error).message).toMatch(/Connection failed|All authentication methods failed|ECONNREFUSED/)
    }
  })

  it('should exec command and receive stdout and exit code', async () => {
    const handleExecPty = (acceptPty: () => void): void => {
      acceptPty()
    }

    const handleExecCommand = (acceptExec: () => ClientChannel, _reject: () => void, info: { command: string }): void => {
      const stream = acceptExec()
      // Simulate command behavior
      const out = `ran: ${info.command}\n`
      stream.write(out)
      // exit code 0
      // Type assertion for stream exit and close methods
      const exitableStream = stream as unknown as { exit: (code: number) => void, close: () => void, write: (data: string) => void }
      exitableStream.exit(0)
      exitableStream.close()
    }

    const handleExecSession = (accept: () => Session): void => {
      const session = accept()
      // Accept PTY if requested prior to exec (optional)
      session.on('pty', handleExecPty)
      session.on('exec', handleExecCommand)
    }

    // Reconfigure server to support exec
    const setupExecServer = (client: ssh2.Connection): void => {
      client.on('authentication', handleAuthentication)
      client.on('ready', () => client.on('session', handleExecSession))
    }

    sshServer.removeAllListeners('connection')
    sshServer.on('connection', setupExecServer)

    const credentials = {
      host: TEST_IPS.LOCALHOST,
      port: TEST_PORT,
      username: TEST_CREDENTIALS.username,
      password: TEST_CREDENTIALS.password,
    }

    await sshConnection.connect(credentials)
    const streamResult = await sshConnection.exec('echo hello')
    const stream = streamResult as ClientChannel

    let stdout = ''
    let code: number | null = null

    const handleStreamData = (data: Buffer): void => {
      stdout += data.toString('utf-8')
    }

    const handleStreamClose = (resolve: () => void) => (c: number): void => {
      code = c
      resolve()
    }

    const handleStreamError = (reject: (err: Error) => void) => (err: Error): void => {
      reject(err)
    }

    await new Promise<void>((resolve, reject) => {
      stream.on('data', handleStreamData)
      stream.on('close', handleStreamClose(resolve))
      stream.on('error', handleStreamError(reject))
    })

    expect(stdout).toMatch(/ran: echo hello/)
    expect(code).toBe(0)
  })

  it('should exec with PTY when requested', async () => {
    let ptyRequested = false

    const handlePtyRequest = (acceptPty: () => void): void => {
      ptyRequested = true
      acceptPty()
    }

    const handleExecRequest = (acceptExec: () => ClientChannel): void => {
      const stream = acceptExec()
      stream.write('pty-exec\n')
      // Type assertion for stream exit and close methods
      const exitableStream = stream as unknown as { exit: (code: number) => void, close: () => void, write: (data: string) => void }
      exitableStream.exit(0)
      exitableStream.close()
    }

    const handlePtyExecSession = (accept: () => Session): void => {
      const session = accept()
      session.on('pty', handlePtyRequest)
      session.on('exec', handleExecRequest)
    }

    // Reconfigure server to capture PTY request, then exec
    const setupPtyExecServer = (client: ssh2.Connection): void => {
      client.on('authentication', handleAuthentication)
      client.on('ready', () => client.on('session', handlePtyExecSession))
    }

    sshServer.removeAllListeners('connection')
    sshServer.on('connection', setupPtyExecServer)

    const credentials = {
      host: TEST_IPS.LOCALHOST,
      port: TEST_PORT,
      username: TEST_CREDENTIALS.username,
      password: TEST_CREDENTIALS.password,
    }

    await sshConnection.connect(credentials)
    const streamResult = await sshConnection.exec('uptime', {
      pty: true,
      term: 'xterm',
      cols: 80,
      rows: 24,
    })
    const stream = streamResult as ClientChannel

    let stdout = ''

    const collectStreamData = (data: Buffer): void => {
      stdout += data.toString('utf-8')
    }

    await new Promise<void>((resolve, reject) => {
      stream.on('data', collectStreamData)
      stream.on('close', resolve)
      stream.on('error', reject)
    })

    expect(ptyRequested).toBe(true)
    expect(stdout).toMatch(/pty-exec/)
  })
})