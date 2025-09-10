import type { WebSSH2Config } from './types/config.js';
/**
 * Extended configuration interface that includes all possible configuration options
 */
interface ExtendedWebSSH2Config extends WebSSH2Config {
    options: {
        challengeButton: boolean;
        autoLog: boolean;
        allowReauth: boolean;
        allowReconnect: boolean;
        allowReplay: boolean;
    };
    session: {
        secret: string;
        name: string;
    };
    sso: {
        enabled: boolean;
        csrfProtection: boolean;
        trustedProxies: string[];
        headerMapping: {
            username: string;
            password: string;
            session: string;
        };
    };
    getCorsConfig?: () => CorsConfig;
}
/**
 * CORS configuration interface
 */
interface CorsConfig {
    origin: string[];
    methods: string[];
    credentials: boolean;
}
declare function getConfigPath(): string;
/**
 * Asynchronously loads configuration with priority: ENV vars > config.json > defaults
 * @returns Configuration object
 */
declare function loadConfigAsync(): Promise<ExtendedWebSSH2Config>;
/**
 * Gets the initialized configuration instance
 * @returns Configuration object
 */
export declare function getConfig(): Promise<ExtendedWebSSH2Config>;
/**
 * Gets CORS configuration based on current config
 * @returns CORS configuration object
 */
declare function getCorsConfig(): CorsConfig;
/**
 * Resets the configuration instance for testing purposes
 * @internal
 */
declare function resetConfigForTesting(): void;
export { loadConfigAsync, getConfigPath, getCorsConfig, resetConfigForTesting };
export type { ExtendedWebSSH2Config, CorsConfig };
//# sourceMappingURL=config.d.ts.map