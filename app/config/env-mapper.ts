// app/config/env-mapper.ts
// Pure functions for mapping environment variables to configuration

import { parseEnvValue, type EnvValueType } from './env-parser.js'
import { getAlgorithmPreset } from './algorithm-presets.js'
import { createSafeKey, safeGet, safePathToKeys, safeSetNested } from '../utils/index.js'
import { ALGORITHM_ENV_VARS } from '../constants/algorithm-env-vars.js'

export interface EnvVarMap { 
  path: string
  type: EnvValueType
}

/**
 * Static mapping of environment variables to configuration paths
 * @pure
 */
export const ENV_VAR_MAPPING: Record<string, EnvVarMap> = {
  PORT: { path: 'listen.port', type: 'number' },
  WEBSSH2_LISTEN_IP: { path: 'listen.ip', type: 'string' },
  WEBSSH2_LISTEN_PORT: { path: 'listen.port', type: 'number' },
  WEBSSH2_HTTP_ORIGINS: { path: 'http.origins', type: 'array' },
  WEBSSH2_USER_NAME: { path: 'user.name', type: 'string' },
  WEBSSH2_USER_PASSWORD: { path: 'user.password', type: 'string' },
  WEBSSH2_USER_PRIVATE_KEY: { path: 'user.privateKey', type: 'string' },
  WEBSSH2_USER_PASSPHRASE: { path: 'user.passphrase', type: 'string' },
  WEBSSH2_SSH_HOST: { path: 'ssh.host', type: 'string' },
  WEBSSH2_SSH_PORT: { path: 'ssh.port', type: 'number' },
  WEBSSH2_SSH_LOCAL_ADDRESS: { path: 'ssh.localAddress', type: 'string' },
  WEBSSH2_SSH_LOCAL_PORT: { path: 'ssh.localPort', type: 'number' },
  WEBSSH2_SSH_TERM: { path: 'ssh.term', type: 'string' },
  WEBSSH2_SSH_ENV_ALLOWLIST: { path: 'ssh.envAllowlist', type: 'array' },
  WEBSSH2_AUTH_ALLOWED: { path: 'ssh.allowedAuthMethods', type: 'array' },
  WEBSSH2_SSH_READY_TIMEOUT: { path: 'ssh.readyTimeout', type: 'number' },
  WEBSSH2_SSH_KEEPALIVE_INTERVAL: { path: 'ssh.keepaliveInterval', type: 'number' },
  WEBSSH2_SSH_KEEPALIVE_COUNT_MAX: { path: 'ssh.keepaliveCountMax', type: 'number' },
  WEBSSH2_SSH_ALLOWED_SUBNETS: { path: 'ssh.allowedSubnets', type: 'array' },
  WEBSSH2_SSH_ALWAYS_SEND_KEYBOARD_INTERACTIVE: {
    path: 'ssh.alwaysSendKeyboardInteractivePrompts',
    type: 'boolean',
  },
  WEBSSH2_SSH_DISABLE_INTERACTIVE_AUTH: { path: 'ssh.disableInteractiveAuth', type: 'boolean' },
  [ALGORITHM_ENV_VARS.CIPHER]: { path: 'ssh.algorithms.cipher', type: 'array' },
  [ALGORITHM_ENV_VARS.KEX]: { path: 'ssh.algorithms.kex', type: 'array' },
  [ALGORITHM_ENV_VARS.HMAC]: { path: 'ssh.algorithms.hmac', type: 'array' },
  [ALGORITHM_ENV_VARS.COMPRESS]: { path: 'ssh.algorithms.compress', type: 'array' },
  [ALGORITHM_ENV_VARS.SERVER_HOST_KEY]: { path: 'ssh.algorithms.serverHostKey', type: 'array' },
  [ALGORITHM_ENV_VARS.PRESET]: { path: 'ssh.algorithms', type: 'preset' },
  WEBSSH2_SSH_MAX_EXEC_OUTPUT_BYTES: { path: 'ssh.maxExecOutputBytes', type: 'number' },
  WEBSSH2_SSH_OUTPUT_RATE_LIMIT_BYTES_PER_SEC: { path: 'ssh.outputRateLimitBytesPerSec', type: 'number' },
  WEBSSH2_SSH_SOCKET_HIGH_WATER_MARK: { path: 'ssh.socketHighWaterMark', type: 'number' },
  WEBSSH2_HEADER_TEXT: { path: 'header.text', type: 'string' },
  WEBSSH2_HEADER_BACKGROUND: { path: 'header.background', type: 'string' },
  WEBSSH2_OPTIONS_CHALLENGE_BUTTON: { path: 'options.challengeButton', type: 'boolean' },
  WEBSSH2_OPTIONS_AUTO_LOG: { path: 'options.autoLog', type: 'boolean' },
  WEBSSH2_OPTIONS_ALLOW_REAUTH: { path: 'options.allowReauth', type: 'boolean' },
  WEBSSH2_OPTIONS_ALLOW_RECONNECT: { path: 'options.allowReconnect', type: 'boolean' },
  WEBSSH2_OPTIONS_ALLOW_REPLAY: { path: 'options.allowReplay', type: 'boolean' },
  WEBSSH2_OPTIONS_REPLAY_CRLF: { path: 'options.replayCRLF', type: 'boolean' },
  WEBSSH2_SESSION_SECRET: { path: 'session.secret', type: 'string' },
  WEBSSH2_SESSION_NAME: { path: 'session.name', type: 'string' },
  WEBSSH2_SSO_ENABLED: { path: 'sso.enabled', type: 'boolean' },
  WEBSSH2_SSO_CSRF_PROTECTION: { path: 'sso.csrfProtection', type: 'boolean' },
  WEBSSH2_SSO_TRUSTED_PROXIES: { path: 'sso.trustedProxies', type: 'array' },
  WEBSSH2_SSO_HEADER_USERNAME: { path: 'sso.headerMapping.username', type: 'string' },
  WEBSSH2_SSO_HEADER_PASSWORD: { path: 'sso.headerMapping.password', type: 'string' },
  WEBSSH2_SSO_HEADER_SESSION: { path: 'sso.headerMapping.session', type: 'string' },
  WEBSSH2_LOGGING_LEVEL: { path: 'logging.minimumLevel', type: 'string' },
  WEBSSH2_LOGGING_STDOUT_ENABLED: { path: 'logging.stdout.enabled', type: 'boolean' },
  WEBSSH2_LOGGING_STDOUT_MIN_LEVEL: {
    path: 'logging.stdout.minimumLevel',
    type: 'string'
  },
  WEBSSH2_LOGGING_SAMPLING_DEFAULT_RATE: {
    path: 'logging.controls.sampling.defaultSampleRate',
    type: 'number'
  },
  WEBSSH2_LOGGING_SAMPLING_RULES: {
    path: 'logging.controls.sampling.rules',
    type: 'json'
  },
  WEBSSH2_LOGGING_RATE_LIMIT_RULES: {
    path: 'logging.controls.rateLimit.rules',
    type: 'json'
  },
  WEBSSH2_LOGGING_SYSLOG_ENABLED: { path: 'logging.syslog.enabled', type: 'boolean' },
  WEBSSH2_LOGGING_SYSLOG_HOST: { path: 'logging.syslog.host', type: 'string' },
  WEBSSH2_LOGGING_SYSLOG_PORT: { path: 'logging.syslog.port', type: 'number' },
  WEBSSH2_LOGGING_SYSLOG_APP_NAME: { path: 'logging.syslog.appName', type: 'string' },
  WEBSSH2_LOGGING_SYSLOG_ENTERPRISE_ID: {
    path: 'logging.syslog.enterpriseId',
    type: 'number'
  },
  WEBSSH2_LOGGING_SYSLOG_BUFFER_SIZE: {
    path: 'logging.syslog.bufferSize',
    type: 'number'
  },
  WEBSSH2_LOGGING_SYSLOG_FLUSH_INTERVAL_MS: {
    path: 'logging.syslog.flushIntervalMs',
    type: 'number'
  },
  WEBSSH2_LOGGING_SYSLOG_INCLUDE_JSON: {
    path: 'logging.syslog.includeJson',
    type: 'boolean'
  },
  WEBSSH2_LOGGING_SYSLOG_TLS_ENABLED: {
    path: 'logging.syslog.tls.enabled',
    type: 'boolean'
  },
  WEBSSH2_LOGGING_SYSLOG_TLS_CA_FILE: {
    path: 'logging.syslog.tls.caFile',
    type: 'string'
  },
  WEBSSH2_LOGGING_SYSLOG_TLS_CERT_FILE: {
    path: 'logging.syslog.tls.certFile',
    type: 'string'
  },
  WEBSSH2_LOGGING_SYSLOG_TLS_KEY_FILE: {
    path: 'logging.syslog.tls.keyFile',
    type: 'string'
  },
  WEBSSH2_LOGGING_SYSLOG_TLS_REJECT_UNAUTHORIZED: {
    path: 'logging.syslog.tls.rejectUnauthorized',
    type: 'boolean'
  },
  // SFTP configuration
  WEBSSH2_SSH_SFTP_ENABLED: { path: 'ssh.sftp.enabled', type: 'boolean' },
  WEBSSH2_SSH_SFTP_MAX_FILE_SIZE: { path: 'ssh.sftp.maxFileSize', type: 'number' },
  WEBSSH2_SSH_SFTP_TRANSFER_RATE_LIMIT_BYTES_PER_SEC: {
    path: 'ssh.sftp.transferRateLimitBytesPerSec',
    type: 'number'
  },
  WEBSSH2_SSH_SFTP_CHUNK_SIZE: { path: 'ssh.sftp.chunkSize', type: 'number' },
  WEBSSH2_SSH_SFTP_MAX_CONCURRENT_TRANSFERS: {
    path: 'ssh.sftp.maxConcurrentTransfers',
    type: 'number'
  },
  WEBSSH2_SSH_SFTP_ALLOWED_PATHS: { path: 'ssh.sftp.allowedPaths', type: 'array' },
  WEBSSH2_SSH_SFTP_BLOCKED_EXTENSIONS: { path: 'ssh.sftp.blockedExtensions', type: 'array' },
  WEBSSH2_SSH_SFTP_TIMEOUT: { path: 'ssh.sftp.timeout', type: 'number' },
}

/**
 * Map environment variables to configuration object
 * Individual algorithm settings take precedence over preset values
 * @param env - Environment variables object
 * @returns Configuration object with mapped values
 * @pure
 */
export function mapEnvironmentVariables(env: Record<string, string | undefined>): Record<string, unknown> {
  const config: Record<string, unknown> = {}

  // First pass: process preset if it exists (provides base algorithm values)
  const presetVar = ALGORITHM_ENV_VARS.PRESET
  const presetValue = safeGet(env, createSafeKey(presetVar))
  if (presetValue !== undefined && typeof presetValue === 'string') {
    const preset = getAlgorithmPreset(presetValue)
    if (preset != null) {
      const presetMapping = safeGet(ENV_VAR_MAPPING, createSafeKey(presetVar)) as EnvVarMap | undefined
      if (presetMapping !== undefined) {
        // Clone the preset to avoid mutating the global ALGORITHM_PRESETS object
        const presetClone = {
          cipher: [...preset.cipher],
          kex: [...preset.kex],
          hmac: [...preset.hmac],
          compress: [...preset.compress],
          serverHostKey: [...preset.serverHostKey]
        }
        setNestedProperty(config, presetMapping.path, presetClone)
      }
    }
  }

  // Second pass: process all non-preset variables (individual overrides take precedence)
  for (const [envVar, mapping] of Object.entries(ENV_VAR_MAPPING)) {
    // Skip preset since it was already processed
    if (mapping.type === 'preset') {
      continue
    }

    // Access restricted to known keys from ENV_VAR_MAPPING
    const envValue = safeGet(env, createSafeKey(envVar))
    if (envValue !== undefined && typeof envValue === 'string') {
      const parsedValue = parseEnvValue(envValue, mapping.type)
      setNestedProperty(config, mapping.path, parsedValue)
    }
  }

  return config
}

/**
 * Set a nested property in an object using dot notation path
 * @param obj - Object to modify
 * @param path - Dot-separated path to property
 * @param value - Value to set
 * @pure - Note: This function mutates obj for efficiency, but could be made pure by returning a new object
 */
export function setNestedProperty(obj: Record<string, unknown>, path: string, value: unknown): void {
  // Convert path to SafeKeys since paths come from static ENV_VAR_MAPPING
  const safeKeys = safePathToKeys(path)
  safeSetNested(obj, safeKeys, value)
}

/**
 * Create immutable nested property setter
 * @param obj - Original object
 * @param path - Dot-separated path to property
 * @param value - Value to set
 * @returns New object with property set
 * @pure
 */
export function setNestedPropertyImmutable(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split('.')
  
  if (keys.length === 0) {
    return obj
  }
  
  const [head, ...tail] = keys
  
  if (head === undefined || head === '') {
    return obj
  }
  
  if (tail.length === 0) {
    return { ...obj, [head]: value }
  }
  
  // Head is validated above to be non-empty string, safe to use
  const safeHead = createSafeKey(head)
  const current = safeGet(obj, safeHead)
  const nested: Record<string, unknown> = 
    current != null && typeof current === 'object' && !Array.isArray(current)
      ? current as Record<string, unknown>
      : {}
  
  return {
    ...obj,
    [head]: setNestedPropertyImmutable(nested, tail.join('.'), value),
  }
}
