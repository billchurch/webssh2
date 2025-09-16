// server
// app/envConfig.ts

import { createNamespacedDebug } from './logger.js'
import {
  ALGORITHM_PRESETS,
  ENV_VAR_MAPPING,
  mapEnvironmentVariables,
  type Algorithms,
  type EnvValueType,
  type EnvVarMap,
} from './config/index.js'
import { createSafeKey, safeGet, safeSet } from './utils/safe-property-access.js'

const debug = createNamespacedDebug('envConfig')

// Re-export types for backward compatibility
export type { EnvValueType, EnvVarMap }


export function loadEnvironmentConfig(): Record<string, unknown> {
  debug('Loading configuration from environment variables')
  const config = mapEnvironmentVariables(process.env)
  const envVarsFound = Object.keys(ENV_VAR_MAPPING).filter(
    // Key comes from static mapping, safe to use
    (key) => safeGet(process.env, createSafeKey(key)) !== undefined
  ).length
  debug('Loaded %d environment variables into configuration', envVarsFound)
  return config
}

// prettier-ignore
export function getEnvironmentVariableMap(): Record<
  string,
  { path: string; type: EnvValueType; description: string }
> {
  // prettier-ignore
  const envMap: Record<
    string,
    { path: string; type: EnvValueType; description: string }
  > = {}
  for (const [envVar, mapping] of Object.entries(ENV_VAR_MAPPING)) {
    // envVar comes from static mapping list, safe to use
    safeSet(envMap, createSafeKey(envVar), {
      path: mapping.path,
      type: mapping.type,
      description: getEnvVarDescription(envVar, mapping),
    })
  }
  return envMap
}

function getEnvVarDescription(envVar: string, mapping: EnvVarMap): string {
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
  }
  // envVar sourced from static mapping keys above, safe to use
  const description = safeGet(descriptions, createSafeKey(envVar))
  return typeof description === 'string' ? description : `Configuration for ${mapping.path} (${mapping.type})`
}

export function getAlgorithmPresets(): Record<string, Algorithms> {
  return ALGORITHM_PRESETS
}
