// server
// app/utils.ts

import validator from 'validator'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import maskObject from 'jsmasker'
import { createNamespacedDebug } from './logger.js'
import { DEFAULTS, MESSAGES } from './constants.js'
import configSchema from './configSchema.js'

const debug = createNamespacedDebug('utils')

export function deepMerge<T extends object>(target: T, source: unknown): T {
  const output: Record<string, unknown> = { ...(target as Record<string, unknown>) }
  if (source && typeof source === 'object') {
    const src = source as Record<string, unknown>
    for (const key of Object.keys(src)) {
      const value = src[key]
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const prev = (output[key] as Record<string, unknown>) || {}
        output[key] = deepMerge(prev, value as Record<string, unknown>)
      } else {
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
  const AjvCtor = Ajv as unknown as { new (): unknown }
  const ajv = new AjvCtor()
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
  for (const pairString of pairs) {
    const pair = pairString.split(':')
    if (pair.length !== 2) {
      continue
    }
    const key = pair[0].trim()
    const value = pair[1].trim()
    if (isValidEnvKey(key) && isValidEnvValue(value)) {
      envVars[key] = value
    } else {
      debug('parseEnvVars: Invalid env var pair: %s:%s', key, value)
    }
  }
  return Object.keys(envVars).length ? envVars : null
}
