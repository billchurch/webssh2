export type EnvValueType = 'string' | 'number' | 'boolean' | 'array' | 'preset';
type Algorithms = {
    cipher: string[];
    kex: string[];
    hmac: string[];
    compress: string[];
    serverHostKey: string[];
};
export type EnvVarMap = {
    path: string;
    type: EnvValueType;
};
export declare function loadEnvironmentConfig(): Record<string, unknown>;
export declare function getEnvironmentVariableMap(): Record<string, {
    path: string;
    type: EnvValueType;
    description: string;
}>;
export declare function getAlgorithmPresets(): Record<string, Algorithms>;
export {};
