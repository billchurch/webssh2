import type { Application, RequestHandler } from 'express';
import type { Server as HttpServer } from 'node:http';
import type { Server as IOServer } from 'socket.io';
import type { Config } from './types/config.js';
export declare const createAppAsync: (appConfig: Config) => {
    app: Application;
    sessionMiddleware: RequestHandler;
};
export declare const initializeServerAsync: () => Promise<{
    server: HttpServer;
    io: IOServer;
    app: Application;
    config: Config;
}>;
