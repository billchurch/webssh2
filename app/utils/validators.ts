// app/utils/validators.ts
// Centralized validation utilities

import validator from 'validator'
import type { Result } from '../types/result.js'
import { ok, err } from './result.js'
import type {
  SshHost,
  SshPort,
  Username,
  Password,
  TerminalType,
} from '../types/branded.js'
import {
  createSshHost,
  createSshPort,
  createUsername,
  createPassword,
  createTerminalType,
} from './branded.js'

/**
 * Validation error
 */
export interface ValidationError {
  readonly field: string
  readonly value: unknown
  readonly message: string
  readonly constraint: string | undefined
}

/**
 * Validation result
 */
export type ValidationResult<T> = Result<T, ValidationError[]>

/**
 * Common validation constraints
 */
export const Constraints = {
  HOST: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 255,
  },
  PORT: {
    MIN: 1,
    MAX: 65535,
  },
  USERNAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 255,
    PATTERN: /^[a-zA-Z0-9._-]+$/,
  },
  PASSWORD: {
    MIN_LENGTH: 0,
    MAX_LENGTH: 4096,
  },
  TERM: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9-]+$/,
    DEFAULT: 'xterm-256color',
  },
  ENV_VAR_NAME: {
    PATTERN: /^[A-Za-z_]\w*$/,
  },
  ENV_VAR_VALUE: {
    MAX_LENGTH: 4096,
  },
  PATH: {
    MAX_LENGTH: 4096,
    PATTERN: /^[^<>:"|?*]+$/,
  },
  URL: {
    MAX_LENGTH: 2048,
  },
} as const

/**
 * Validate hostname or IP address
 */
export function validateHost(
  value: unknown,
  field = 'host'
): ValidationResult<SshHost> {
  if (value == null || value === '') {
    return err([{
      field,
      value,
      message: 'Host is required',
      constraint: 'required',
    }])
  }
  
  if (typeof value !== 'string') {
    return err([{
      field,
      value,
      message: 'Host must be a string',
      constraint: 'type:string',
    }])
  }
  
  if (value.length > Constraints.HOST.MAX_LENGTH) {
    return err([{
      field,
      value,
      message: `Host must not exceed ${Constraints.HOST.MAX_LENGTH} characters`,
      constraint: `maxLength:${Constraints.HOST.MAX_LENGTH}`,
    }])
  }
  
  // Check if it's a valid IP address (IPv4 or IPv6)
  if (validator.isIP(value)) {
    // Valid IP address, no additional validation needed
  } else if (!validator.isFQDN(value, {
    require_tld: false,  // Allow local hostnames without TLD
    allow_underscores: false,
    allow_trailing_dot: false,
    allow_numeric_tld: false,
    allow_wildcard: false,
  })) {
    // Not a valid IP or hostname
    return err([{
      field,
      value,
      message: 'Invalid hostname or IP address format',
      constraint: 'format:hostname',
    }])
  }
  
  try {
    return ok(createSshHost(value))
  } catch (e) {
    return err([{
      field,
      value,
      message: (e as Error).message,
      constraint: 'invalid',
    }])
  }
}

/**
 * Validate optional host
 */
export function validateOptionalHost(
  value: unknown,
  field = 'host'
): ValidationResult<SshHost | null> {
  if (value == null || value === '') {
    return ok(null)
  }
  return validateHost(value, field)
}

/**
 * Validate port number
 */
export function validatePort(
  value: unknown,
  field = 'port'
): ValidationResult<SshPort> {
  if (value == null) {
    // Default to SSH port
    return ok(createSshPort(22))
  }
  
  let port: number
  
  if (typeof value === 'string') {
    port = parseInt(value, 10)
    if (isNaN(port)) {
      return err([{
        field,
        value,
        message: 'Port must be a number',
        constraint: 'type:number',
      }])
    }
  } else if (typeof value === 'number') {
    port = value
  } else {
    return err([{
      field,
      value,
      message: 'Port must be a number',
      constraint: 'type:number',
    }])
  }
  
  if (!Number.isInteger(port)) {
    return err([{
      field,
      value,
      message: 'Port must be an integer',
      constraint: 'type:integer',
    }])
  }
  
  if (port < Constraints.PORT.MIN || port > Constraints.PORT.MAX) {
    return err([{
      field,
      value,
      message: `Port must be between ${Constraints.PORT.MIN} and ${Constraints.PORT.MAX}`,
      constraint: `range:${Constraints.PORT.MIN}-${Constraints.PORT.MAX}`,
    }])
  }
  
  return ok(createSshPort(port))
}

/**
 * Validate username
 */
export function validateUsername(
  value: unknown,
  field = 'username'
): ValidationResult<Username> {
  if (value == null || value === '') {
    return err([{
      field,
      value,
      message: 'Username is required',
      constraint: 'required',
    }])
  }
  
  if (typeof value !== 'string') {
    return err([{
      field,
      value,
      message: 'Username must be a string',
      constraint: 'type:string',
    }])
  }
  
  if (value.length > Constraints.USERNAME.MAX_LENGTH) {
    return err([{
      field,
      value,
      message: `Username must not exceed ${Constraints.USERNAME.MAX_LENGTH} characters`,
      constraint: `maxLength:${Constraints.USERNAME.MAX_LENGTH}`,
    }])
  }
  
  if (!Constraints.USERNAME.PATTERN.test(value)) {
    return err([{
      field,
      value,
      message: 'Username contains invalid characters',
      constraint: 'pattern:alphanumeric',
    }])
  }
  
  return ok(createUsername(value))
}

/**
 * Validate optional username
 */
export function validateOptionalUsername(
  value: unknown,
  field = 'username'
): ValidationResult<Username | null> {
  if (value == null || value === '') {
    return ok(null)
  }
  return validateUsername(value, field)
}

/**
 * Validate password
 */
export function validatePassword(
  value: unknown,
  field = 'password',
  options?: {
    minLength?: number
    maxLength?: number
    required?: boolean
  }
): ValidationResult<Password> {
  const required = options?.required ?? false
  const minLength = options?.minLength ?? Constraints.PASSWORD.MIN_LENGTH
  const maxLength = options?.maxLength ?? Constraints.PASSWORD.MAX_LENGTH
  
  if (value == null || value === '') {
    if (required) {
      return err([{
        field,
        value,
        message: 'Password is required',
        constraint: 'required',
      }])
    }
    return ok(createPassword(''))
  }
  
  if (typeof value !== 'string') {
    return err([{
      field,
      value,
      message: 'Password must be a string',
      constraint: 'type:string',
    }])
  }
  
  if (value.length < minLength) {
    return err([{
      field,
      value: '[REDACTED]',
      message: `Password must be at least ${minLength} characters`,
      constraint: `minLength:${minLength}`,
    }])
  }
  
  if (value.length > maxLength) {
    return err([{
      field,
      value: '[REDACTED]',
      message: `Password must not exceed ${maxLength} characters`,
      constraint: `maxLength:${maxLength}`,
    }])
  }
  
  return ok(createPassword(value))
}

/**
 * Validate terminal type
 */
export function validateTerminal(
  value: unknown,
  field = 'term'
): ValidationResult<TerminalType | null> {
  if (value == null || value === '') {
    return ok(null)
  }
  
  if (typeof value !== 'string') {
    return err([{
      field,
      value,
      message: 'Terminal type must be a string',
      constraint: 'type:string',
    }])
  }
  
  if (value.length > Constraints.TERM.MAX_LENGTH) {
    return err([{
      field,
      value,
      message: `Terminal type must not exceed ${Constraints.TERM.MAX_LENGTH} characters`,
      constraint: `maxLength:${Constraints.TERM.MAX_LENGTH}`,
    }])
  }
  
  if (!Constraints.TERM.PATTERN.test(value)) {
    return err([{
      field,
      value,
      message: 'Invalid terminal type format',
      constraint: 'pattern:term',
    }])
  }
  
  return ok(createTerminalType(value))
}

/**
 * Validate environment variable
 */
export function validateEnvVar(
  name: unknown,
  value: unknown
): ValidationResult<[string, string]> {
  const errors: ValidationError[] = []
  
  if (name == null || name === '') {
    errors.push({
      field: 'env.name',
      value: name,
      message: 'Environment variable name is required',
      constraint: 'required',
    })
  } else if (typeof name !== 'string') {
    errors.push({
      field: 'env.name',
      value: name,
      message: 'Environment variable name must be a string',
      constraint: 'type:string',
    })
  } else if (!Constraints.ENV_VAR_NAME.PATTERN.test(name)) {
    errors.push({
      field: 'env.name',
      value: name,
      message: 'Invalid environment variable name format',
      constraint: 'pattern:env_var',
    })
  }
  
  if (value == null) {
    errors.push({
      field: 'env.value',
      value,
      message: 'Environment variable value is required',
      constraint: 'required',
    })
  } else if (typeof value !== 'string') {
    errors.push({
      field: 'env.value',
      value,
      message: 'Environment variable value must be a string',
      constraint: 'type:string',
    })
  } else if (value.length > Constraints.ENV_VAR_VALUE.MAX_LENGTH) {
    errors.push({
      field: 'env.value',
      value: `${value.substring(0, 50)}...`,
      message: `Environment variable value must not exceed ${Constraints.ENV_VAR_VALUE.MAX_LENGTH} characters`,
      constraint: `maxLength:${Constraints.ENV_VAR_VALUE.MAX_LENGTH}`,
    })
  }
  
  if (errors.length > 0) {
    return err(errors)
  }
  
  return ok([name as string, value as string])
}

/**
 * Validate object against schema
 */
export type FieldValidator<T> = (value: unknown, field: string) => ValidationResult<T>

export interface Schema {
  [field: string]: FieldValidator<unknown>
}

/**
 * Validate object against schema
 */
export function validateObject<T extends Record<string, unknown>>(
  obj: unknown,
  schema: Schema
): ValidationResult<T> {
  if (obj == null || typeof obj !== 'object') {
    return err([{
      field: '',
      value: obj,
      message: 'Value must be an object',
      constraint: 'type:object',
    }])
  }
  
  const errors: ValidationError[] = []
  const resultMap = new Map<string, unknown>()
  
  // Convert input object to Map for safe access
  const objMap = new Map(Object.entries(obj as Record<string, unknown>))
  
  for (const [field, validator] of Object.entries(schema)) {
    // Use Map.get which is completely safe from prototype pollution
    const value = objMap.get(field)
    const validation = validator(value, field)
    
    if (validation.ok) {
      resultMap.set(field, validation.value)
    } else {
      errors.push(...validation.error)
    }
  }
  
  if (errors.length > 0) {
    return err(errors)
  }
  
  // Convert Map back to object
  const result = Object.fromEntries(resultMap)
  return ok(result as T)
}

/**
 * Combine multiple validation results
 */
export function combineValidations<T extends readonly unknown[]>(
  ...validations: { [K in keyof T]: ValidationResult<T[K]> }
): ValidationResult<T> {
  const errors: ValidationError[] = []
  const values: unknown[] = []
  
  for (const validation of validations) {
    if (validation.ok) {
      values.push(validation.value)
    } else {
      errors.push(...validation.error)
    }
  }
  
  if (errors.length > 0) {
    return err(errors)
  }
  
  return ok(values as unknown as T)
}

/**
 * Create custom validator
 */
export function createValidator<T>(
  validate: (value: unknown) => boolean,
  transform: (value: unknown) => T,
  errorMessage: string,
  constraint?: string
): FieldValidator<T> {
  return (value: unknown, field: string): ValidationResult<T> => {
    if (!validate(value)) {
      return err([{
        field,
        value,
        message: errorMessage,
        constraint,
      }])
    }
    
    try {
      return ok(transform(value))
    } catch (e) {
      return err([{
        field,
        value,
        message: (e as Error).message,
        constraint: 'transform',
      }])
    }
  }
}