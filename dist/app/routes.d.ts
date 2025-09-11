import type { Router } from 'express';
import type { Config } from './types/config.js';
export declare const processHeaderParameters: (source: unknown, session: unknown) => void;
export declare const processEnvironmentVariables: (source: unknown, session: unknown) => void;
export declare const setupSshCredentials: (session: unknown, opts: {
    host: unknown;
    port: unknown;
    username?: unknown;
    password?: unknown;
    term?: unknown;
}) => unknown;
export declare const processSessionRecordingParams: (body: unknown, session: unknown) => void;
export declare const handleRouteError: (err: Error, res: {
    status: (c: number) => {
        send: (b: unknown) => void;
        json: (b: unknown) => void;
    };
}) => void;
export declare const createRoutes: (config: Config) => Router;
