import type { Result } from '../../types/result.js'
import validator from 'validator'
import { ENV_LIMITS, VALIDATION_LIMITS } from '../../constants/index.js'
import { safeGet, isRecord } from '../../utils/safe-property-access.js'
import type { FieldDescriptor, DimensionFieldDescriptor, DimensionField } from './fields.js'
import { ENV_KEY_PATTERN } from './fields.js'

export const ensureRecord = (
  value: unknown,
  errorMessage: string
): Result<Record<string, unknown>> => {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: new Error(errorMessage)
    }
  }

  return { ok: true, value }
}

const toValidationString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return ''
}

export const parseIntInRange = (
  value: unknown,
  min: number,
  max: number,
  fieldName: string
): Result<number> => {
  const str = toValidationString(value)
  if (!validator.isInt(str, { min, max })) {
    return {
      ok: false,
      error: new Error(`${fieldName} must be an integer between ${min} and ${max}`)
    }
  }

  return {
    ok: true,
    value: Number.parseInt(str, 10)
  }
}

export const validatePort = (value: unknown): Result<number> => {
  const str = toValidationString(value)
  if (!validator.isPort(str)) {
    return {
      ok: false,
      error: new Error(`Invalid port: ${str}`)
    }
  }

  return {
    ok: true,
    value: Number.parseInt(str, 10)
  }
}

interface StringValidationOptions {
  required?: boolean
  errorMessage?: string
  trim?: boolean
}

export const validateStringField = <Name extends string>(
  obj: Record<string, unknown>,
  field: FieldDescriptor<Name>,
  options: StringValidationOptions = {}
): Result<string | undefined> => {
  const value = safeGet(obj, field.key)
  const requiredMessage = options.errorMessage ?? `${field.name} is required`
  const emptyMessage = options.errorMessage ?? `${field.name} must be a non-empty string`
  const typeMessage = field.name === 'term'
    ? 'Terminal type must be a string'
    : `${field.name} must be a string`

  if (value == null) {
    if (options.required === true) {
      return {
        ok: false,
        error: new Error(requiredMessage)
      }
    }
    return { ok: true, value: undefined }
  }

  if (typeof value !== 'string') {
    return {
      ok: false,
      error: new Error(options.errorMessage ?? typeMessage)
    }
  }

  const resultValue = options.trim === true ? value.trim() : value
  if (options.required === true && resultValue === '') {
    return {
      ok: false,
      error: new Error(emptyMessage)
    }
  }

  return { ok: true, value: resultValue }
}

export const validateDimension = (
  obj: Record<string, unknown>,
  field: DimensionFieldDescriptor<DimensionField>,
  bounds: { min: number; max: number }
): Result<number | undefined> => {
  const value = safeGet(obj, field.key)
  if (value == null) {
    return { ok: true, value: undefined }
  }

  return parseIntInRange(value, bounds.min, bounds.max, field.label)
}

export const validateEnvironmentVars = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const entries = Object.entries(value)
    .slice(0, ENV_LIMITS.MAX_PAIRS)
    .filter(([key, val]) => {
      return (
        typeof key === 'string' &&
        key.length > 0 &&
        key.length < VALIDATION_LIMITS.MAX_ENV_KEY_LENGTH &&
        ENV_KEY_PATTERN.test(key) &&
        val != null
      )
    })
    .map(([key, val]) => [key, String(val)] as const)

  if (entries.length === 0) {
    return undefined
  }

  return Object.fromEntries(entries) as Record<string, string>
}

export const validateOptionalTerm = (value: unknown): string | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  return undefined
}

export const validateOptionalTimeout = (value: unknown): number | undefined => {
  const result = parseIntInRange(value, 0, 3_600_000, 'Timeout')
  return result.ok ? result.value : undefined
}

export const collectOptionalStrings = <Name extends string>(
  obj: Record<string, unknown>,
  fields: ReadonlyArray<FieldDescriptor<Name>>
): Result<Partial<Record<Name, string>>> => {
  const collected: Partial<Record<Name, string>> = {}

  for (const field of fields) {
    const result = validateStringField(obj, field)
    if (!result.ok) {
      return { ok: false, error: result.error }
    }

    if (result.value !== undefined) {
      collected[field.name] = result.value
    }
  }

  return { ok: true, value: collected }
}

export const collectOptionalDimensions = <Name extends DimensionField>(
  obj: Record<string, unknown>,
  fields: ReadonlyArray<DimensionFieldDescriptor<Name>>,
  bounds: { min: number; max: number }
): Result<Partial<Record<Name, number>>> => {
  const collected: Partial<Record<Name, number>> = {}

  for (const field of fields) {
    const result = validateDimension(obj, field, bounds)
    if (!result.ok) {
      return { ok: false, error: result.error }
    }

    if (result.value !== undefined) {
      collected[field.name] = result.value
    }
  }

  return { ok: true, value: collected }
}
