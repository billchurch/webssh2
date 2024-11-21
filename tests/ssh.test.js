// server
// tests/ssh.test.js

const SSH2 = require("ssh2")
const SSHConnection = require("../app/ssh")
const { SSHConnectionError } = require("../app/errors")
const { maskSensitiveData } = require("../app/utils")

jest.mock("ssh2")
jest.mock("../app/logger", () => ({
  createNamespacedDebug: jest.fn(() => jest.fn()),
  logError: jest.fn()
}))
jest.mock("../app/utils", () => ({
  maskSensitiveData: jest.fn(data => data)
}))
jest.mock("../app/errors", () => ({
  SSHConnectionError: jest.fn(function(message) {
    this.message = message
  }),
  handleError: jest.fn()
}))

describe("SSHConnection", () => {
  let sshConnection
  let mockConfig
  let mockSSH2Client

  beforeEach(() => {
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
      }
    }
    sshConnection = new SSHConnection(mockConfig)
    mockSSH2Client = {
      on: jest.fn(),
      connect: jest.fn(),
      shell: jest.fn(),
      end: jest.fn()
    }
    SSH2.Client.mockImplementation(() => mockSSH2Client)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("connect", () => {
    // ... previous tests ...

    it("should handle connection errors", () => {
      const mockCreds = {
        host: "example.com",
        port: 22,
        username: "user",
        password: "pass"
      }

      mockSSH2Client.on.mockImplementation((event, callback) => {
        if (event === "error") {
          callback(new Error("Connection failed"))
        }
      })

      return sshConnection.connect(mockCreds).catch(error => {
        expect(error).toBeInstanceOf(SSHConnectionError)
        expect(error.message).toBe("Connection failed")
      })
    })
  })

  describe("shell", () => {
    beforeEach(() => {
      sshConnection.conn = mockSSH2Client
    })

    it("should open a shell successfully", () => {
      const mockStream = {
        on: jest.fn(),
        stderr: { on: jest.fn() }
      }

      mockSSH2Client.shell.mockImplementation((options, callback) => {
        callback(null, mockStream)
      })

      return sshConnection.shell().then(result => {
        expect(result).toBe(mockStream)
        expect(sshConnection.stream).toBe(mockStream)
      })
    })

    it("should handle shell errors", () => {
      mockSSH2Client.shell.mockImplementation((options, callback) => {
        callback(new Error("Shell error"))
      })

      return sshConnection.shell().catch(error => {
        expect(error.message).toBe("Shell error")
      })
    })
  })

  describe("resizeTerminal", () => {
    it("should resize the terminal if stream exists", () => {
      const mockStream = {
        setWindow: jest.fn()
      }
      sshConnection.stream = mockStream

      sshConnection.resizeTerminal(80, 24)

      expect(mockStream.setWindow).toHaveBeenCalledWith(80, 24)
    })

    it("should not resize if stream does not exist", () => {
      sshConnection.stream = null

      sshConnection.resizeTerminal(80, 24)

      // No error should be thrown
    })
  })

  describe("end", () => {
    it("should end the stream and connection", () => {
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

    it("should handle ending when stream and connection do not exist", () => {
      sshConnection.stream = null
      sshConnection.conn = null

      sshConnection.end()

      // No error should be thrown
    })
  })
})
