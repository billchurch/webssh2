const {
  WebSSH2Error,
  ConfigError,
  SSHConnectionError,
  handleError
} = require("../app/errors")
const { logError } = require("../app/logger")
const { HTTP, MESSAGES } = require("../app/constants")

jest.mock("../app/logger", () => ({
  logError: jest.fn(),
  createNamespacedDebug: jest.fn(() => jest.fn())
}))

describe("errors", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("WebSSH2Error", () => {
    it("should create a WebSSH2Error with correct properties", () => {
      const error = new WebSSH2Error("Test error", "TEST_CODE")
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe("WebSSH2Error")
      expect(error.message).toBe("Test error")
      expect(error.code).toBe("TEST_CODE")
    })
  })

  describe("ConfigError", () => {
    it("should create a ConfigError with correct properties", () => {
      const error = new ConfigError("Config error")
      expect(error).toBeInstanceOf(WebSSH2Error)
      expect(error.name).toBe("ConfigError")
      expect(error.message).toBe("Config error")
      expect(error.code).toBe(MESSAGES.CONFIG_ERROR)
    })
  })

  describe("SSHConnectionError", () => {
    it("should create a SSHConnectionError with correct properties", () => {
      const error = new SSHConnectionError("SSH connection error")
      expect(error).toBeInstanceOf(WebSSH2Error)
      expect(error.name).toBe("SSHConnectionError")
      expect(error.message).toBe("SSH connection error")
      expect(error.code).toBe(MESSAGES.SSH_CONNECTION_ERROR)
    })
  })

  describe("handleError", () => {
    const mockRes = {
      status: jest.fn(() => mockRes),
      json: jest.fn()
    }

    it("should handle WebSSH2Error correctly", () => {
      const error = new WebSSH2Error("Test error", "TEST_CODE")
      handleError(error, mockRes)

      expect(logError).toHaveBeenCalledWith("Test error", error)
      expect(mockRes.status).toHaveBeenCalledWith(HTTP.INTERNAL_SERVER_ERROR)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Test error",
        code: "TEST_CODE"
      })
    })

    it("should handle generic Error correctly", () => {
      const error = new Error("Generic error")
      handleError(error, mockRes)

      expect(logError).toHaveBeenCalledWith(MESSAGES.UNEXPECTED_ERROR, error)
      expect(mockRes.status).toHaveBeenCalledWith(HTTP.INTERNAL_SERVER_ERROR)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: MESSAGES.UNEXPECTED_ERROR
      })
    })

    it("should not send response if res is not provided", () => {
      const error = new Error("No response error")
      handleError(error)

      expect(logError).toHaveBeenCalledWith(MESSAGES.UNEXPECTED_ERROR, error)
      expect(mockRes.status).not.toHaveBeenCalled()
      expect(mockRes.json).not.toHaveBeenCalled()
    })
  })
})
