import ssh2 from 'ssh2'
import crypto from 'node:crypto'
import { test, describe, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
const { Server } = ssh2
import SSHConnection from '../dist/app/ssh.js'
import { TEST_USERNAME, TEST_PASSWORD, INVALID_USERNAME, INVALID_PASSWORD } from './test-constants.js'

describe('SSHConnection', () => {
  let sshServer
  let sshConnection
  const TEST_PORT = 2222
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

  beforeEach(() => {
    sshServer = new Server(
      {
        hostKeys: [privateKey],
      },
      (client) => {
        client.on('authentication', (ctx) => {
          if (
            ctx.method === 'password' &&
            ctx.username === TEST_CREDENTIALS.username &&
            ctx.password === TEST_CREDENTIALS.password
          ) {
            ctx.accept()
          } else {
            ctx.reject()
          }
        })

        client.on('ready', () => {
          client.on('session', (accept) => {
            const session = accept()
            session.once('pty', (accept) => {
              accept()
            })
            session.once('shell', (accept) => {
              const stream = accept()
              stream.write('Connected to test server\r\n')
            })
          })
        })
      }
    )

    // Bind explicitly to loopback to avoid sandbox restrictions on 0.0.0.0
    sshServer.listen(TEST_PORT, '127.0.0.1')
    sshConnection = new SSHConnection(mockConfig)
  })

  afterEach(() => {
    if (sshConnection) {
      sshConnection.end()
    }
    return new Promise((resolve) => {
      sshServer.close(resolve)
    })
  })

  test('should connect with valid credentials', async () => {
    const credentials = {
      host: 'localhost',
      port: TEST_PORT,
      username: TEST_CREDENTIALS.username,
      password: TEST_CREDENTIALS.password,
    }

    const connection = await sshConnection.connect(credentials)
    assert.ok(connection, 'Connection should be established')
  })

  test('should reject connection with invalid credentials', async () => {
    const invalidCredentials = {
      host: 'localhost',
      port: TEST_PORT,
      username: INVALID_USERNAME,
      password: INVALID_PASSWORD,
    }

    try {
      await sshConnection.connect(invalidCredentials)
      assert.fail('Connection should have been rejected')
    } catch (error) {
      assert.equal(error.name, 'SSHConnectionError')
      assert.equal(error.message, 'All authentication methods failed')
    }
  })

  test('should connect using private key authentication', async () => {
    const credentials = {
      host: 'localhost',
      port: TEST_PORT,
      username: TEST_CREDENTIALS.username,
      privateKey: privateKey,
    }

    // Update server auth handler to accept private key
    sshServer.removeAllListeners('connection')
    sshServer.on('connection', (client) => {
      client.on('authentication', (ctx) => {
        if (ctx.method === 'publickey' && ctx.username === TEST_CREDENTIALS.username) {
          ctx.accept()
        } else {
          ctx.reject()
        }
      })

      client.on('ready', () => {
        client.on('session', (accept) => {
          accept()
        })
      })
    })

    const connection = await sshConnection.connect(credentials)
    assert.ok(connection, 'Connection should be established using private key')
  })

  test('should reject invalid private key format', async () => {
    const invalidPrivateKey = 'not-a-valid-private-key-format'
    const credentials = {
      host: 'localhost',
      port: TEST_PORT,
      username: TEST_CREDENTIALS.username,
      privateKey: invalidPrivateKey,
    }

    try {
      await sshConnection.connect(credentials)
      assert.fail('Connection should have been rejected')
    } catch (error) {
      assert.equal(error.name, 'SSHConnectionError')
      assert.equal(error.message, 'Invalid private key format')
    }
  })
  test('should resize terminal when stream exists', async () => {
    const credentials = {
      host: 'localhost',
      port: TEST_PORT,
      username: TEST_CREDENTIALS.username,
      password: TEST_CREDENTIALS.password,
    }

    // Connect and create shell
    await sshConnection.connect(credentials)
    await sshConnection.shell({ term: 'xterm' })

    // Mock the setWindow method on stream
    let windowResized = false
    sshConnection.stream.setWindow = (rows, cols) => {
      windowResized = true
      assert.equal(rows, 24)
      assert.equal(cols, 80)
    }

    // Test resize
    sshConnection.resizeTerminal(24, 80)
    assert.ok(windowResized, 'Terminal should be resized')
  })
  test('should try private key first when both password and key are provided', async () => {
    const authAttemptOrder = []

    sshServer.removeAllListeners('connection')
    sshServer.on('connection', (client) => {
      client.on('authentication', (ctx) => {
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
      })

      client.on('ready', () => {
        client.on('session', (accept) => {
          const session = accept()
          session.once('pty', (accept) => accept())
          session.once('shell', (accept) => accept())
        })
      })
    })

    const credentials = {
      host: 'localhost',
      port: TEST_PORT,
      username: TEST_CREDENTIALS.username,
      privateKey: privateKey,
      password: TEST_CREDENTIALS.password,
    }

    const connection = await sshConnection.connect(credentials)
    assert.ok(connection, 'Connection should be established')
    assert.ok(
      authAttemptOrder.includes('publickey'),
      'Private key authentication should be attempted'
    )
  })
  test('should handle connection failures', async () => {
    const credentials = {
      host: 'localhost',
      port: 9999,
      username: TEST_CREDENTIALS.username,
      password: TEST_CREDENTIALS.password,
    }

    try {
      await sshConnection.connect(credentials)
      assert.fail('Connection should have failed')
    } catch (error) {
      assert.equal(error.name, 'SSHConnectionError')
      assert.match(error.message, /Connection failed|All authentication methods failed/)
    }
  })

  test('should handle connection timeout', async () => {
    const credentials = {
      host: '240.0.0.0',
      port: TEST_PORT,
      username: TEST_CREDENTIALS.username,
      password: TEST_CREDENTIALS.password,
    }

    try {
      await sshConnection.connect(credentials)
      assert.fail('Connection should have timed out')
    } catch (error) {
      assert.equal(error.name, 'SSHConnectionError')
      assert.equal(error.message, 'All authentication methods failed')
    }
  })

  test('should exec command and receive stdout and exit code', async () => {
    // Reconfigure server to support exec
    sshServer.removeAllListeners('connection')
    sshServer.on('connection', (client) => {
      client.on('authentication', (ctx) => {
        if (
          ctx.method === 'password' &&
          ctx.username === TEST_CREDENTIALS.username &&
          ctx.password === TEST_CREDENTIALS.password
        ) {
          ctx.accept()
        } else {
          ctx.reject()
        }
      })

      client.on('ready', () => {
        client.on('session', (accept) => {
          const session = accept()
          // Accept PTY if requested prior to exec (optional)
          session.on('pty', (accept) => accept && accept())
          session.on('exec', (accept, _reject, info) => {
            const stream = accept()
            // Simulate command behavior
            const out = `ran: ${info.command}\n`
            stream.write(out)
            // exit code 0
            stream.exit(0)
            stream.close()
          })
        })
      })
    })

    const credentials = {
      host: 'localhost',
      port: TEST_PORT,
      username: TEST_CREDENTIALS.username,
      password: TEST_CREDENTIALS.password,
    }

    await sshConnection.connect(credentials)
    const stream = await sshConnection.exec('echo hello')

    let stdout = ''
    let code = null

    await new Promise((resolve, reject) => {
      stream.on('data', (data) => {
        stdout += data.toString('utf-8')
      })
      stream.on('close', (c) => {
        code = c
        resolve()
      })
      stream.on('error', reject)
    })

    assert.match(stdout, /ran: echo hello/)
    assert.equal(code, 0)
  })

  test('should exec with PTY when requested', async () => {
    // Reconfigure server to capture PTY request, then exec
    sshServer.removeAllListeners('connection')
    let ptyRequested = false
    sshServer.on('connection', (client) => {
      client.on('authentication', (ctx) => {
        if (
          ctx.method === 'password' &&
          ctx.username === TEST_CREDENTIALS.username &&
          ctx.password === TEST_CREDENTIALS.password
        ) {
          ctx.accept()
        } else {
          ctx.reject()
        }
      })

      client.on('ready', () => {
        client.on('session', (accept) => {
          const session = accept()
          session.on('pty', (accept) => {
            ptyRequested = true
            accept && accept()
          })
          session.on('exec', (accept) => {
            const stream = accept()
            stream.write('pty-exec\n')
            stream.exit(0)
            stream.close()
          })
        })
      })
    })

    const credentials = {
      host: 'localhost',
      port: TEST_PORT,
      username: TEST_CREDENTIALS.username,
      password: TEST_CREDENTIALS.password,
    }

    await sshConnection.connect(credentials)
    const stream = await sshConnection.exec('uptime', {
      pty: true,
      term: 'xterm',
      cols: 80,
      rows: 24,
    })

    let stdout = ''
    await new Promise((resolve, reject) => {
      stream.on('data', (data) => (stdout += data.toString('utf-8')))
      stream.on('close', () => resolve())
      stream.on('error', reject)
    })

    assert.equal(ptyRequested, true, 'PTY should be requested for exec')
    assert.match(stdout, /pty-exec/)
  })
})
