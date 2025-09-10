// server
// app/envConfig.ts

import { createNamespacedDebug } from './logger.js';

const debug = createNamespacedDebug('envConfig');

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
 * SSH Algorithm Presets
 * Provides common algorithm configurations for different security levels
 */
const ALGORITHM_PRESETS: Record<string, AlgorithmConfig> = {
  modern: {
    cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com', 'aes256-ctr', 'aes128-ctr'],
    kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'],
    hmac: ['hmac-sha2-256', 'hmac-sha2-512'],
    compress: ['none', 'zlib@openssh.com'],
    serverHostKey: ['ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-rsa'],
  },
  legacy: {
    cipher: ['aes256-cbc', 'aes192-cbc', 'aes128-cbc', '3des-cbc'],
    kex: ['diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1'],
    hmac: ['hmac-sha1', 'hmac-md5'],
    compress: ['none', 'zlib'],
    serverHostKey: ['ssh-rsa', 'ssh-dss'],
  },
  strict: {
    cipher: ['aes256-gcm@openssh.com'],
    kex: ['ecdh-sha2-nistp256'],
    hmac: ['hmac-sha2-256'],
    compress: ['none'],
    serverHostKey: ['ecdsa-sha2-nistp256'],
  },
};

/**
 * Supported value types for environment variable parsing
 */
type ValueType = 'string' | 'number' | 'boolean' | 'array' | 'preset';

/**
 * Environment variable mapping configuration
 */
interface EnvMapping {
  path: string;
  type: ValueType;
}

/**
 * Parses a string value to the appropriate type
 * @param value - The string value to parse
 * @param type - The expected type
 * @returns The parsed value
 */
function parseValue(value: string | undefined, type: ValueType): unknown {
  if (value === undefined || value === null) {
    return null;
  }

  if (value === 'null') {
    return null;
  }

  // Handle empty string differently for arrays vs other types
  if (value === '') {
    return type === 'array' ? [] : null;
  }

  switch (type) {
    case 'boolean':
      return value === 'true' || value === '1';
    case 'number':
      return parseInt(value, 10);
    case 'array':
      return parseArrayValue(value);
    default:
      return value;
  }
}

/**
 * Parses an array value from environment variable
 * Supports comma-separated values or JSON array format
 * @param value - The string value to parse as array
 * @returns The parsed array
 */
function parseArrayValue(value: string): string[] {
  if (!value) {
    return [];
  }

  // Try JSON parsing first (for complex values)
  if (value.trim().startsWith('[') && value.trim().endsWith(']')) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      debug('Failed to parse JSON array, falling back to comma-separated: %s', (err as Error).message);
    }
  }

  // Fall back to comma-separated values
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Environment variable mapping configuration
 * Maps env var names to config paths and types
 * Note: Order matters for variables that map to the same path
 */
const ENV_VAR_MAPPING: Record<string, EnvMapping> = {
  // Legacy PORT support (maps to listen.port) - processed first
  PORT: { path: 'listen.port', type: 'number' },

  // Listen Configuration
  WEBSSH2_LISTEN_IP: { path: 'listen.ip', type: 'string' },
  WEBSSH2_LISTEN_PORT: { path: 'listen.port', type: 'number' }, // Overrides PORT

  // HTTP Configuration
  WEBSSH2_HTTP_ORIGINS: { path: 'http.origins', type: 'array' },

  // User Defaults
  WEBSSH2_USER_NAME: { path: 'user.name', type: 'string' },
  WEBSSH2_USER_PASSWORD: { path: 'user.password', type: 'string' },
  WEBSSH2_USER_PRIVATE_KEY: { path: 'user.privateKey', type: 'string' },
  WEBSSH2_USER_PASSPHRASE: { path: 'user.passphrase', type: 'string' },

  // SSH Configuration
  WEBSSH2_SSH_HOST: { path: 'ssh.host', type: 'string' },
  WEBSSH2_SSH_PORT: { path: 'ssh.port', type: 'number' },
  WEBSSH2_SSH_LOCAL_ADDRESS: { path: 'ssh.localAddress', type: 'string' },
  WEBSSH2_SSH_LOCAL_PORT: { path: 'ssh.localPort', type: 'number' },
  WEBSSH2_SSH_TERM: { path: 'ssh.term', type: 'string' },
  WEBSSH2_SSH_READY_TIMEOUT: { path: 'ssh.readyTimeout', type: 'number' },
  WEBSSH2_SSH_KEEPALIVE_INTERVAL: { path: 'ssh.keepaliveInterval', type: 'number' },
  WEBSSH2_SSH_KEEPALIVE_COUNT_MAX: { path: 'ssh.keepaliveCountMax', type: 'number' },
  WEBSSH2_SSH_ALLOWED_SUBNETS: { path: 'ssh.allowedSubnets', type: 'array' },
  WEBSSH2_SSH_ALWAYS_SEND_KEYBOARD_INTERACTIVE: {
    path: 'ssh.alwaysSendKeyboardInteractivePrompts',
    type: 'boolean',
  },
  WEBSSH2_SSH_DISABLE_INTERACTIVE_AUTH: { path: 'ssh.disableInteractiveAuth', type: 'boolean' },

  // SSH Algorithms
  WEBSSH2_SSH_ALGORITHMS_CIPHER: { path: 'ssh.algorithms.cipher', type: 'array' },
  WEBSSH2_SSH_ALGORITHMS_KEX: { path: 'ssh.algorithms.kex', type: 'array' },
  WEBSSH2_SSH_ALGORITHMS_HMAC: { path: 'ssh.algorithms.hmac', type: 'array' },
  WEBSSH2_SSH_ALGORITHMS_COMPRESS: { path: 'ssh.algorithms.compress', type: 'array' },
  WEBSSH2_SSH_ALGORITHMS_SERVER_HOST_KEY: { path: 'ssh.algorithms.serverHostKey', type: 'array' },

  // SSH Algorithm Preset
  WEBSSH2_SSH_ALGORITHMS_PRESET: { path: 'ssh.algorithms', type: 'preset' },

  // Header Configuration
  WEBSSH2_HEADER_TEXT: { path: 'header.text', type: 'string' },
  WEBSSH2_HEADER_BACKGROUND: { path: 'header.background', type: 'string' },

  // Options
  WEBSSH2_OPTIONS_CHALLENGE_BUTTON: { path: 'options.challengeButton', type: 'boolean' },
  WEBSSH2_OPTIONS_AUTO_LOG: { path: 'options.autoLog', type: 'boolean' },
  WEBSSH2_OPTIONS_ALLOW_REAUTH: { path: 'options.allowReauth', type: 'boolean' },
  WEBSSH2_OPTIONS_ALLOW_RECONNECT: { path: 'options.allowReconnect', type: 'boolean' },
  WEBSSH2_OPTIONS_ALLOW_REPLAY: { path: 'options.allowReplay', type: 'boolean' },

  // Session
  WEBSSH2_SESSION_SECRET: { path: 'session.secret', type: 'string' },
  WEBSSH2_SESSION_NAME: { path: 'session.name', type: 'string' },

  // SSO Configuration
  WEBSSH2_SSO_ENABLED: { path: 'sso.enabled', type: 'boolean' },
  WEBSSH2_SSO_CSRF_PROTECTION: { path: 'sso.csrfProtection', type: 'boolean' },
  WEBSSH2_SSO_TRUSTED_PROXIES: { path: 'sso.trustedProxies', type: 'array' },
  WEBSSH2_SSO_HEADER_USERNAME: { path: 'sso.headerMapping.username', type: 'string' },
  WEBSSH2_SSO_HEADER_PASSWORD: { path: 'sso.headerMapping.password', type: 'string' },
  WEBSSH2_SSO_HEADER_SESSION: { path: 'sso.headerMapping.session', type: 'string' },
};

/**
 * Sets a nested property in an object using dot notation
 * @param obj - The object to modify
 * @param path - The dot-notation path
 * @param value - The value to set
 */
function setNestedProperty(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (key && (!current[key] || typeof current[key] !== 'object')) {
      current[key] = {};
    }
    if (key) {
      current = current[key] as Record<string, unknown>;
    }
  }

  const lastKey = keys[keys.length - 1];
  if (lastKey) {
    current[lastKey] = value;
  }
}

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
export function loadEnvironmentConfig(): Record<string, unknown> {
  debug('Loading configuration from environment variables');
  const config: Record<string, unknown> = {};
  let envVarsFound = 0;

  Object.entries(ENV_VAR_MAPPING).forEach(([envVar, mapping]) => {
    const envValue = process.env[envVar];

    if (envValue !== undefined) {
      envVarsFound += 1;
      debug(
        'Found env var: %s = %s',
        envVar,
        envValue.substring(0, 20) + (envValue.length > 20 ? '...' : '')
      );

      if (mapping.type === 'preset') {
        // Handle algorithm presets
        const preset = ALGORITHM_PRESETS[envValue.toLowerCase()];
        if (preset) {
          debug('Using SSH algorithm preset: %s', envValue);
          setNestedProperty(config, mapping.path, preset);
        } else {
          debug('Unknown SSH algorithm preset: %s', envValue);
        }
      } else {
        const parsedValue = parseValue(envValue, mapping.type);
        setNestedProperty(config, mapping.path, parsedValue);
        // Debug header text specifically
        if (mapping.path === 'header.text') {
          debug('WEBSSH2_HEADER_TEXT processed: %s -> %s', envValue, parsedValue);
        }
      }
    }
  });

  debug('Loaded %d environment variables into configuration', envVarsFound);
  return config;
}

/**
 * Lists all available environment variables with their descriptions
 * @returns Map of environment variable names to descriptions
 */
export function getEnvironmentVariableMap(): Record<string, EnvVarInfo> {
  const envMap: Record<string, EnvVarInfo> = {};

  Object.entries(ENV_VAR_MAPPING).forEach(([envVar, mapping]) => {
    envMap[envVar] = {
      path: mapping.path,
      type: mapping.type,
      description: getEnvVarDescription(envVar, mapping),
    };
  });

  return envMap;
}

/**
 * Gets a human-readable description for an environment variable
 * @param envVar - The environment variable name
 * @param mapping - The mapping configuration
 * @returns Description of the environment variable
 */
function getEnvVarDescription(envVar: string, mapping: EnvMapping): string {
  const descriptions: Record<string, string> = {
    WEBSSH2_LISTEN_IP: 'IP address to bind the server to',
    WEBSSH2_LISTEN_PORT: 'Port number to bind the server to',
    WEBSSH2_HTTP_ORIGINS: 'Comma-separated list of allowed origins for CORS',
    WEBSSH2_USER_NAME: 'Default username for SSH connections',
    WEBSSH2_USER_PASSWORD: 'Default password for SSH connections',
    WEBSSH2_USER_PRIVATE_KEY: 'Default private key for SSH connections (base64 encoded)',
    WEBSSH2_USER_PASSPHRASE: 'Passphrase for encrypted private keys',
    WEBSSH2_SSH_HOST: 'Default SSH host to connect to',
    WEBSSH2_SSH_PORT: 'Default SSH port number',
    WEBSSH2_SSH_TERM: 'Terminal type for SSH connections',
    WEBSSH2_SSH_ALGORITHMS_PRESET: 'SSH algorithm preset (modern, legacy, strict)',
    WEBSSH2_HEADER_TEXT: 'Header text to display in the web interface',
    WEBSSH2_HEADER_BACKGROUND: 'Background color for the header',
    WEBSSH2_SESSION_SECRET: 'Secret key for session encryption',
    PORT: 'Legacy environment variable for server port (use WEBSSH2_LISTEN_PORT)',
    WEBSSH2_SSO_ENABLED: 'Enable/disable SSO functionality',
    WEBSSH2_SSO_CSRF_PROTECTION: 'Enable CSRF token validation for POST requests',
    WEBSSH2_SSO_TRUSTED_PROXIES:
      'Comma-separated list of trusted proxy IP addresses (bypasses CSRF)',
    WEBSSH2_SSO_HEADER_USERNAME: 'Header name for username mapping (e.g., x-apm-username)',
    WEBSSH2_SSO_HEADER_PASSWORD: 'Header name for password mapping (e.g., x-apm-password)',
    WEBSSH2_SSO_HEADER_SESSION: 'Header name for session mapping (e.g., x-apm-session)',
  };

  return descriptions[envVar] || `Configuration for ${mapping.path} (${mapping.type})`;
}

/**
 * Gets available algorithm presets
 * @returns Available algorithm presets
 */
export function getAlgorithmPresets(): Record<string, AlgorithmConfig> {
  return ALGORITHM_PRESETS;
}