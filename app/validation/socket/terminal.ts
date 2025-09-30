import type { Result } from '../../types/result.js'
import { VALIDATION_LIMITS } from '../../constants/index.js'
import type { TerminalConfig } from './types.js'
import {
  ensureRecord,
  validateDimension,
  validateStringField
} from './helpers.js'
import { ROWS_FIELD, COLS_FIELD, TERM_FIELD } from './fields.js'

interface TerminalDimensionValues {
  rows?: number | undefined
  cols?: number | undefined
}

const resolveTerminalDimensions = (
  config: Record<string, unknown>
): Result<TerminalDimensionValues> => {
  const bounds = {
    min: VALIDATION_LIMITS.MIN_TERMINAL_ROWS,
    max: VALIDATION_LIMITS.MAX_TERMINAL_DIMENSION
  }

  const rowsResult = validateDimension(config, ROWS_FIELD, bounds)
  if (!rowsResult.ok) {
    return { ok: false, error: rowsResult.error }
  }

  const colsResult = validateDimension(config, COLS_FIELD, bounds)
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

export const validateTerminalMessage = (data: unknown): Result<TerminalConfig> => {
  const recordResult = ensureRecord(data, 'Terminal data must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<TerminalConfig>
  }

  const config = recordResult.value
  const dimensionsResult = resolveTerminalDimensions(config)
  if (!dimensionsResult.ok) {
    return dimensionsResult as Result<TerminalConfig>
  }

  const termResult = validateStringField(config, TERM_FIELD)
  if (!termResult.ok) {
    return termResult as Result<TerminalConfig>
  }

  const validated: TerminalConfig = {
    rows: dimensionsResult.value.rows ?? 24,
    cols: dimensionsResult.value.cols ?? 80
  }

  if (termResult.value != null) {
    validated.term = termResult.value
  }

  return { ok: true, value: validated }
}
