import type { RequestHandler, Application } from 'express';
import type { Config } from './types/config.js';
export declare const createAuthMiddleware: (config: Config) => RequestHandler;
export declare const createSessionMiddleware: (config: Config) => RequestHandler;
export declare const createBodyParserMiddleware: () => RequestHandler[];
export declare const createCookieMiddleware: () => RequestHandler;
export declare const createSSOAuthMiddleware: (config: Config) => RequestHandler;
export declare const createCSRFMiddleware: (config: Config) => RequestHandler;
export declare const applyMiddleware: (app: Application, config: Config) => {
    sessionMiddleware: RequestHandler;
};
