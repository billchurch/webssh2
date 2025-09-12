import type { Config } from './types/config.js';
import type { Credentials } from './utils.js';
export interface SSHStreamLike {
    on(event: string, listener: (...args: any[]) => void): this;
    end?: () => void;
    setWindow?: (rows: number, cols: number) => void;
    write?: (data: string | Uint8Array) => void;
}
export interface SSHConnectionLike {
    validatePrivateKey(key: string): boolean;
    isEncryptedKey(key: string): boolean;
    connect(creds: Credentials): Promise<unknown>;
    setupConnectionHandlers?: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => void;
    shell(options: {
        term?: string | null;
        rows?: number;
        cols?: number;
        width?: number;
        height?: number;
    }, envVars?: Record<string, string> | null): Promise<SSHStreamLike>;
    exec(command: string, options?: {
        pty?: boolean;
        term?: string;
        rows?: number;
        cols?: number;
        width?: number;
        height?: number;
    }, envVars?: Record<string, string>): Promise<SSHStreamLike>;
    resizeTerminal(rows: number, cols: number): void;
    end(): void;
}
declare const SSHConnection: {
    new (config: Config): SSHConnectionLike;
};
export default SSHConnection;
