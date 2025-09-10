import type { Server as HttpServer } from 'http';
import type { RequestHandler } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createNamespacedDebug } from './logger.js';
import { DEFAULTS } from './constants.js';

const debug = createNamespacedDebug('app');

/**
 * Configuration interface with CORS support
 */
interface IOConfig {
  getCorsConfig(): {
    origin: string[];
    methods: string[];
    credentials: boolean;
  };
}

/**
 * Configures Socket.IO with the given server
 * @param server - The HTTP server instance
 * @param sessionMiddleware - The session middleware
 * @param config - The configuration object
 * @returns The Socket.IO server instance
 */
export function configureSocketIO(
  server: HttpServer,
  sessionMiddleware: RequestHandler,
  config: IOConfig
): SocketIOServer {
  const io = new SocketIOServer(server, {
    serveClient: false,
    path: DEFAULTS.IO_PATH,
    pingTimeout: DEFAULTS.IO_PING_TIMEOUT,
    pingInterval: DEFAULTS.IO_PING_INTERVAL,
    cors: config.getCorsConfig(),
    // allowEIO3: true, // Allow v2/v3 clients during migration
  });

  // Share session with io sockets using native Socket.IO 4.x approach
  io.use((socket, next) => {
    const req = socket.request as any;
    const res = (socket.request as any).res || {};
    sessionMiddleware(req, res, next as any);
  });

  debug('IO configured');

  return io;
}

export type { IOConfig };