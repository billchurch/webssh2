import type { RequestHandler } from 'express';
export declare const CSP_CONFIG: Record<string, string[]>;
export declare const SECURITY_HEADERS: Record<string, string>;
export declare const generateCSPHeader: () => string;
import type { Config } from './types/config.js';
export declare const createSecurityHeadersMiddleware: (config?: Partial<Config>) => RequestHandler;
export declare const createCSPMiddleware: (customCSP?: Partial<Record<keyof typeof CSP_CONFIG, string[]>>) => RequestHandler;
