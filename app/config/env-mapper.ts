/**
 * Pure functions for mapping environment variables to configuration.
 * Complex theming env vars (WEBSSH2_THEMING_THEMES, WEBSSH2_THEMING_DEFAULT_THEME,
 * WEBSSH2_THEMING_HEADER_BACKGROUND, WEBSSH2_THEMING_ADDITIONAL_THEMES) are handled
 * in a post-processing pass after the generic ENV_VAR_MAPPING loop.
 * Structured WARN logging for dropped/invalid entries is added in Task 10.
 */

import { parseEnvValue, parseBase64JsonArrayEnv, type EnvValueType } from './env-parser.js'
import { getAlgorithmPreset } from './algorithm-presets.js'
import { createSafeKey, safeGet, safePathToKeys, safeSetNested } from '../utils/index.js'
import { ALGORITHM_ENV_VARS } from '../constants/algorithm-env-vars.js'
import { THEME_NAME_REGEX } from '../services/theming/theme-name.js'
import {
  loadAdditionalThemes,
  type ThemeValidationWarning
} from '../services/theming/theme-loader.js'

/**
 * Optional callbacks invoked while mapping theming env vars. Lets the caller
 * surface dropped/invalid entries via the application logger without coupling
 * env-mapper to a logger module.
 */
export interface EnvMapperHooks {
  readonly onThemingWarning?: (warning: ThemeValidationWarning) => void
}

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
  // Host key verification configuration
  WEBSSH2_SSH_HOSTKEY_ENABLED: {
    path: 'ssh.hostKeyVerification.enabled',
    type: 'boolean' as const,
  },
  WEBSSH2_SSH_HOSTKEY_MODE: {
    path: 'ssh.hostKeyVerification.mode',
    type: 'string' as const,
  },
  WEBSSH2_SSH_HOSTKEY_UNKNOWN_ACTION: {
    path: 'ssh.hostKeyVerification.unknownKeyAction',
    type: 'string' as const,
  },
  WEBSSH2_SSH_HOSTKEY_DB_PATH: {
    path: 'ssh.hostKeyVerification.serverStore.dbPath',
    type: 'string' as const,
  },
  WEBSSH2_SSH_HOSTKEY_SERVER_ENABLED: {
    path: 'ssh.hostKeyVerification.serverStore.enabled',
    type: 'boolean' as const,
  },
  WEBSSH2_SSH_HOSTKEY_CLIENT_ENABLED: {
    path: 'ssh.hostKeyVerification.clientStore.enabled',
    type: 'boolean' as const,
  },
  // SFTP configuration
  WEBSSH2_SSH_SFTP_BACKEND: { path: 'ssh.sftp.backend', type: 'string' },
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
  // Telnet configuration
  WEBSSH2_TELNET_ENABLED: { path: 'telnet.enabled', type: 'boolean' },
  WEBSSH2_TELNET_DEFAULT_PORT: { path: 'telnet.defaultPort', type: 'number' },
  WEBSSH2_TELNET_TIMEOUT: { path: 'telnet.timeout', type: 'number' },
  WEBSSH2_TELNET_TERM: { path: 'telnet.term', type: 'string' },
  WEBSSH2_TELNET_AUTH_LOGIN_PROMPT: { path: 'telnet.auth.loginPrompt', type: 'string' },
  WEBSSH2_TELNET_AUTH_PASSWORD_PROMPT: { path: 'telnet.auth.passwordPrompt', type: 'string' },
  WEBSSH2_TELNET_AUTH_FAILURE_PATTERN: { path: 'telnet.auth.failurePattern', type: 'string' },
  WEBSSH2_TELNET_AUTH_EXPECT_TIMEOUT: { path: 'telnet.auth.expectTimeout', type: 'number' },
  WEBSSH2_TELNET_ALLOWED_SUBNETS: { path: 'telnet.allowedSubnets', type: 'array' },
  // Terminal theming configuration
  WEBSSH2_THEMING_ENABLED: { path: 'options.theming.enabled', type: 'boolean' },
  WEBSSH2_THEMING_ALLOW_CUSTOM: { path: 'options.theming.allowCustom', type: 'boolean' },
  // Content Security Policy configuration
  WEBSSH2_CSP_MODE: { path: 'csp.mode', type: 'string' },
  WEBSSH2_CSP_REPORT_URI: { path: 'csp.reportUri', type: 'string' },
  WEBSSH2_CSP_CONNECT_SRC: { path: 'csp.connectSrc', type: 'array' },
  WEBSSH2_CSP_FRAME_ANCESTORS: { path: 'csp.frameAncestors', type: 'array' },
}

/** Built-in theme names used to block collisions when loading additional themes */
const BUILTIN_THEME_NAMES: readonly string[] = [
  'Default', 'Dracula', 'Nord', 'Solarized Dark',
  'One Dark', 'Monokai', 'Gruvbox Dark', 'Tokyo Night', 'Catppuccin Mocha',
]

/** Valid values for the headerBackground theming option */
const VALID_HEADER_BACKGROUND = new Set(['independent', 'followTerminal', 'locked'])

const ADDITIONAL_THEMES_ENV = 'WEBSSH2_THEMING_ADDITIONAL_THEMES'
const ADDITIONAL_THEMES_PATH = 'options.theming.additionalThemes'

/** A resolved assignment: the config path to write and the value to write there */
type ConfigEntry = readonly [path: string, value: unknown]

/** Theming assignments plus the warnings raised while resolving them */
interface ThemingResolution {
  readonly entries: readonly ConfigEntry[]
  readonly warnings: readonly ThemeValidationWarning[]
}

/**
 * Read an environment variable as a string, treating absent and non-string
 * values alike as unset.
 * @pure
 */
function readEnvString(
  env: Record<string, string | undefined>,
  name: string
): string | undefined {
  const value = safeGet(env, createSafeKey(name))
  return typeof value === 'string' ? value : undefined
}

/**
 * Resolve the algorithm preset into a base `ssh.algorithms` assignment.
 * Yields nothing when the preset is unset or unrecognized.
 * @pure
 */
function collectPresetEntries(env: Record<string, string | undefined>): readonly ConfigEntry[] {
  const presetVar = ALGORITHM_ENV_VARS.PRESET
  const presetName = readEnvString(env, presetVar)
  if (presetName === undefined) {
    return []
  }

  const preset = getAlgorithmPreset(presetName)
  if (preset === undefined) {
    return []
  }

  const presetMapping = safeGet(ENV_VAR_MAPPING, createSafeKey(presetVar)) as EnvVarMap | undefined
  if (presetMapping === undefined) {
    return []
  }

  // Clone the preset to avoid mutating the global ALGORITHM_PRESETS object
  const presetClone = {
    cipher: [...preset.cipher],
    kex: [...preset.kex],
    hmac: [...preset.hmac],
    compress: [...preset.compress],
    serverHostKey: [...preset.serverHostKey]
  }
  return [[presetMapping.path, presetClone]]
}

/**
 * Resolve every non-preset variable in ENV_VAR_MAPPING that is set in `env`.
 * Preset is skipped here because it is applied first, so these individual
 * assignments overwrite the preset values.
 * @pure
 */
function collectMappedEntries(env: Record<string, string | undefined>): readonly ConfigEntry[] {
  const entries: ConfigEntry[] = []
  for (const [envVar, mapping] of Object.entries(ENV_VAR_MAPPING)) {
    if (mapping.type === 'preset') {
      continue
    }

    // Access restricted to known keys from ENV_VAR_MAPPING
    const envValue = readEnvString(env, envVar)
    if (envValue !== undefined) {
      entries.push([mapping.path, parseEnvValue(envValue, mapping.type)])
    }
  }
  return entries
}

/**
 * Resolve the themes allowlist, dropping names that fail THEME_NAME_REGEX.
 * @pure
 */
function collectThemeNamesEntries(env: Record<string, string | undefined>): readonly ConfigEntry[] {
  const raw = readEnvString(env, 'WEBSSH2_THEMING_THEMES')
  if (raw === undefined) {
    return []
  }

  const valid = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => THEME_NAME_REGEX.test(s))
  return [['options.theming.themes', valid]]
}

/**
 * Resolve the default theme, falling back to 'Default' when malformed.
 * @pure
 */
function collectDefaultThemeEntries(env: Record<string, string | undefined>): readonly ConfigEntry[] {
  const raw = readEnvString(env, 'WEBSSH2_THEMING_DEFAULT_THEME')
  if (raw === undefined) {
    return []
  }

  const trimmed = raw.trim()
  const resolved = THEME_NAME_REGEX.test(trimmed) ? trimmed : 'Default'
  return [['options.theming.defaultTheme', resolved]]
}

/**
 * Resolve the header background mode, leaving it unset when not recognized.
 * @pure
 */
function collectHeaderBackgroundEntries(
  env: Record<string, string | undefined>
): readonly ConfigEntry[] {
  const raw = readEnvString(env, 'WEBSSH2_THEMING_HEADER_BACKGROUND')
  if (raw === undefined || !VALID_HEADER_BACKGROUND.has(raw)) {
    return []
  }

  return [['options.theming.headerBackground', raw]]
}

/**
 * Resolve the base64 JSON additional-themes payload. A payload that fails to
 * decode yields an empty theme list plus a single warning describing why.
 * @pure
 */
function resolveAdditionalThemes(env: Record<string, string | undefined>): ThemingResolution {
  const raw = readEnvString(env, ADDITIONAL_THEMES_ENV)
  if (raw === undefined) {
    return { entries: [], warnings: [] }
  }

  const parsed = parseBase64JsonArrayEnv(raw)
  if (parsed.ok) {
    const loaded = loadAdditionalThemes(parsed.value, {
      source: ADDITIONAL_THEMES_ENV,
      builtinNames: BUILTIN_THEME_NAMES,
    })
    return {
      entries: [[ADDITIONAL_THEMES_PATH, loaded.valid]],
      warnings: loaded.warnings
    }
  }

  return {
    entries: [[ADDITIONAL_THEMES_PATH, []]],
    warnings: [
      {
        source: ADDITIONAL_THEMES_ENV,
        path: '',
        reason: parsed.detail === undefined ? parsed.reason : `${parsed.reason}: ${parsed.detail}`
      }
    ]
  }
}

/**
 * Resolve the theming env vars that require bespoke validation beyond the
 * generic ENV_VAR_MAPPING parsing.
 * @pure
 */
function resolveThemingEnv(env: Record<string, string | undefined>): ThemingResolution {
  const additional = resolveAdditionalThemes(env)
  return {
    entries: [
      ...collectThemeNamesEntries(env),
      ...collectDefaultThemeEntries(env),
      ...collectHeaderBackgroundEntries(env),
      ...additional.entries
    ],
    warnings: additional.warnings
  }
}

/**
 * Map environment variables to configuration object
 * Individual algorithm settings take precedence over preset values
 * @param env - Environment variables object
 * @param hooks - Optional callbacks (e.g., to surface theming warnings)
 * @returns Configuration object with mapped values
 * @pure
 */
export function mapEnvironmentVariables(
  env: Record<string, string | undefined>,
  hooks?: EnvMapperHooks
): Record<string, unknown> {
  const theming = resolveThemingEnv(env)
  // Order matters: the preset supplies base algorithm values, and the
  // individual variables applied after it overwrite the ones they name.
  const entries = [
    ...collectPresetEntries(env),
    ...collectMappedEntries(env),
    ...theming.entries
  ]

  const config: Record<string, unknown> = {}
  for (const [path, value] of entries) {
    setNestedProperty(config, path, value)
  }

  for (const warning of theming.warnings) {
    hooks?.onThemingWarning?.(warning)
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
