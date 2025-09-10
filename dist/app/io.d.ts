import type { Server as HttpServer } from 'http';
import type { RequestHandler } from 'express';
import { Server as SocketIOServer } from 'socket.io';
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
export declare function configureSocketIO(server: HttpServer, sessionMiddleware: RequestHandler, config: IOConfig): SocketIOServer;
export type { IOConfig };
//# sourceMappingURL=io.d.ts.map