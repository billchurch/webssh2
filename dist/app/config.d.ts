import type { Config } from './types/config.js';
export declare function loadConfigAsync(): Promise<Config>;
export declare function getConfig(): Promise<Config>;
export declare function getCorsConfig(): {
    origin: string[];
    methods: string[];
    credentials: boolean;
};
export declare function resetConfigForTesting(): void;
