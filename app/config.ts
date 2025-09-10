// server
// app/config.ts

import path, { dirname } from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { deepMerge, validateConfig } from './utils.js';
import { generateSecureSecret } from './crypto-utils.js';
import { createNamespacedDebug } from './logger.js';
import { ConfigError, handleError } from './errors.js';
import { DEFAULTS } from './constants.js';
import { loadEnvironmentConfig } from './envConfig.js';
import type { WebSSH2Config } from './types/config.js';
import type { Config } from './configSchema.js';

const debug = createNamespacedDebug('config');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const defaultConfig: ExtendedWebSSH2Config = {
  listen: {
    ip: '0.0.0.0',
    port: DEFAULTS.LISTEN_PORT,
  },
  http: {
    origins: ['*:*'],
  },
  user: {
    name: null,
    password: null,
    privateKey: null,
    passphrase: null,
  },
  ssh: {
    host: null,
    port: DEFAULTS.SSH_PORT,
    term: DEFAULTS.SSH_TERM,
    readyTimeout: 20000,
    keepaliveInterval: 120000,
    keepaliveCountMax: 10,
    alwaysSendKeyboardInteractivePrompts: false,
    disableInteractiveAuth: false,
    algorithms: {
      // Prefer modern, faster, and safer algorithms first to speed negotiation
      cipher: [
        'chacha20-poly1305@openssh.com',
        'aes128-gcm',
        'aes128-gcm@openssh.com',
        'aes256-gcm',
        'aes256-gcm@openssh.com',
        'aes128-ctr',
        'aes192-ctr',
        'aes256-ctr',
        'aes256-cbc',
      ],
      compress: ['none', 'zlib@openssh.com', 'zlib'],
      hmac: [
        'hmac-sha2-256-etm@openssh.com',
        'hmac-sha2-512-etm@openssh.com',
        'hmac-sha1-etm@openssh.com',
        'hmac-sha2-256',
        'hmac-sha2-512',
        'hmac-sha1',
      ],
      kex: [
        'curve25519-sha256',
        'curve25519-sha256@libssh.org',
        'ecdh-sha2-nistp256',
        'ecdh-sha2-nistp384',
        'ecdh-sha2-nistp521',
        'diffie-hellman-group14-sha256',
        'diffie-hellman-group-exchange-sha256',
        'diffie-hellman-group14-sha1',
      ],
      serverHostKey: [
        'ssh-ed25519',
        'rsa-sha2-512',
        'rsa-sha2-256',
        'ecdsa-sha2-nistp256',
        'ecdsa-sha2-nistp384',
        'ecdsa-sha2-nistp521',
        'ssh-rsa',
      ],
    },
  },
  header: {
    text: null,
    background: 'green',
  },
  options: {
    challengeButton: true,
    autoLog: false,
    allowReauth: true,
    allowReconnect: true,
    allowReplay: true,
  },
  session: {
    secret: process.env['WEBSSH_SESSION_SECRET'] || generateSecureSecret(),
    name: 'webssh2.sid',
  },
  sso: {
    enabled: false,
    csrfProtection: false,
    trustedProxies: [],
    headerMapping: {
      username: 'x-apm-username',
      password: 'x-apm-password',
      session: 'x-apm-session',
    },
  },
};

function getConfigPath(): string {
  return path.join(__dirname, '..', 'config.json');
}

/**
 * Asynchronously loads configuration with priority: ENV vars > config.json > defaults
 * @returns Configuration object
 */
async function loadConfigAsync(): Promise<ExtendedWebSSH2Config> {
  const configPath = getConfigPath();
  let config = JSON.parse(JSON.stringify(defaultConfig)) as ExtendedWebSSH2Config; // Start with defaults

  try {
    // Check if config file exists using async fs.access
    await fs.access(configPath);

    // Use native Node.js JSON parsing to load config.json
    const data = await fs.readFile(configPath, 'utf8');
    const providedConfig = JSON.parse(data) as Record<string, unknown>;

    // Merge config.json over defaults
    config = deepMerge(config as unknown as Record<string, unknown>, providedConfig) as unknown as ExtendedWebSSH2Config;
    debug('Loaded and merged config.json');
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      debug('Missing config.json for webssh. Using default config');
    } else {
      debug('Error loading config.json: %s', error.message);
      const configError = new ConfigError(`Problem loading config.json for webssh: ${error.message}`);
      handleError(configError);
      // Continue with defaults on config file error
    }
  }

  // Load environment variables and merge with highest priority
  const envConfig = loadEnvironmentConfig();
  if (Object.keys(envConfig).length > 0) {
    config = deepMerge(config as unknown as Record<string, unknown>, envConfig) as unknown as ExtendedWebSSH2Config;
    debug('Merged environment variables into configuration');
    // Debug header configuration after env merge
    if (config.header) {
      debug('Header config after env merge: %O', config.header);
    }
  }

  try {
    const validatedConfig = validateConfig(config) as Config;
    debug('Configuration loaded and validated successfully');
    return { ...config, ...validatedConfig } as ExtendedWebSSH2Config;
  } catch (validationErr) {
    debug('Configuration validation failed: %s', (validationErr as Error).message);
    // Return unvalidated config for development/debugging
    return config;
  }
}

// For backward compatibility, we need to maintain a singleton config object
// This will be initialized when the module is first imported
let configInstance: ExtendedWebSSH2Config | null = null;
let configLoadPromise: Promise<ExtendedWebSSH2Config> | null = null;

/**
 * Gets the initialized configuration instance
 * @returns Configuration object
 */
export function getConfig(): Promise<ExtendedWebSSH2Config> {
  if (configInstance) {
    return Promise.resolve(configInstance);
  }

  if (!configLoadPromise) {
    configLoadPromise = loadConfigAsync().then((config) => {
      configInstance = config;
      // Add getCorsConfig to the config object
      configInstance.getCorsConfig = getCorsConfig;
      return configInstance;
    });
  }

  return configLoadPromise;
}

/**
 * Gets CORS configuration based on current config
 * @returns CORS configuration object
 */
function getCorsConfig(): CorsConfig {
  const currentConfig = configInstance;
  if (!currentConfig) {
    throw new ConfigError('Configuration not loaded. Call getConfig() first.');
  }
  return {
    origin: currentConfig.http.origins,
    methods: ['GET', 'POST'],
    credentials: true,
  };
}

/**
 * Resets the configuration instance for testing purposes
 * @internal
 */
function resetConfigForTesting(): void {
  configInstance = null;
  configLoadPromise = null;
  debug('Config instance reset for testing');
}

// Export only the async functions for the new implementation
export { loadConfigAsync, getConfigPath, getCorsConfig, resetConfigForTesting };
export type { ExtendedWebSSH2Config, CorsConfig };