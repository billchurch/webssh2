import { type Router } from 'express';
import type { Config } from './types/config.js';
type Sess = {
    headerOverride?: {
        text?: unknown;
        background?: unknown;
        style?: unknown;
    };
    sshCredentials?: {
        host?: string;
        port?: number;
        username?: string;
        password?: string;
        term?: string | null;
    };
    usedBasicAuth?: boolean;
    allowReplay?: boolean;
    mrhSession?: unknown;
    readyTimeout?: number;
    authMethod?: string;
    [k: string]: unknown;
};
export declare function processHeaderParameters(source: Record<string, unknown> | undefined, session: Sess): void;
export declare function processEnvironmentVariables(source: Record<string, unknown>, session: Sess): void;
export declare function setupSshCredentials(session: Sess, opts: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    term?: string | null;
}): unknown;
export declare function processSessionRecordingParams(body: Record<string, unknown>, session: Sess): void;
export declare function handleRouteError(err: Error, res: {
    status: (c: number) => {
        send: (b: unknown) => void;
        json: (b: unknown) => void;
    };
}): void;
export declare function createRoutes(config: Config): Router;
export {};
