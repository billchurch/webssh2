/**
 * SSH Algorithm configuration interface
 */
interface AlgorithmConfig {
    cipher: string[];
    kex: string[];
    hmac: string[];
    compress: string[];
    serverHostKey: string[];
}
/**
 * Supported value types for environment variable parsing
 */
type ValueType = 'string' | 'number' | 'boolean' | 'array' | 'preset';
/**
 * Environment variable description mapping
 */
interface EnvVarInfo {
    path: string;
    type: ValueType;
    description: string;
}
/**
 * Loads configuration from environment variables
 * @returns Configuration object with values from environment variables
 */
export declare function loadEnvironmentConfig(): Record<string, unknown>;
/**
 * Lists all available environment variables with their descriptions
 * @returns Map of environment variable names to descriptions
 */
export declare function getEnvironmentVariableMap(): Record<string, EnvVarInfo>;
/**
 * Gets available algorithm presets
 * @returns Available algorithm presets
 */
export declare function getAlgorithmPresets(): Record<string, AlgorithmConfig>;
export {};
//# sourceMappingURL=envConfig.d.ts.map