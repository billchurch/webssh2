// app/config/config-processor.ts
// Pure functions for config processing

import type { Config } from '../types/config.js'
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
    return ok(validationResult.value as Config)
  }
  
  return err({
    message: validationResult.error.message,
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