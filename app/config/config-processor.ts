// app/config/config-processor.ts
// Pure functions for config processing

import type { Config, HostKeyVerificationConfig } from '../types/config.js'
import type { Result } from '../types/result.js'
import { ok, err, deepMerge, validateConfigPure } from '../utils/index.js'
import { createCompleteDefaultConfig } from './default-config.js'

/**
 * Create default configuration
 * Pure function - no side effects
 *
 * @param sessionSecret - Optional session secret
 * @returns Default configuration object
 */
export function createDefaultConfig(sessionSecret?: string): Config {
  return createCompleteDefaultConfig(sessionSecret)
}

/**
 * Merge configurations in order of precedence
 * Pure function - returns new config without mutations
 * 
 * @param defaultConfig - Default configuration
 * @param fileConfig - Configuration from file (optional)
 * @param envConfig - Configuration from environment (optional)
 * @returns Merged configuration
 */
export function mergeConfigs(
  defaultConfig: Config,
  fileConfig?: Partial<Config>,
  envConfig?: Partial<Config>
): Config {
  let merged = defaultConfig
  
  if (fileConfig != null) {
    merged = deepMerge(merged, fileConfig)
  }
  
  if (envConfig != null) {
    merged = deepMerge(merged, envConfig)
  }
  
  return merged
}

/**
 * Process and validate configuration
 * Pure function - returns Result type
 * 
 * @param defaultConfig - Default configuration
 * @param fileConfig - Configuration from file (optional)
 * @param envConfig - Configuration from environment (optional)
 * @returns Result with validated config or error
 */
export function processConfig(
  defaultConfig: Config,
  fileConfig?: Partial<Config>,
  envConfig?: Partial<Config>
): Result<Config, { message: string; originalConfig: Config }> {
  const merged = mergeConfigs(defaultConfig, fileConfig, envConfig)
  const validationResult = validateConfigPure(merged)

  if (validationResult.ok) {
    return ok(validationResult.value)
  }

  // Handle both old and new error formats
  const errorMessage = Array.isArray(validationResult.error)
    ? validationResult.error.map(e => `${e.path}: ${e.message}`).join('; ')
    : (validationResult.error as { message: string }).message

  return err({
    message: errorMessage,
    originalConfig: merged
  })
}

/**
 * Parse JSON configuration safely
 * Pure function - returns Result type
 * 
 * @param jsonString - JSON string to parse
 * @returns Result with parsed config or error
 */
export function parseConfigJson(jsonString: string): Result<Partial<Config>, Error> {
  try {
    const parsed = JSON.parse(jsonString) as Partial<Config>
    return ok(parsed)
  } catch (error) {
    if (error instanceof Error) {
      return err(error)
    }
    return err(new Error(String(error)))
  }
}

/**
 * Create CORS configuration from config
 * Pure function - no side effects
 *
 * @param config - Application configuration
 * @returns CORS configuration object
 */
export function createCorsConfig(config: Config): {
  origin: string[]
  methods: string[]
  credentials: boolean
} {
  return {
    origin: config.http.origins,
    methods: ['GET', 'POST'],
    credentials: true
  }
}

/**
 * Options indicating which store flags were explicitly set by file/env config
 * (as opposed to being inherited from defaults). When explicit, the flag
 * overrides the mode-derived default.
 */
export interface ResolveHostKeyModeOptions {
  serverStoreExplicit?: boolean
  clientStoreExplicit?: boolean
}

/**
 * Resolve host key verification mode into store-enabled flags.
 *
 * The mode shorthand sets sensible defaults:
 *   - "server"  → serverStore=true, clientStore=false
 *   - "client"  → serverStore=false, clientStore=true
 *   - "hybrid"  → both true
 *
 * Explicit store flags from file/env config override the mode defaults.
 * Pure function - returns a new config without mutating the input.
 *
 * @param config - The host key verification config to resolve
 * @param options - Flags indicating which store settings were explicitly provided
 * @returns Resolved host key verification config
 */
export function resolveHostKeyMode(
  config: HostKeyVerificationConfig,
  options?: ResolveHostKeyModeOptions
): HostKeyVerificationConfig {
  const serverStoreExplicit = options?.serverStoreExplicit === true
  const clientStoreExplicit = options?.clientStoreExplicit === true

  // Derive defaults from mode
  let serverEnabled: boolean
  let clientEnabled: boolean
  switch (config.mode) {
    case 'server':
      serverEnabled = true
      clientEnabled = false
      break
    case 'client':
      serverEnabled = false
      clientEnabled = true
      break
    case 'hybrid':
      serverEnabled = true
      clientEnabled = true
      break
    default: {
      // Exhaustive check
      const _exhaustive: never = config.mode
      throw new Error(`Unknown host key verification mode: ${String(_exhaustive)}`)
    }
  }

  // Explicit flags override mode defaults
  if (serverStoreExplicit) {
    serverEnabled = config.serverStore.enabled
  }
  if (clientStoreExplicit) {
    clientEnabled = config.clientStore.enabled
  }

  return {
    enabled: config.enabled,
    mode: config.mode,
    unknownKeyAction: config.unknownKeyAction,
    serverStore: {
      enabled: serverEnabled,
      dbPath: config.serverStore.dbPath,
    },
    clientStore: {
      enabled: clientEnabled,
    },
  }
}