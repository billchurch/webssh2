const EventEmitter = require("events")
const socketHandler = require("../app/socket")

class MockSSHConnection extends EventEmitter {
  constructor() {
    super()
    this.connect = jest.fn().mockResolvedValue(true)
    this.shell = jest.fn().mockResolvedValue(true)
    this.end = jest.fn()
  }
}

describe("socketHandler", () => {
  let io
  let socket
  let config

  beforeEach(() => {
    socket = new EventEmitter()
    socket.id = "test-socket-id"
    socket.handshake = {
      session: {}
    }
    socket.emit = jest.fn()
    socket.disconnect = jest.fn()

    io = {
      on: jest.fn((event, callback) => {
        if (event === "connection") {
          callback(socket)
        }
      })
    }

    config = {
      ssh: {
        term: "xterm-color"
      },
      options: {
        allowreauth: true
      }
    }

    socketHandler(io, config, MockSSHConnection)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test("should set up connection listener on io", () => {
    expect(io.on).toHaveBeenCalledWith("connection", expect.any(Function))
  })

  test("should emit request_auth when not authenticated", () => {
    expect(socket.emit).toHaveBeenCalledWith("authentication", {
      action: "request_auth"
    })
  })

  test("should handle authenticate event", () => {
    const creds = {
      username: "testuser",
      password: "testpass",
      host: "testhost",
      port: 22
    }
    socket.emit("authenticate", creds)
    expect(socket.emit).toHaveBeenCalledWith(
      "authentication",
      expect.any(Object)
    )
  })

  test("should handle terminal event", () => {
    const terminalData = {
      term: "xterm",
      rows: 24,
      cols: 80
    }
    socket.emit("terminal", terminalData)
  })

  test("should handle disconnect event", () => {
    const reason = "test-reason"
    socket.emit("disconnect", reason)
  })
})
