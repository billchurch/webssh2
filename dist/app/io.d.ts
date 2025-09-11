/**
 * Configures Socket.IO with the given server
 * @param {import('node:http').Server} server - The HTTP server instance
 * @param {(req: any, res: any, next: (err?: any) => void) => void} sessionMiddleware - session middleware
 * @param {{ getCorsConfig: () => { origin: string[]; methods: string[]; credentials: boolean } }} config
 * @returns {import('socket.io').Server} The Socket.IO server instance
 */
export function configureSocketIO(server: import("node:http").Server, sessionMiddleware: (req: any, res: any, next: (err?: any) => void) => void, config: {
    getCorsConfig: () => {
        origin: string[];
        methods: string[];
        credentials: boolean;
    };
}): import("socket.io").Server;
