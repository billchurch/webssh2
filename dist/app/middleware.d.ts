import type { RequestHandler, Application } from 'express';
import type { Config } from './types/config.js';
export declare function createAuthMiddleware(config: Config): RequestHandler;
export declare function createSessionMiddleware(config: Config): RequestHandler;
export declare function createBodyParserMiddleware(): RequestHandler[];
export declare function createCookieMiddleware(): RequestHandler;
export declare function createSSOAuthMiddleware(config: Config): RequestHandler;
export declare function createCSRFMiddleware(config: Config): RequestHandler;
export declare function applyMiddleware(app: Application, config: Config): {
    sessionMiddleware: RequestHandler;
};
