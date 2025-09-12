import type { Server as HttpServer } from 'node:http';
import type { RequestHandler } from 'express';
import { Server as SocketIOServer } from 'socket.io';
export declare function configureSocketIO(server: HttpServer, sessionMiddleware: RequestHandler, config: {
    getCorsConfig: () => {
        origin: string[];
        methods: string[];
        credentials: boolean;
    };
}): SocketIOServer;
