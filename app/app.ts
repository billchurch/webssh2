import express, { type Application, type RequestHandler } from 'express'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Server as HttpServer } from 'node:http'
import type { Server as IOServer } from 'socket.io'
import { getConfig } from './config.js'
import initSocket from './socket-v2.js'
import { createRoutesV2 as createRoutes } from './routes/routes-v2.js'
import { createTelnetRoutes } from './routes/telnet-routes.js'
import { applyMiddleware } from './middleware.js'
import { createServer, startServer } from './server.js'
import { configureSocketIO, configureTelnetNamespace } from './io.js'
import { handleError, ConfigError } from './errors.js'
import {
  createNamespacedDebug,
  applyLoggingConfiguration,
  logSecurityPostureWarning
} from './logger.js'
import { auditSecurityPosture } from './security-posture.js'
import { MESSAGES } from './constants/index.js'
import { getClientPublicPath } from './client-path.js'
import type { Config } from './types/config.js'
import { initializeGlobalContainer } from './services/setup.js'
import { extractErrorMessage } from './utils/error-messages.js'
import { TOKENS } from './services/container.js'
import type { Services } from './services/interfaces.js'
import { setHandlerThemingConfig } from './connectionHandler.js'
import { setLoadedThemingForInjection } from './services/theming/index.js'
import { cacheControlForAsset } from './utils/static-cache.js'

const debug = createNamespacedDebug('app')

// The shipped client bundle hardcodes its Socket.IO transports as
// ["websocket","polling"] and ignores the list the server injects into
// window.webssh2Config. We rewrite that array as the bundle is served so
// WEBSSH2_OPTIONS_TRANSPORT / ?transport= take effect, and so a failed
// WebSocket upgrade falls back to long-polling instead of erroring.
const CLIENT_BUNDLE_FILENAME = 'webssh2.bundle.js'
const HARDCODED_TRANSPORTS = /transports:\s*\[\s*"websocket"\s*,\s*"polling"\s*\]/
const TRANSPORTS_REPLACEMENT =
  'transports:(window.webssh2Config&&window.webssh2Config.socket&&' +
  'Array.isArray(window.webssh2Config.socket.transports)&&' +
  'window.webssh2Config.socket.transports.length>0?' +
  'window.webssh2Config.socket.transports:["polling","websocket"])'

// Shared options for both static asset mounts. setHeaders runs after
// serve-static writes its default Cache-Control, so the explicit setHeader
// below wins; do not also pass maxAge/immutable here (one mechanism only).
const STATIC_OPTIONS: Parameters<typeof express.static>[1] = {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath): void => {
    res.setHeader('Cache-Control', cacheControlForAsset(filePath))
  },
}

export function createAppAsync(appConfig: Config): {
  app: Application
  sessionMiddleware: RequestHandler
} {
  const app = express()
  app.disable('x-powered-by')
  try {
    const clientPath = getClientPublicPath()
    const { sessionMiddleware } = applyMiddleware(app, appConfig) as unknown as {
      sessionMiddleware: RequestHandler
    }
    const sshRoutes = createRoutes(appConfig)
    // Read and patch the client bundle once at startup (it is stable-named and
    // only changes on a dependency upgrade, which restarts the server). The
    // .replace is a no-op if a future client version already reads the config.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- trusted install dir + constant filename
    const patchedBundle = readFileSync(path.join(clientPath, CLIENT_BUNDLE_FILENAME), 'utf8')
      .replace(HARDCODED_TRANSPORTS, TRANSPORTS_REPLACEMENT)
    // Serve the patched bundle ahead of the static handler. res.send adds an
    // ETag and answers conditional requests with 304 for us.
    const serveBundle: RequestHandler = (_req, res): void => {
      res.type('application/javascript')
      res.setHeader('Cache-Control', cacheControlForAsset(CLIENT_BUNDLE_FILENAME))
      res.send(patchedBundle)
    }
    app.get(`/ssh/assets/${CLIENT_BUNDLE_FILENAME}`, serveBundle)
    app.use('/ssh/assets', express.static(clientPath, STATIC_OPTIONS))
    app.use('/ssh', sshRoutes)

    if (appConfig.telnet?.enabled === true) {
      const telnetRoutes = createTelnetRoutes(appConfig)
      app.get(`/telnet/assets/${CLIENT_BUNDLE_FILENAME}`, serveBundle)
      app.use('/telnet/assets', express.static(clientPath, STATIC_OPTIONS))
      app.use('/telnet', telnetRoutes)
    }

    return { app, sessionMiddleware }
  } catch (err) {
    const message = extractErrorMessage(err)
    throw new ConfigError(`${MESSAGES.EXPRESS_APP_CONFIG_ERROR}: ${message}`)
  }
}

export async function initializeServerAsync(): Promise<{
  server: HttpServer
  io: IOServer
  app: Application
  config: Config
  services: Services
}> {
  try {
    const appConfig = await getConfig()
    debug('Configuration loaded asynchronously')

    applyLoggingConfiguration(appConfig.logging)

    for (const warning of auditSecurityPosture(appConfig)) {
      logSecurityPostureWarning(warning)
    }

    // Pre-warm the theming injection cache and wire the resolved theming
    // config into the connection handler. When theming is disabled (or
    // missing), the handler falls back to the legacy injection path with
    // zero observable behavior change.
    const themingCfg = appConfig.options.theming
    setHandlerThemingConfig(themingCfg)
    if (themingCfg?.enabled === true) {
      setLoadedThemingForInjection(themingCfg)
    }

    // Initialize DI container and services
    const container = initializeGlobalContainer(appConfig)
    const services = container.resolve<Services>(TOKENS.Services)
    debug('Services initialized with DI container')

    const { app, sessionMiddleware } = createAppAsync(appConfig)
    const server = createServer(app)
    const cfgForIO = appConfig as unknown as {
      getCorsConfig: () => { origin: string[]; methods: string[]; credentials: boolean }
    }
    const io = configureSocketIO(server, sessionMiddleware, cfgForIO)

    // Pass services to socket initialization (SSH)
    initSocket(io as Parameters<typeof initSocket>[0], appConfig, services, 'ssh')

    // Configure telnet namespace if enabled
    const telnetIo = configureTelnetNamespace(server, sessionMiddleware, appConfig)
    if (telnetIo !== null) {
      initSocket(telnetIo as Parameters<typeof initSocket>[0], appConfig, services, 'telnet')
      debug('Telnet Socket.IO namespace initialized')
    }

    startServer(server, appConfig)
    debug('Server initialized asynchronously')
    return { server, io, app, config: appConfig, services }
  } catch (err) {
    if (err instanceof Error) {
      handleError(err)
    } else {
      handleError(new Error(String(err)))
    }
    process.exit(1)
  }
}
