import type { Result } from '../../types/result.js'
import { VALIDATION_LIMITS } from '../../constants/index.js'
import type { TerminalConfig, TerminalSettingsUpdate } from './types.js'
import {
  ensureRecord,
  validateDimension,
  validateStringField
} from './helpers.js'
import { ROWS_FIELD, COLS_FIELD, TERM_FIELD, type DimensionFieldDescriptor } from './fields.js'
import { safeGet } from '../../utils/safe-property-access.js'

interface TerminalDimensionValues {
  rows?: number | undefined
  cols?: number | undefined
}

const DIMENSION_BOUNDS = {
  min: VALIDATION_LIMITS.MIN_TERMINAL_ROWS,
  max: VALIDATION_LIMITS.MAX_TERMINAL_DIMENSION
}

// The client sends 0 when it has not measured the terminal yet; treat that
// as "not provided" so the server-side defaults apply
const isUnsetDimension = (
  config: Record<string, unknown>,
  field: DimensionFieldDescriptor<'rows' | 'cols'>
): boolean => safeGet(config, field.key) === 0

const resolveDimension = (
  config: Record<string, unknown>,
  field: DimensionFieldDescriptor<'rows' | 'cols'>
): Result<number | undefined> => {
  if (isUnsetDimension(config, field)) {
    return { ok: true, value: undefined }
  }
  return validateDimension(config, field, DIMENSION_BOUNDS)
}

const resolveTerminalDimensions = (
  config: Record<string, unknown>
): Result<TerminalDimensionValues> => {
  const rowsResult = resolveDimension(config, ROWS_FIELD)
  if (!rowsResult.ok) {
    return { ok: false, error: rowsResult.error }
  }

  const colsResult = resolveDimension(config, COLS_FIELD)
  if (!colsResult.ok) {
    return { ok: false, error: colsResult.error }
  }

  return {
    ok: true,
    value: {
      rows: rowsResult.value ?? undefined,
      cols: colsResult.value ?? undefined
    }
  }
}

/**
 * Validate the payload of the `terminal` socket event. Only the fields the
 * client actually sent are returned, so session defaults still apply to the rest.
 */
export const validateTerminalSettingsMessage = (
  data: unknown
): Result<TerminalSettingsUpdate> => {
  const recordResult = ensureRecord(data, 'Terminal data must be an object')
  if (!recordResult.ok) {
    return recordResult
  }

  const config = recordResult.value
  const dimensionsResult = resolveTerminalDimensions(config)
  if (!dimensionsResult.ok) {
    return dimensionsResult
  }

  const termResult = validateStringField(config, TERM_FIELD)
  if (!termResult.ok) {
    return termResult
  }

  const { rows, cols } = dimensionsResult.value
  return {
    ok: true,
    value: {
      ...(termResult.value === undefined ? {} : { term: termResult.value }),
      ...(rows === undefined ? {} : { rows }),
      ...(cols === undefined ? {} : { cols })
    }
  }
}

export const validateTerminalMessage = (data: unknown): Result<TerminalConfig> => {
  const settingsResult = validateTerminalSettingsMessage(data)
  if (!settingsResult.ok) {
    return settingsResult
  }

  const settings = settingsResult.value
  const validated: TerminalConfig = {
    rows: settings.rows ?? 24,
    cols: settings.cols ?? 80
  }

  if (settings.term !== undefined) {
    validated.term = settings.term
  }

  return { ok: true, value: validated }
}
