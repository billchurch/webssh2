// app/envConfig.ts
// Pure functions for loading configuration from environment variables

import { ENV_VAR_MAPPING } from './config/env-mapper.js'
import { parseEnvValue } from './config/env-parser.js'
import { getAlgorithmPreset } from './config/algorithm-presets.js'
import { safePathToKeys, safeSetNested } from './utils/safe-property-access.js'

export interface EnvironmentVariableMapping {
  path: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'preset'
  description: string
}

/**
 * Algorithm presets for SSH connections
 */
export interface AlgorithmPreset {
  cipher: string[]
  kex: string[]
  hmac: string[]
  compress: string[]
  serverHostKey: string[]
}

/**
 * Load configuration from environment variables
 * @pure
 */
export function loadEnvironmentConfig(): Record<string, unknown> {
  const config: Record<string, unknown> = {}

  // Special handling for PORT env variable
  if (process.env['PORT'] !== undefined && process.env['WEBSSH2_LISTEN_PORT'] === undefined) {
    const value = parseEnvValue(process.env['PORT'], 'number')
    if (value !== null) {
      const keys = safePathToKeys('listen.port')
      safeSetNested(config, keys, value)
    }
  }

  // Process all WEBSSH2_ environment variables
  for (const [envVar, mapping] of Object.entries(ENV_VAR_MAPPING)) {
    // Get value safely using Object.getOwnPropertyDescriptor
    const descriptor = Object.getOwnPropertyDescriptor(process.env, envVar)
    if (descriptor === undefined || descriptor.value === undefined) {
      continue
    }
    const envValue = String(descriptor.value)

    // Special handling for algorithm presets
    if (mapping.type === 'preset' && envVar === 'WEBSSH2_SSH_ALGORITHMS_PRESET') {
      const preset = getAlgorithmPreset(envValue)
      if (preset !== undefined) {
        const keys = safePathToKeys(mapping.path)
        safeSetNested(config, keys, preset)
      }
      continue
    }

    // Parse the value based on type
    const parsedValue = parseEnvValue(envValue, mapping.type)
    // parseEnvValue never returns undefined, always store the result
    const keys = safePathToKeys(mapping.path)
    safeSetNested(config, keys, parsedValue)
  }

  return config
}

/**
 * Get the complete environment variable mapping with descriptions
 * @pure
 */
export function getEnvironmentVariableMap(): Record<string, EnvironmentVariableMapping> {
  const map: Record<string, EnvironmentVariableMapping> = {}

  // Add PORT variable
  map['PORT'] = {
    path: 'listen.port',
    type: 'number',
    description: 'Port to listen on (overridden by WEBSSH2_LISTEN_PORT)'
  }

  // Add all WEBSSH2_ variables with descriptions
  for (const [envVar, mapping] of Object.entries(ENV_VAR_MAPPING)) {
    // Create a safe key to avoid object injection
    const safeKey = String(envVar)
    Object.defineProperty(map, safeKey, {
      value: {
      path: mapping.path,
      type: mapping.type,
        description: getEnvironmentVariableDescription(safeKey)
      },
      enumerable: true,
      configurable: true,
      writable: true
    })
  }

  return map
}

/**
 * Get all available algorithm presets
 * @pure
 */
export function getAlgorithmPresets(): Record<string, AlgorithmPreset> {
  return {
    modern: getAlgorithmPreset('modern') as AlgorithmPreset,
    legacy: getAlgorithmPreset('legacy') as AlgorithmPreset,
    strict: getAlgorithmPreset('strict') as AlgorithmPreset
  }
}

/**
 * Get description for environment variable
 * @pure
 */
function getEnvironmentVariableDescription(envVar: string): string {
  const descriptions: Record<string, string> = {
    WEBSSH2_LISTEN_IP: 'IP address to listen on',
    WEBSSH2_LISTEN_PORT: 'Port number to listen on',
    WEBSSH2_HTTP_ORIGINS: 'Allowed HTTP origins (comma-separated)',
    WEBSSH2_USER_NAME: 'Default SSH username',
    WEBSSH2_USER_PASSWORD: 'Default SSH password', //NOSONAR
    WEBSSH2_USER_PRIVATE_KEY: 'SSH private key (base64 encoded)',
    WEBSSH2_USER_PASSPHRASE: 'SSH private key passphrase', //NOSONAR
    WEBSSH2_SSH_HOST: 'Default SSH host',
    WEBSSH2_SSH_PORT: 'Default SSH port',
    WEBSSH2_SSH_LOCAL_ADDRESS: 'Local address for SSH connection',
    WEBSSH2_SSH_LOCAL_PORT: 'Local port for SSH connection',
    WEBSSH2_SSH_TERM: 'Terminal type for SSH',
    WEBSSH2_SSH_ENV_ALLOWLIST: 'Environment variables to pass through (comma-separated)',
    WEBSSH2_SSH_READY_TIMEOUT: 'SSH ready timeout in milliseconds',
    WEBSSH2_SSH_KEEPALIVE_INTERVAL: 'SSH keepalive interval in milliseconds',
    WEBSSH2_SSH_KEEPALIVE_COUNT_MAX: 'Maximum SSH keepalive count',
    WEBSSH2_SSH_ALLOWED_SUBNETS: 'Allowed subnets for SSH connections (comma-separated)',
    WEBSSH2_SSH_ALWAYS_SEND_KEYBOARD_INTERACTIVE: 'Always send keyboard interactive prompts',
    WEBSSH2_SSH_DISABLE_INTERACTIVE_AUTH: 'Disable interactive authentication',
    WEBSSH2_SSH_ALGORITHMS_CIPHER: 'SSH cipher algorithms (comma-separated)',
    WEBSSH2_SSH_ALGORITHMS_KEX: 'SSH key exchange algorithms (comma-separated)',
    WEBSSH2_SSH_ALGORITHMS_HMAC: 'SSH HMAC algorithms (comma-separated)',
    WEBSSH2_SSH_ALGORITHMS_COMPRESS: 'SSH compression algorithms (comma-separated)',
    WEBSSH2_SSH_ALGORITHMS_SERVER_HOST_KEY: 'SSH server host key algorithms (comma-separated)',
    WEBSSH2_SSH_ALGORITHMS_PRESET: 'SSH algorithm preset (modern, legacy, or strict)',
    WEBSSH2_HEADER_TEXT: 'Header text to display',
    WEBSSH2_HEADER_BACKGROUND: 'Header background color',
    WEBSSH2_OPTIONS_CHALLENGE_BUTTON: 'Show challenge button',
    WEBSSH2_OPTIONS_AUTO_LOG: 'Enable automatic logging',
    WEBSSH2_OPTIONS_ALLOW_REAUTH: 'Allow reauthentication',
    WEBSSH2_OPTIONS_ALLOW_RECONNECT: 'Allow reconnection',
    WEBSSH2_OPTIONS_ALLOW_REPLAY: 'Allow replay',
    WEBSSH2_SESSION_SECRET: 'Session secret for cookies',
    WEBSSH2_SESSION_NAME: 'Session cookie name',
    WEBSSH2_SSO_ENABLED: 'Enable SSO',
    WEBSSH2_SSO_CSRF_PROTECTION: 'Enable CSRF protection for SSO',
    WEBSSH2_SSO_TRUSTED_PROXIES: 'Trusted proxy addresses (comma-separated)'
  }

  // Get value safely using Object.getOwnPropertyDescriptor
  const descriptor = Object.getOwnPropertyDescriptor(descriptions, envVar)
  if (descriptor !== undefined && descriptor.value !== undefined) {
    return String(descriptor.value)
  }
  return 'Configuration option'
}