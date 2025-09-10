import type { Application } from 'express';
import type { Server } from 'http';
import http from 'http';
import debug from 'debug';

const serverDebug = debug('webssh:server');

/**
 * Server configuration interface
 */
interface ServerConfig {
  listen: {
    port: number;
    ip: string;
  };
}

/**
 * Creates and configures the HTTP server
 * @param app - The Express application instance
 * @returns The HTTP server instance
 */
export function createServer(app: Application): Server {
  return http.createServer(app);
}

/**
 * Handles server errors
 * @param err - The error object
 */
function handleServerError(err: Error): void {
  console.error('HTTP Server ERROR: %O', err);
}

/**
 * Starts the server
 * @param server - The server instance
 * @param config - The configuration object
 */
export function startServer(server: Server, config: ServerConfig): void {
  server.listen(config.listen.port, config.listen.ip, () => {
    serverDebug(`Server listening on ${config.listen.ip}:${config.listen.port}`);
  });

  server.on('error', handleServerError);
}

export type { ServerConfig };