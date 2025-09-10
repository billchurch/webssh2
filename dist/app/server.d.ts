import type { Application } from 'express';
import type { Server } from 'http';
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
export declare function createServer(app: Application): Server;
/**
 * Starts the server
 * @param server - The server instance
 * @param config - The configuration object
 */
export declare function startServer(server: Server, config: ServerConfig): void;
export type { ServerConfig };
//# sourceMappingURL=server.d.ts.map