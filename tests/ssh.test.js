/* eslint-disable jest/no-conditional-expect */
// server
// tests/ssh.test.js

const SSH2 = require("ssh2")
const SSHConnection = require("../app/ssh")
const { SSHConnectionError } = require("../app/errors")
const { DEFAULTS } = require("../app/constants")

jest.mock("ssh2")
jest.mock("../app/logger", () => ({
  createNamespacedDebug: jest.fn(() => jest.fn()),
  logError: jest.fn()
}))
jest.mock("../app/utils", () => ({
  maskSensitiveData: jest.fn((data) => data)
}))
jest.mock("../app/errors", () => ({
  SSHConnectionError: jest.fn(function (message) {
    this.message = message
  }),
  handleError: jest.fn()
}))

describe("SSHConnection", () => {
  let sshConnection
  let mockConfig
  let mockSSH2Client
  let registeredEventHandlers

  beforeEach(() => {
    registeredEventHandlers = {}

    mockConfig = {
      ssh: {
        algorithms: {
          kex: ["algo1", "algo2"],
          cipher: ["cipher1", "cipher2"],
          serverHostKey: ["ssh-rsa", "ssh-dss"],
          hmac: ["hmac1", "hmac2"],
          compress: ["none", "zlib"]
        },
        readyTimeout: 20000,
        keepaliveInterval: 60000,
        keepaliveCountMax: 10
      },
      user: {
        name: null,
        password: null,
        privateKey: null
      }
    }

    mockSSH2Client = {
      on: jest.fn((event, handler) => {
        registeredEventHandlers[event] = handler
      }),
      connect: jest.fn(() => {
        process.nextTick(() => {
          // By default, emit ready event unless test modifies this behavior
          if (registeredEventHandlers.ready) {
            registeredEventHandlers.ready()
          }
        })
      }),
      shell: jest.fn(),
      end: jest.fn()
    }

    SSH2.Client.mockImplementation(() => mockSSH2Client)
    sshConnection = new SSHConnection(mockConfig)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("connect", () => {
    it("should handle immediate connection errors", () => {
      const mockCreds = {
        host: "localhost",
        port: 22,
        username: "user",
        password: "pass"
      }

      // Mock the connect method to throw an error immediately
      mockSSH2Client.connect.mockImplementation(() => {
        throw new Error("Spooky Error") // Immediate error
      })

      return sshConnection.connect(mockCreds).catch((error) => {
        expect(error).toBeInstanceOf(SSHConnectionError)
        expect(error.message).toBe("Connection failed: Spooky Error")
      })
    })

    it("should connect successfully with password", () => {
      const mockCreds = {
        host: "localhost",
        port: 22,
        username: "user",
        password: "pass"
      }

      return sshConnection.connect(mockCreds).then(() => {
        expect(mockSSH2Client.connect).toHaveBeenCalledWith(
          expect.objectContaining({
            host: mockCreds.host,
            port: mockCreds.port,
            username: mockCreds.username,
            password: mockCreds.password,
            tryKeyboard: true
          })
        )
      })
    })

    it("should fail after max authentication attempts", () => {
      const mockCreds = {
        host: "localhost",
        port: 22,
        username: "user",
        password: "wrongpass"
      }

      const attempts = DEFAULTS.MAX_AUTH_ATTEMPTS + 1
      mockSSH2Client.connect.mockImplementation(() => {
        process.nextTick(() => {
          registeredEventHandlers.error(new Error("Authentication failed"))
        })
      })

      return sshConnection.connect(mockCreds).catch((error) => {
        expect(error).toBeInstanceOf(SSHConnectionError)
        expect(error.message).toBe("All authentication methods failed")
        expect(mockSSH2Client.connect.mock.calls.length).toBe(attempts)
      })
    })

    describe("key authentication", () => {
      const validPrivateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpTestKeyContentHere
-----END RSA PRIVATE KEY-----`

      it("should try private key first when both password and key are provided", () => {
        const mockCreds = {
          host: "localhost",
          port: 22,
          username: "user",
          password: "pass",
          privateKey: validPrivateKey
        }

        return sshConnection.connect(mockCreds).then(() => {
          expect(mockSSH2Client.connect).toHaveBeenCalledWith(
            expect.objectContaining({
              privateKey: validPrivateKey,
              username: mockCreds.username
            })
          )
        })
      })

      it("should fall back to password after key authentication failure", () => {
        const mockCreds = {
          host: "localhost",
          port: 22,
          username: "user",
          password: "pass",
          privateKey: validPrivateKey
        }

        let authAttempts = 0
        mockSSH2Client.connect
          .mockImplementationOnce(() => {
            process.nextTick(() => {
              authAttempts += 1
              registeredEventHandlers.error(
                new Error("Key authentication failed")
              )
            })
          })
          .mockImplementationOnce(() => {
            process.nextTick(() => {
              authAttempts += 1
              registeredEventHandlers.ready()
            })
          })

        return sshConnection.connect(mockCreds).then(() => {
          expect(authAttempts).toBe(2)
          expect(mockSSH2Client.connect).toHaveBeenCalledTimes(2)
          // Verify second attempt used password
          expect(mockSSH2Client.connect).toHaveBeenLastCalledWith(
            expect.objectContaining({
              password: mockCreds.password
            })
          )
        })
      })

      it("should reject invalid private key format", () => {
        const mockCreds = {
          host: "localhost",
          port: 22,
          username: "user",
          privateKey: "invalid-key-format"
        }

        return sshConnection.connect(mockCreds).catch((error) => {
          expect(error).toBeInstanceOf(SSHConnectionError)
          expect(error.message).toBe("Invalid private key format")
        })
      })
    })
  })

  describe("shell", () => {
    beforeEach(() => {
      sshConnection.conn = mockSSH2Client
    })

    it("should open shell successfully", () => {
      const mockStream = {
        on: jest.fn(),
        stderr: { on: jest.fn() }
      }

      mockSSH2Client.shell.mockImplementation((options, callback) => {
        process.nextTick(() => callback(null, mockStream))
      })

      return sshConnection.shell().then((result) => {
        expect(result).toBe(mockStream)
        expect(sshConnection.stream).toBe(mockStream)
      })
    })

    it("should handle shell creation errors", () => {
      mockSSH2Client.shell.mockImplementation((options, callback) => {
        process.nextTick(() => callback(new Error("Shell error")))
      })

      return sshConnection.shell().catch((error) => {
        expect(error.message).toBe("Shell error")
      })
    })
  })

  describe("resizeTerminal", () => {
    it("should resize terminal if stream exists", () => {
      const mockStream = {
        setWindow: jest.fn()
      }
      sshConnection.stream = mockStream

      sshConnection.resizeTerminal(80, 24)
      expect(mockStream.setWindow).toHaveBeenCalledWith(80, 24)
    })

    it("should do nothing if stream does not exist", () => {
      sshConnection.stream = null
      expect(() => sshConnection.resizeTerminal(80, 24)).not.toThrow()
    })
  })

  describe("end", () => {
    it("should close stream and connection", () => {
      const mockStream = {
        end: jest.fn()
      }
      sshConnection.stream = mockStream
      sshConnection.conn = mockSSH2Client

      sshConnection.end()

      expect(mockStream.end).toHaveBeenCalled()
      expect(mockSSH2Client.end).toHaveBeenCalled()
      expect(sshConnection.stream).toBeNull()
      expect(sshConnection.conn).toBeNull()
    })

    it("should handle cleanup when no stream or connection exists", () => {
      sshConnection.stream = null
      sshConnection.conn = null

      expect(() => sshConnection.end()).not.toThrow()
    })
  })
})
