// app/app.js
'use strict'

const http = require('http')
const socketIo = require('socket.io')
const config = require('./config')
const socketHandler = require('./socket')

const server = http.createServer()

const io = socketIo(server, {
  path: '/ssh/socket.io',
  cors: {
    origin: config.origin || ["*.*"],
    methods: ['GET', 'POST'],
    credentials: true
  }
})

io.on('connection', (socket) => {
  console.log(
    'New connection:',
    socket.id,
    'Transport:',
    socket.conn.transport.name
  )

  socketHandler(io, socket)

  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', socket.id, reason)
  })
})

module.exports = { server, config, io }
