// app/socket.js
"use strict";

const debug = require("debug");
const debugWebSSH2 = require("debug")("WebSSH2");
const SSH = require("ssh2").Client;

module.exports = function (io) {
  io.on("connection", (socket) => {
    let conn = null;
    let stream = null;
    console.log(`SOCKET CONNECT: ${socket.id}`);

    // Remove existing listeners to prevent duplicates
    socket.removeAllListeners("authenticate");
    socket.removeAllListeners("data");
    socket.removeAllListeners("resize");
    socket.removeAllListeners("disconnect");

    // Authenticate user
    socket.on("authenticate", (credentials) => {
      console.log(`SOCKET AUTHENTICATE: ${socket.id}`);
      if (isValidCredentials(credentials)) {
        console.log(`SOCKET AUTHENTICATE SUCCESS: ${socket.id}`);
        initializeConnection(socket, credentials);
      } else {
        console.log(`SOCKET AUTHENTICATE FAILED: ${socket.id}`);
        socket.emit("auth_result", {
          success: false,
          message: "Invalid credentials",
        });
      }
    });

    socket.on("disconnect", (reason) => {
      debugWebSSH2(`SOCKET DISCONNECT: ${socket.id}, Reason: ${reason}`);
      if (conn) {
        conn.end();
      }
      // Clean up listeners
      socket.removeAllListeners();
    });

    socket.on("data", (data) => {
      if (stream) {
        stream.write(data);
      }
    });

    socket.on("resize", (data) => {
      if (stream) {
        stream.setWindow(data.rows, data.cols);
      }
    });

    function initializeConnection(socket, credentials) {
      if (conn) {
        // If there's an existing connection, end it before creating a new one
        conn.end();
      }

      conn = new SSH();

      conn.on("ready", () => {
        console.log(
          `WebSSH2 Login: user=${credentials.username} from=${socket.handshake.address} host=${credentials.host} port=${credentials.port} sessionID=${socket.id}`
        );

        socket.emit("auth_result", { success: true });
        socket.emit("allowreauth", true);
        socket.emit("allowreplay", true);
        socket.emit("title", `ssh://${credentials.host}`);
        socket.emit("status", "SSH CONNECTION ESTABLISHED");
        socket.emit("statusBackground", "green");

        conn.shell(
          {
            term: credentials.term,
            cols: credentials.cols,
            rows: credentials.rows
          },
          (err, str) => {
            if (err) {
              return SSHerror("EXEC ERROR", err);
            }
            stream = str;

            stream.on("data", (data) => {
              socket.emit("data", data.toString("utf-8"));
            });

            stream.on("close", (code, signal) => {
              SSHerror("STREAM CLOSE", {
                message:
                  code || signal
                    ? `CODE: ${code} SIGNAL: ${signal}`
                    : undefined,
              });
            });

            stream.stderr.on("data", (data) => {
              console.log("STDERR: " + data);
            });
          }
        );
      });

      conn.on("banner", (data) => {
        socket.emit("data", data.replace(/\r?\n/g, "\r\n"));
      });

      conn.on("end", () => SSHerror("CONN END BY HOST"));
      conn.on("close", () => SSHerror("CONN CLOSE"));
      conn.on("error", (err) => SSHerror("CONN ERROR", err));

      conn.connect({
        host: credentials.host,
        port: credentials.port,
        username: credentials.username,
        password: credentials.password,
        tryKeyboard: true,
        algorithms: credentials.algorithms,
        readyTimeout: credentials.readyTimeout,
        keepaliveInterval: credentials.keepaliveInterval,
        keepaliveCountMax: credentials.keepaliveCountMax,
        debug: debug("ssh2")
      });
    }

    function SSHerror(myFunc, err) {
      const errorMessage = err ? `: ${err.message}` : "";
      console.log(`WebSSH2 error: ${myFunc}${errorMessage}`);
      socket.emit("ssherror", `SSH ${myFunc}${errorMessage}`);
      if (conn) {
        conn.end();
      }
      // Don't disconnect the socket here, let the client handle reconnection if necessary
      // socket.disconnect(true);
    }

    function isValidCredentials(credentials) {
      // Implement your credential validation logic here
      return credentials && credentials.username && credentials.password;
    }
  });
};
