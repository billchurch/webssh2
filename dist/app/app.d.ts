/**
 * Initializes and starts the server asynchronously
 * @returns {Promise<Object>} An object containing the server, io, and app instances
 */
export function initializeServerAsync(): Promise<Object>;
/**
 * Creates and configures the Express application (async version)
 * @param {Object} appConfig - Configuration object
 * @returns {Promise<Object>} An object containing the app and sessionMiddleware
 */
export function createAppAsync(appConfig: Object): Promise<Object>;
