import express, { type Express } from 'express';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type { WebSSH2Config } from './types/config.js';
interface AppResult {
    app: Express;
    sessionMiddleware: express.RequestHandler;
}
interface ServerResult {
    server: HTTPServer;
    io: SocketIOServer;
    app: Express;
    config: WebSSH2Config;
}
/**
 * Creates and configures the Express application (async version)
 * @param appConfig - Configuration object
 * @returns An object containing the app and sessionMiddleware
 */
declare function createAppAsync(appConfig: WebSSH2Config): AppResult;
/**
 * Initializes and starts the server asynchronously
 * @returns An object containing the server, io, and app instances
 */
declare function initializeServerAsync(): Promise<ServerResult>;
export { initializeServerAsync, createAppAsync };
//# sourceMappingURL=app.d.ts.map