import { EventEmitter } from 'events';
import type { Config } from './types/config.js';
export default class SSHConnection extends EventEmitter {
    private config;
    private conn;
    private stream;
    private creds;
    constructor(config: Config);
    validatePrivateKey(key: string): boolean;
    isEncryptedKey(key: string): boolean;
    connect(creds: Record<string, unknown>): Promise<unknown>;
    private setupConnectionHandlers;
    shell(options: {
        term?: string | null;
        rows?: number;
        cols?: number;
        width?: number;
        height?: number;
    }, envVars?: Record<string, string> | null): Promise<unknown>;
    exec(command: string, options?: {
        pty?: boolean;
        term?: string;
        rows?: number;
        cols?: number;
        width?: number;
        height?: number;
    }, envVars?: Record<string, string>): Promise<unknown>;
    resizeTerminal(rows: number, cols: number): void;
    end(): void;
    private getEnvironment;
    private getSSHConfig;
}
