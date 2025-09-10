import type { Request, Response, NextFunction, Application } from 'express';
import type { SessionData } from 'express-session';
import session from 'express-session';
/**
 * Extended session interface to include custom properties
 */
interface ExtendedSessionData extends SessionData {
    sshCredentials?: {
        username: string;
        password?: string;
        privateKey?: string;
        host?: string;
        port?: number;
    };
    usedBasicAuth?: boolean;
    csrfToken?: string;
}
/**
 * Extended request interface
 */
interface ExtendedRequest extends Request {
    session: ExtendedSessionData & session.Session;
}
/**
 * Configuration interface for middleware
 */
interface MiddlewareConfig {
    user: {
        name: string | null;
        password?: string | null;
        privateKey?: string | null;
    };
    session: {
        secret: string;
        name: string;
    };
    sso?: {
        enabled?: boolean;
        csrfProtection?: boolean;
        trustedProxies?: string[];
    };
}
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
export declare function createAuthMiddleware(config: MiddlewareConfig): (req: ExtendedRequest, res: Response, next: NextFunction) => void;
/**
 * Creates and configures session middleware
 * @param config - The configuration object
 * @returns The session middleware
 */
export declare function createSessionMiddleware(config: MiddlewareConfig): import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * Creates body parser middleware
 * @returns Array of body parser middleware
 */
export declare function createBodyParserMiddleware(): import("connect").NextHandleFunction[];
/**
 * Creates cookie-setting middleware
 * @returns The cookie-setting middleware
 */
export declare function createCookieMiddleware(): (req: ExtendedRequest, res: Response, next: NextFunction) => void;
/**
 * Creates SSO authentication middleware for POST requests
 * Extracts credentials from POST body or APM headers
 * @param config - The configuration object
 * @returns The SSO middleware
 */
export declare function createSSOAuthMiddleware(config: MiddlewareConfig): (req: ExtendedRequest, _res: Response, next: NextFunction) => void;
/**
 * Creates CSRF protection middleware for SSO
 * @param config - The configuration object
 * @returns The CSRF middleware
 */
export declare function createCSRFMiddleware(config: MiddlewareConfig): (req: ExtendedRequest, res: Response, next: NextFunction) => void;
/**
 * Return type for applyMiddleware function
 */
interface MiddlewareResult {
    sessionMiddleware: ReturnType<typeof session>;
}
/**
 * Applies all middleware to the Express app
 * @param app - The Express application
 * @param config - The configuration object
 * @returns An object containing the session middleware
 */
export declare function applyMiddleware(app: Application, config: MiddlewareConfig): MiddlewareResult;
export type { ExtendedRequest, ExtendedSessionData, MiddlewareConfig, MiddlewareResult };
//# sourceMappingURL=middleware.d.ts.map