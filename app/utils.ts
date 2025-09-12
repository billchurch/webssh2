// server
// app/utils.ts

import validator from 'validator'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import maskObject from 'jsmasker'
import { createNamespacedDebug } from './logger.js'
import { DEFAULTS, MESSAGES, ENV_LIMITS } from './constants.js'
import configSchema from './configSchema.js'

const debug = createNamespacedDebug('utils')

export function deepMerge<T extends object>(target: T, source: unknown): T {
  const output: Record<string, unknown> = { ...(target as Record<string, unknown>) }
  if (source && typeof source === 'object') {
    const src = source as Record<string, unknown>
    for (const key of Object.keys(src)) {
      // Keys originate from an internal object (not user input)
      // eslint-disable-next-line security/detect-object-injection
      const value = src[key]
      if (value && typeof value === 'object' && !Array.isArray(value)) {
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

export function getValidatedHost(host: string): string {
  if (validator.isIP(host)) {
    return host
  }
  return validator.escape(host)
}

export function getValidatedPort(portInput?: string): number {
  const defaultPort = DEFAULTS.SSH_PORT
  debug('getValidatedPort: input: %O', portInput)
  if (portInput && validator.isInt(portInput, { min: 1, max: 65535 })) {
    return parseInt(portInput, 10)
  }
  debug('getValidatedPort: port not specified or invalid, using default: %O', defaultPort)
  return defaultPort
}

export interface Credentials {
  username?: string
  host?: string
  port?: number
  password?: string
  privateKey?: string
  passphrase?: string
  term?: string
  cols?: number | string
  rows?: number | string
}

export function isValidCredentials(creds: Credentials | undefined): boolean {
  const hasRequiredFields = !!(
    creds &&
    typeof creds.username === 'string' &&
    typeof creds.host === 'string' &&
    typeof creds.port === 'number'
  )
  if (!hasRequiredFields) {
    return false
  }

  const hasPassword = typeof creds.password === 'string'
  const hasPrivateKey = typeof creds.privateKey === 'string'
  const hasValidPassphrase = !('passphrase' in creds) || typeof creds.passphrase === 'string'
  return (hasPassword || hasPrivateKey) && hasValidPassphrase
}

export function validateSshTerm(term?: string): string | null {
  debug('validateSshTerm: %O', term)
  if (!term) {
    return null
  }
  const ok =
    validator.isLength(term, { min: 1, max: 30 }) && validator.matches(term, /^[a-zA-Z0-9.-]+$/)
  return ok ? term : null
}

export function validateConfig(config: unknown): unknown {
  type ValidateFn = ((data: unknown) => boolean) & { errors?: unknown }
  type AjvLike = {
    compile: (schema: unknown) => ValidateFn
    errorsText: (errors?: unknown) => string
  }
  const AjvCtor = Ajv as unknown as { new (): AjvLike }
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

export function isValidEnvKey(key: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(key)
}

export function isValidEnvValue(value: string): boolean {
  return !/[;&|`$]/.test(value)
}

export function parseEnvVars(envString?: string): Record<string, string> | null {
  if (!envString) {
    return null
  }
  const envVars: Record<string, string> = {}
  const pairs = envString.split(',')
  let added = 0
  for (const pairString of pairs) {
    const pair = pairString.split(':')
    if (pair.length !== 2) {
      continue
    }
    const [keyRaw, valueRaw] = pair as [string, string]
    const key = keyRaw.trim()
    const value = valueRaw.trim()
    if (
      isValidEnvKey(key) &&
      key.length <= ENV_LIMITS.MAX_KEY_LENGTH &&
      isValidEnvValue(value) &&
      value.length <= ENV_LIMITS.MAX_VALUE_LENGTH
    ) {
      // Key validated by isValidEnvKey
      // eslint-disable-next-line security/detect-object-injection
      envVars[key] = value
      added += 1
      if (added >= ENV_LIMITS.MAX_PAIRS) {
        debug(
          'parseEnvVars: reached max pair cap (%d), remaining pairs ignored',
          ENV_LIMITS.MAX_PAIRS
        )
        break
      }
    } else {
      debug('parseEnvVars: Invalid env var pair: %s:%s', key, value)
    }
  }
  return Object.keys(envVars).length ? envVars : null
}

// Treat empty string as missing and fall back when appropriate
export function pickField(primary?: string | null, fallback?: string | null): string | undefined {
  return primary != null && primary !== '' ? primary : (fallback ?? undefined)
}

function isFiniteNonZeroNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n !== 0
}

// Normalize terminal dimensions with explicit > 0 rule
export function normalizeDim(primary: unknown, secondary: unknown, defaultValue: number): number {
  if (isFiniteNonZeroNumber(primary)) {
    return primary
  }
  if (isFiniteNonZeroNumber(secondary)) {
    return secondary
  }
  return defaultValue
}
