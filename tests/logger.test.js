// server
// tests/logger.test.js

const createDebug = require("debug")
const { createNamespacedDebug, logError } = require("../app/logger")

jest.mock("debug")

describe("logger", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    console.error = jest.fn()
  })

  describe("createNamespacedDebug", () => {
    it("should create a debug function with the correct namespace", () => {
      const mockDebug = jest.fn()
      createDebug.mockReturnValue(mockDebug)

      const result = createNamespacedDebug("test")

      expect(createDebug).toHaveBeenCalledWith("webssh2:test")
      expect(result).toBe(mockDebug)
    })
  })

  describe("logError", () => {
    it("should log an error message without an error object", () => {
      const message = "Test error message"

      logError(message)

      expect(console.error).toHaveBeenCalledWith(message)
      expect(console.error).toHaveBeenCalledTimes(1)
    })

    it("should log an error message with an error object", () => {
      const message = "Test error message"
      const error = new Error("Test error")

      logError(message, error)

      expect(console.error).toHaveBeenCalledWith(message)
      expect(console.error).toHaveBeenCalledWith("ERROR: Error: Test error")
      expect(console.error).toHaveBeenCalledTimes(2)
    })
  })
})
