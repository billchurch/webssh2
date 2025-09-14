// server
// app/utils.ts

import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import maskObject from 'jsmasker'
import { createNamespacedDebug } from './logger.js'
import { MESSAGES } from './constants.js'
import configSchema from './configSchema.js'
// Import pure validation functions
import { validateHost, validatePort, validateTerm, normalizeDimension } from './validation/ssh.js'
import {
  isValidCredentials as validateCredentials,
  type Credentials,
} from './validation/credentials.js'
import { isValidEnvKey, isValidEnvValue, parseEnvVars } from './validation/environment.js'

const debug = createNamespacedDebug('utils')

export function deepMerge<T extends object>(target: T, source: unknown): T {
  const output: Record<string, unknown> = { ...(target as Record<string, unknown>) }
  if (source !== null && source !== undefined && typeof source === 'object') {
    const src = source as Record<string, unknown>
    for (const key of Object.keys(src)) {
      // Keys originate from an internal object (not user input)
      // eslint-disable-next-line security/detect-object-injection
      const value = src[key]
      if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
        // eslint-disable-next-line security/detect-object-injection
        const prev = (output[key] as Record<string, unknown> | undefined) ?? {}
        // eslint-disable-next-line security/detect-object-injection
        output[key] = deepMerge(prev, value as Record<string, unknown>)
      } else {
        // eslint-disable-next-line security/detect-object-injection
        output[key] = value
      }
    }
  }
  return output as T
}

// Re-export validation functions for backward compatibility
export const getValidatedHost = validateHost
export const getValidatedPort = validatePort

// Re-export types and validation functions for backward compatibility
export type { Credentials }
export const isValidCredentials = validateCredentials
export const validateSshTerm = validateTerm

export function validateConfig(config: unknown): unknown {
  type ValidateFn = ((data: unknown) => boolean) & { errors?: unknown }
  interface AjvLike {
    compile: (schema: unknown) => ValidateFn
    errorsText: (errors?: unknown) => string
  }
  type AjvConstructor = new () => AjvLike
  const AjvCtor = Ajv as unknown as AjvConstructor
  const ajv: AjvLike = new AjvCtor()
  ;(addFormats as unknown as (a: unknown) => void)(ajv)
  const validate = ajv.compile(configSchema as unknown as object)
  const valid = validate(config)
  if (!valid) {
    throw new Error(`${MESSAGES.CONFIG_VALIDATION_ERROR}: ${ajv.errorsText(validate.errors)}`)
  }
  return config
}

export function modifyHtml(html: string, config: unknown): string {
  debug('modifyHtml')
  const modifiedHtml = html.replace(/(src|href)="(?!http|\/\/)/g, '$1="/ssh/assets/')
  return modifiedHtml.replace(
    'window.webssh2Config = null;',
    `window.webssh2Config = ${JSON.stringify(config)};`
  )
}

export function maskSensitiveData(obj: unknown, options?: unknown): unknown {
  const defaultOptions = {
    properties: ['password', 'privateKey', 'passphrase', 'key', 'secret', 'token'],
  }
  debug('maskSensitiveData')
  const maskingOptions = { ...defaultOptions, ...(options as object | undefined) }
  const masker = maskObject as unknown as (o: unknown, opts: unknown) => unknown
  return masker(obj, maskingOptions)
}

// Re-export environment validation functions for backward compatibility
export { isValidEnvKey, isValidEnvValue, parseEnvVars }

// Treat empty string as missing and fall back when appropriate
export function pickField(primary?: string | null, fallback?: string | null): string | undefined {
  return primary != null && primary !== '' ? primary : (fallback ?? undefined)
}

// Re-export normalizeDimension as normalizeDim for backward compatibility
export const normalizeDim = normalizeDimension
