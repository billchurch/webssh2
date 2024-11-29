// server
// tests/socket.test.js

const EventEmitter = require("events")
const socketHandler = require("../app/socket")
// const WebSSH2Socket = require("../app/socket")

jest.mock("../app/ssh")

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

    socketHandler(io, config)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test("should set up connection listener on io", () => {
    expect(io.on).toHaveBeenCalledWith("connection", expect.any(Function))
  })

  test("should set up authenticate event listener on socket", () => {
    expect(socket.listeners("authenticate")).toHaveLength(1)
  })

  test("should set up terminal event listener on socket", () => {
    expect(socket.listeners("terminal")).toHaveLength(1)
  })

  test("should set up disconnect event listener on socket", () => {
    expect(socket.listeners("disconnect")).toHaveLength(1)
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
    // build out later
  })

  test("should handle terminal event", () => {
    const terminalData = {
      term: "xterm",
      rows: 24,
      cols: 80
    }
    socket.emit("terminal", terminalData)
    // build out later
  })

  test("should handle disconnect event", () => {
    const reason = "test-reason"
    socket.emit("disconnect", reason)
    // build out later
  })
})
