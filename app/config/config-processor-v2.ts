// app/config/config-processor-v2.ts
// Config processing with Result types for explicit error handling

import { deepMerge } from '../utils.js'
import type { Config } from '../types/config.js'
import { ok, err, type Result } from '../types/result.js'
import { createDefaultConfig } from './config-processor.js'

/**
 * Config error types
 */
export interface ConfigError {
  type: 'VALIDATION' | 'MERGE' | 'PARSE'
  message: string
  details?: unknown
}

/**
 * Parse JSON configuration safely
 */
export function parseJsonConfig(jsonString: string): Result<unknown, ConfigError> {
  try {
    const parsed: unknown = JSON.parse(jsonString)
    return ok(parsed)
  } catch (error) {
    return err({
      type: 'PARSE',
      message: 'Invalid JSON format',
      details: error
    })
  }
}

/**
 * Validate config structure
 */
export function validateConfigStructure(config: unknown): Result<Config, ConfigError> {
  if (typeof config !== 'object' || config == null) {
    return err({
      type: 'VALIDATION',
      message: 'Config must be an object'
    })
  }
  
  // Basic validation - could be expanded with schema validation
  const cfg = config as Record<string, unknown>
  
  if (cfg['listen'] != null && typeof cfg['listen'] !== 'object') {
    return err({
      type: 'VALIDATION',
      message: 'listen must be an object'
    })
  }
  
  if (cfg['ssh'] != null && typeof cfg['ssh'] !== 'object') {
    return err({
      type: 'VALIDATION',
      message: 'ssh must be an object'
    })
  }
  
  if (cfg['user'] != null && typeof cfg['user'] !== 'object') {
    return err({
      type: 'VALIDATION',
      message: 'user must be an object'
    })
  }
  
  return ok(config as Config)
}

/**
 * Merge configs safely
 */
export function mergeConfigs(
  base: Config,
  override: Partial<Config>
): Result<Config, ConfigError> {
  try {
    const merged = deepMerge(base, override)
    return ok(merged)
  } catch (error) {
    return err({
      type: 'MERGE',
      message: 'Failed to merge configurations',
      details: error
    })
  }
}

/**
 * Apply environment overrides
 */
export function applyEnvironmentOverrides(
  config: Config,
  env: Record<string, unknown>
): Result<Config, ConfigError> {
  const overrides: Partial<Config> = {}
  
  // Port override
  if (env['PORT'] != null) {
    const portValue = env['PORT']
    const port = Number(portValue)
    if (isNaN(port) || port < 1 || port > 65535) {
      return err({
        type: 'VALIDATION',
        message: `Invalid PORT: ${typeof portValue === 'string' ? portValue : JSON.stringify(portValue)}`
      })
    }
    overrides.listen = { ...config.listen, port }
  }
  
  // Host override
  if (typeof env['HOST'] === 'string' && env['HOST'] !== '') {
    overrides.listen = {
      ...overrides.listen,
      ...config.listen,
      ip: env['HOST']
    }
  }
  
  return mergeConfigs(config, overrides)
}

/**
 * Process configuration pipeline
 */
export function processConfigPipeline(
  customConfig?: string,
  env?: Record<string, unknown>,
  sessionSecret?: string
): Result<Config, ConfigError> {
  // Start with default config
  let config = createDefaultConfig(sessionSecret)
  
  // Parse and merge custom config if provided
  if (customConfig != null && customConfig !== '') {
    const parseResult = parseJsonConfig(customConfig)
    if (!parseResult.ok) {
      return parseResult
    }
    
    const validateResult = validateConfigStructure(parseResult.value)
    if (!validateResult.ok) {
      return validateResult
    }
    
    const mergeResult = mergeConfigs(config, validateResult.value)
    if (!mergeResult.ok) {
      return mergeResult
    }
    
    config = mergeResult.value
  }
  
  // Apply environment overrides if provided
  if (env != null) {
    const overrideResult = applyEnvironmentOverrides(config, env)
    if (!overrideResult.ok) {
      return overrideResult
    }
    
    config = overrideResult.value
  }
  
  return ok(config)
}

/**
 * Validate SSH algorithms configuration
 */
export function validateSshAlgorithms(
  algorithms: unknown
): Result<Config['ssh']['algorithms'], ConfigError> {
  if (typeof algorithms !== 'object' || algorithms == null) {
    return err({
      type: 'VALIDATION',
      message: 'SSH algorithms must be an object'
    })
  }
  
  const alg = algorithms as Record<string, unknown>
  
  // Validate algorithm arrays
  const fields = ['kex', 'cipher', 'hmac', 'compress', 'serverHostKey']
  const algMap = new Map(Object.entries(alg))
  
  for (const field of fields) {
    const value = algMap.get(field)
    if (value != null && !Array.isArray(value)) {
      return err({
        type: 'VALIDATION',
        message: `SSH algorithms.${field} must be an array`
      })
    }
  }
  
  return ok(algorithms as Config['ssh']['algorithms'])
}

/**
 * Sanitize config for client
 */
export function sanitizeConfigForClient(
  config: Config
): Result<Record<string, unknown>, ConfigError> {
  try {
    // Create a new object without sensitive fields
    const sanitized = Object.fromEntries(
      Object.entries(config).filter(([key]) => key !== 'session')
    )
    
    // Override user field to remove sensitive data
    sanitized['user'] = {
      ...config.user,
      password: null,
      privateKey: null,
      passphrase: null
    }
    
    return ok(sanitized)
  } catch (error) {
    return err({
      type: 'VALIDATION',
      message: 'Failed to sanitize config',
      details: error
    })
  }
}