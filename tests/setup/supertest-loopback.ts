// tests/setup/supertest-loopback.ts
// Make supertest's throwaway servers listen on 127.0.0.1 only (#604).
//
// supertest calls app.listen(0), which binds the wildcard address, and then
// connects to 127.0.0.1:<port>. On macOS another process can already hold
// that port on 127.0.0.1, so the request reaches the other process and the
// test sees a wrong status code or "socket hang up". Binding to 127.0.0.1
// makes the kernel pick a port that is free there.
//
// Node binds asynchronously when given a host, so serverAddress() starts the
// listen and end() waits for it before sending the request.

import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Server as TlsServer } from 'node:tls'
import supertest from 'supertest'

const LOOPBACK_HOST = '127.0.0.1'
const PENDING_ORIGIN = `http://${LOOPBACK_HOST}:0`

type App = Parameters<supertest.Test['serverAddress']>[0]
type Callback = Parameters<supertest.Test['end']>[0]

interface LoopbackTest extends supertest.Test {
  // supertest closes this server once the response arrives
  _server?: Server
  _loopbackPort?: Promise<number>
}

const proto = supertest.Test.prototype as LoopbackTest
const originalServerAddress = proto.serverAddress
const originalEnd = proto.end

function listenOnLoopback(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, LOOPBACK_HOST, () => {
      server.off('error', reject)
      resolve((server.address() as AddressInfo).port)
    })
  })
}

proto.serverAddress = function serverAddress(this: LoopbackTest, app: App, path: string): string {
  // supertest has already wrapped request handlers in an http.Server
  if (typeof app === 'string' || typeof app === 'function' || app instanceof TlsServer || app.address() !== null) {
    return originalServerAddress.call(this, app, path)
  }
  const server = app as Server
  this._server = server
  this._loopbackPort = listenOnLoopback(server)
  return `${PENDING_ORIGIN}${path}`
}

proto.end = function end(this: LoopbackTest, callback?: Callback): LoopbackTest {
  const pendingPort = this._loopbackPort
  if (pendingPort === undefined) {
    return originalEnd.call(this, callback)
  }
  this._loopbackPort = undefined
  pendingPort.then(
    (port) => {
      this.url = `http://${LOOPBACK_HOST}:${port}${this.url.slice(PENDING_ORIGIN.length)}`
      originalEnd.call(this, callback)
    },
    (error: unknown) => {
      callback?.(error, undefined as unknown as supertest.Response)
    }
  )
  return this
}
