import type { Result } from '../../types/result.js'
import { VALIDATION_LIMITS } from '../../constants/index.js'
import type { TerminalConfig } from './types.js'
import {
  ensureRecord,
  validateDimension,
  validateStringField
} from './helpers.js'
import { ROWS_FIELD, COLS_FIELD, TERM_FIELD } from './fields.js'

export const validateTerminalMessage = (data: unknown): Result<TerminalConfig> => {
  const recordResult = ensureRecord(data, 'Terminal data must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<TerminalConfig>
  }

  const config = recordResult.value
  const validated: TerminalConfig = {
    rows: 24,
    cols: 80
  }

  const bounds = {
    min: VALIDATION_LIMITS.MIN_TERMINAL_ROWS,
    max: VALIDATION_LIMITS.MAX_TERMINAL_DIMENSION
  }

  const rowsResult = validateDimension(config, ROWS_FIELD, bounds)
  if (!rowsResult.ok) {
    return rowsResult as Result<TerminalConfig>
  }
  if (rowsResult.value !== undefined) {
    validated.rows = rowsResult.value
  }

  const colsResult = validateDimension(config, COLS_FIELD, bounds)
  if (!colsResult.ok) {
    return colsResult as Result<TerminalConfig>
  }
  if (colsResult.value !== undefined) {
    validated.cols = colsResult.value
  }

  const termResult = validateStringField(config, TERM_FIELD)
  if (!termResult.ok) {
    return termResult as Result<TerminalConfig>
  }
  if (termResult.value != null) {
    validated.term = termResult.value
  }

  return { ok: true, value: validated }
}
