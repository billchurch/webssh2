export declare function deepMerge<T extends object>(target: T, source: unknown): T;
export declare function getValidatedHost(host: string): string;
export declare function getValidatedPort(portInput?: string): number;
export interface Credentials {
    username?: string;
    host?: string;
    port?: number;
    password?: string;
    privateKey?: string;
    passphrase?: string;
    term?: string;
    cols?: number | string;
    rows?: number | string;
}
export declare function isValidCredentials(creds: Credentials | undefined): boolean;
export declare function validateSshTerm(term?: string): string | null;
export declare function validateConfig(config: unknown): unknown;
export declare function modifyHtml(html: string, config: unknown): string;
export declare function maskSensitiveData(obj: unknown, options?: unknown): unknown;
export declare function isValidEnvKey(key: string): boolean;
export declare function isValidEnvValue(value: string): boolean;
export declare function parseEnvVars(envString?: string): Record<string, string> | null;
