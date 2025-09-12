import type { RequestHandler } from 'express';
import type { Config } from './types/config.js';
export declare const CSP_CONFIG: Record<string, string[]>;
export declare function generateCSPHeader(): string;
export declare const SECURITY_HEADERS: Record<string, string>;
export declare function createSecurityHeadersMiddleware(config?: Partial<Config>): RequestHandler;
export declare function createCSPMiddleware(customCSP?: Partial<Record<keyof typeof CSP_CONFIG, string[]>>): RequestHandler;
