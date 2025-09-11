/**
 * Creates and configures the HTTP server
 * @param {express.Application} app - The Express application instance
 * @returns {http.Server} The HTTP server instance
 */
export function createServer(app: express.Application): http.Server;
/**
 * Starts the server
 * @param {http.Server} server - The server instance
 * @param {Object} config - The configuration object
 */
export function startServer(server: http.Server, config: Object): void;
import http from 'http';
