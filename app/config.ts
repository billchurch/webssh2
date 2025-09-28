// server
// app/config.ts

import path, { dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { generateSecureSecret } from './utils/index.js'
import { createNamespacedDebug } from './logger.js'
import { ConfigError } from './errors.js'
import type { Config, ConfigValidationError } from './types/config.js'
import { enhanceConfig } from './utils/index.js'
import { mapEnvironmentVariables } from './config/env-mapper.js'
import { readConfigFile } from './config/config-loader.js'
import {
  createDefaultConfig,
  processConfig as processConfigPure,
  parseConfigJson,
  createCorsConfig as createCorsConfigPure
} from './config/config-processor.js'
import { maskSensitiveConfig } from './config/safe-logging.js'
import type { Result } from './types/result.js'
import { err } from './utils/index.js'

const debug = createNamespacedDebug('config')

// Session secret will be generated inside loadEnhancedConfig if needed

const FILENAME = fileURLToPath(import.meta.url)
const DIRNAME = dirname(FILENAME)

function getConfigPath(): string {
  // Prefer project root config.json regardless of running from src or dist
  const candidateA = path.join(DIRNAME, '..', 'config.json')
  if (existsSync(candidateA)) {
    return candidateA
  }
  const candidateB = path.join(DIRNAME, '..', '..', 'config.json')
  if (existsSync(candidateB)) {
    return candidateB
  }
  return candidateA
}

async function loadEnhancedConfig(
  configPath?: string,
  sessionSecret?: string
): Promise<Result<Config, ConfigValidationError[]>> {
  // Start with default config
  const defaultConfig = createDefaultConfig(sessionSecret)
  
  // Load file config if path provided and file exists
  let fileConfig: Partial<Config> | undefined
  if (configPath == null || configPath === '') {
    // No config path provided, skip file loading
    debug('No config path provided, using environment variables and defaults')
  } else {
    const fileResult = await readConfigFile(configPath)
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
        debug('Config file not found (expected):', configPath)
      } else {
        // Only treat non-ENOENT errors as actual errors
        return err([{
          path: 'config.json',
          message: `Failed to read config file: ${fileResult.error.message}`,
        }])
      }
      // File doesn't exist - this is fine, we'll use env vars and defaults
    }
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
  const configPath = getConfigPath()
  const sessionSecret = process.env['WEBSSH_SESSION_SECRET'] ?? generateSecureSecret()
  
  const result = await loadEnhancedConfig(configPath, sessionSecret)
  
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
  // configPath is from internal getConfigPath(), not user input
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const configFileExists = existsSync(configPath)
  if (configFileExists) {
    debug('Configuration loaded from config.json and environment variables')
  } else {
    debug('No config.json found, configuration loaded from environment variables and defaults')
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
