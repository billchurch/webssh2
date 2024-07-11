// app/app.js
"use strict";
/* jshint esversion: 6, asi: true, node: true */

const path = require("path");
const express = require("express");
const session = require("express-session");
const logger = require("morgan");
const socketIo = require("socket.io");
const myutil = require("./util");
const config = require("./config");
const socketHandler = require("./socket");

const app = express();
const server = require("http").Server(app);

// Session middleware
const sessionMiddleware = session({
  secret: config.session.secret,
  name: config.session.name,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000,
  },
});

// Express middleware
app.use(sessionMiddleware);
if (config.accesslog) app.use(logger("common"));
app.disable("x-powered-by");

// Socket.IO setup
const io = socketIo(server, {
  path: "/ssh/socket.io",
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Socket.io middleware
io.use((socket, next) => {
  sessionMiddleware(socket.request, socket.request.res || {}, next);
});

// WebSocket handling
io.on("connection", (socket) => {
  console.log(
    "New connection:",
    socket.id,
    "Transport:",
    socket.conn.transport.name
  );

  // Call the imported socket handler function only once per connection
  if (!socket.handled) {
    socketHandler(io, socket);
    socket.handled = true;
  }

  socket.on("disconnect", (reason) => {
    console.log("Client disconnected:", socket.id, reason);
  });
});

// Error handling
app.use((req, res, next) => {
  res.status(404).send("Sorry can't find that!");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

module.exports = { server, config, io };
