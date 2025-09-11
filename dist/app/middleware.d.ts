/**
 * Middleware function that handles HTTP Basic Authentication for the application.
 *
 * If the `config.user.name` and `config.user.password` are set, it will use those
 * credentials to authenticate the request and set the `req.session.sshCredentials`
 * object with the username and password.
 *
 * If the `config.user.name` and `config.user.password` are not set, it will attempt
 * to use HTTP Basic Authentication to authenticate the request. It will validate and
 * sanitize the credentials, and set the `req.session.sshCredentials` object with the
 * username and password.
 *
 * The function will also set the `req.session.usedBasicAuth` flag to indicate that
 * Basic Authentication was used.
 *
 * If the authentication fails, the function will send a 401 Unauthorized response
 * with the appropriate WWW-Authenticate header.
 */
export function createAuthMiddleware(config: any): (req: any, res: any, next: any) => any;
/**
 * Creates and configures session middleware
 * @param {Object} config - The configuration object
 * @returns {Function} The session middleware
 */
export function createSessionMiddleware(config: Object): Function;
/**
 * Creates body parser middleware
 * @returns {Function[]} Array of body parser middleware
 */
export function createBodyParserMiddleware(): Function[];
/**
 * Creates cookie-setting middleware
 * @returns {Function} The cookie-setting middleware
 */
export function createCookieMiddleware(): Function;
/**
 * Creates SSO authentication middleware for POST requests
 * Extracts credentials from POST body or APM headers
 * @param {Object} config - The configuration object
 * @returns {Function} The SSO middleware
 */
export function createSSOAuthMiddleware(config: Object): Function;
/**
 * Creates CSRF protection middleware for SSO
 * @param {Object} config - The configuration object
 * @returns {Function} The CSRF middleware
 */
export function createCSRFMiddleware(config: Object): Function;
/**
 * Applies all middleware to the Express app
 * @param {express.Application} app - The Express application
 * @param {Object} config - The configuration object
 * @returns {Object} An object containing the session middleware
 */
export function applyMiddleware(app: express.Application, config: Object): Object;
