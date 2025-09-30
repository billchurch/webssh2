// server
// app/config.ts

import { generateSecureSecret, enhanceConfig, err } from './utils/index.js'
import { createNamespacedDebug } from './logger.js'
import { ConfigError } from './errors.js'
import type { Config, ConfigValidationError } from './types/config.js'
import { mapEnvironmentVariables } from './config/env-mapper.js'
import {
  readConfigFile,
  resolveConfigFile,
  configLocationToPath,
  type ConfigFileResolution
} from './config/config-loader.js'
import {
  createDefaultConfig,
  processConfig as processConfigPure,
  parseConfigJson,
  createCorsConfig as createCorsConfigPure
} from './config/config-processor.js'
import { maskSensitiveConfig } from './config/safe-logging.js'
import type { Result } from './types/result.js'

const debug = createNamespacedDebug('config')

// Session secret will be generated inside loadEnhancedConfig if needed

async function loadEnhancedConfig(
  resolution: ConfigFileResolution,
  sessionSecret?: string
): Promise<Result<Config, ConfigValidationError[]>> {
  // Start with default config
  const defaultConfig = createDefaultConfig(sessionSecret)
  const resolvedPath = configLocationToPath(resolution.location)

  // Load file config if a valid location exists
  let fileConfig: Partial<Config> | undefined
  if (resolution.exists) {
    const fileResult = await readConfigFile(resolution.location)
    if (fileResult.ok) {
      const parseResult = parseConfigJson(fileResult.value)
      if (parseResult.ok) {
        fileConfig = parseResult.value
      } else {
        return err([{
          path: 'config.json',
          message: `Failed to parse config JSON: ${parseResult.error.message}`,
        }])
      }
    } else {
      // Check if it's just a missing file (ENOENT) - this is expected and not an error
      const error = fileResult.error as { code?: string }
      if (error.code === 'ENOENT') {
        // Missing file is expected and not an error
        debug('Config file not found (expected):', resolvedPath)
      } else {
        // Only treat non-ENOENT errors as actual errors
        return err([{
          path: 'config.json',
          message: `Failed to read config file: ${fileResult.error.message}`,
        }])
      }
      // File doesn't exist - this is fine, we'll use env vars and defaults
    }
  } else {
    // No config file available, skip file loading
    debug('No config file found at %s, using environment variables and defaults', resolvedPath)
  }
  
  // Load environment config
  const envConfig = mapEnvironmentVariables(process.env)
  
  // Process and merge configs
  const processResult = processConfigPure(
    defaultConfig,
    fileConfig,
    envConfig as Partial<Config>
  )
  
  if (processResult.ok) {
    // Enhance with branded types validation
    return enhanceConfig(processResult.value)
  } else {
    return err([{
      path: '',
      message: processResult.error.message,
      value: processResult.error.originalConfig,
    }])
  }
}

export async function loadConfigAsync(): Promise<Config> {
  debug('Using enhanced configuration implementation')
  const resolution = resolveConfigFile()
  const configPath = configLocationToPath(resolution.location)
  const sessionSecret = process.env['WEBSSH_SESSION_SECRET'] ?? generateSecureSecret()
  
  const result = await loadEnhancedConfig(resolution, sessionSecret)
  
  if (result.ok) {
    // Config loaded successfully, continue
  } else {
    // Check if it's a real error or just normal operation with env vars
    const errors = result.error
    const hasRealError = errors.some(e =>
      !e.path.includes('config.json') ||
      !e.message.includes('ENOENT')
    )

    if (hasRealError) {
      debug('Config validation error: %O', result.error)
      throw new ConfigError(
        `Configuration validation failed: ${errors.map(e => e.message).join(', ')}`
      )
    } else {
      // This shouldn't happen but keeping as safety
      debug('Config returned an unexpected result, check the implementation')
      throw new ConfigError('Configuration loading failed unexpectedly')
    }
  }
  
  // Check if config.json was found or just using env/defaults
  if (resolution.exists) {
    debug('Configuration loaded from %s and environment variables', configPath)
  } else {
    debug('No config.json found at %s, configuration loaded from environment variables and defaults', configPath)
  }
  
  const finalConfig = result.value
  debug('Loaded configuration: %O', maskSensitiveConfig(finalConfig))
  return finalConfig
}

let configInstance: Config | null = null
let configLoadPromise: Promise<Config> | null = null

export function getConfig(): Promise<Config> {
  if (configInstance != null) {
    return Promise.resolve(configInstance)
  }
  configLoadPromise ??= loadConfigAsync().then((cfg) => {
    configInstance = cfg
    ;(
      configInstance as Config & {
        getCorsConfig?: () => { origin: string[]; methods: string[]; credentials: boolean }
      }
    ).getCorsConfig = getCorsConfig
    return configInstance
  })
  return configLoadPromise
}

export function getCorsConfig(): { origin: string[]; methods: string[]; credentials: boolean } {
  const currentConfig = configInstance
  if (currentConfig == null) {
    throw new ConfigError('Configuration not loaded. Call getConfig() first.')
  }
  
  // Create CORS configuration
  return createCorsConfigPure(currentConfig)
}

export function resetConfigForTesting(): void {
  configInstance = null
  configLoadPromise = null
  debug('Config instance reset for testing')
}
