// server
// app/config.ts

import path, { dirname } from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { generateSecureSecret } from './crypto-utils.js'
import { createNamespacedDebug } from './logger.js'
import { ConfigError, handleError } from './errors.js'
import { loadEnvironmentConfig } from './envConfig.js'
import type { Config } from './types/config.js'
import { 
  createDefaultConfig,
  processConfig,
  parseConfigJson,
  createCorsConfig as createCorsConfigPure
} from './config/config-processor.js'
import { readConfigFile } from './config/config-loader.js'
import { isErr } from './types/result.js'

const debug = createNamespacedDebug('config')

// Create default config using pure function
const sessionSecret = process.env['WEBSSH_SESSION_SECRET'] ?? generateSecureSecret()
const defaultConfig = createDefaultConfig(sessionSecret)

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

export async function loadConfigAsync(): Promise<Config> {
  const configPath = getConfigPath()
  
  // Load file config if exists
  let fileConfig: Partial<Config> | undefined
  const fileResult = await readConfigFile(configPath)
  
  if (isErr(fileResult)) {
    const err = fileResult.error as { code?: string; message?: string }
    if (err.code === 'ENOENT') {
      debug('No config.json found, using environment variables and defaults')
    } else {
      debug('Error loading config.json: %s', err.message)
      const error = new ConfigError(
        `Problem loading config.json for webssh: ${err.message ?? 'unknown error'}`
      )
      handleError(error)
    }
  } else {
    const parseResult = parseConfigJson(fileResult.value)
    if (isErr(parseResult)) {
      debug('Error parsing config.json: %s', parseResult.error.message)
      const error = new ConfigError(
        `Problem loading config.json for webssh: ${parseResult.error.message}`
      )
      handleError(error)
    } else {
      fileConfig = parseResult.value
      debug('Loaded and parsed config.json')
    }
  }
  
  // Load environment config
  const envConfig = loadEnvironmentConfig()
  if (Object.keys(envConfig).length > 0) {
    debug('Loaded environment variables')
    debug('Header config from env: %O', envConfig['header'])
  }
  
  // Process and validate using pure functions
  const processResult = processConfig(
    defaultConfig,
    fileConfig,
    envConfig as Partial<Config>
  )
  
  if (isErr(processResult)) {
    debug('Configuration validation failed: %s', processResult.error.message)
    // Return unvalidated config as fallback
    return processResult.error.originalConfig
  }
  
  debug('Configuration loaded and validated successfully')
  return processResult.value
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
  return createCorsConfigPure(currentConfig)
}

export function resetConfigForTesting(): void {
  configInstance = null
  configLoadPromise = null
  debug('Config instance reset for testing')
}
