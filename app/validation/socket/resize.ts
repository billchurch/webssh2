import type { Result } from '../../types/result.js'
import type { ResizeParams } from './types.js'
import { ensureRecord, parseIntInRange } from './helpers.js'
import { ROWS_FIELD, COLS_FIELD } from './fields.js'
import { TERMINAL_LIMITS } from '../../constants.js'
import { safeGet } from '../../utils/safe-property-access.js'

export const validateResizeMessage = (data: unknown): Result<ResizeParams> => {
  const recordResult = ensureRecord(data, 'Resize data must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<ResizeParams>
  }

  const size = recordResult.value
  const rowsSource = safeGet(size, ROWS_FIELD.key)
  const colsSource = safeGet(size, COLS_FIELD.key)

  if (rowsSource == null || colsSource == null) {
    return {
      ok: false,
      error: new Error('Both rows and cols are required for resize')
    }
  }

  const rowsResult = parseIntInRange(
    rowsSource,
    TERMINAL_LIMITS.MIN_ROWS,
    TERMINAL_LIMITS.MAX_ROWS,
    ROWS_FIELD.label
  )
  if (!rowsResult.ok) {
    return rowsResult as Result<ResizeParams>
  }

  const colsResult = parseIntInRange(
    colsSource,
    TERMINAL_LIMITS.MIN_COLS,
    TERMINAL_LIMITS.MAX_COLS,
    COLS_FIELD.label
  )
  if (!colsResult.ok) {
    return colsResult as Result<ResizeParams>
  }

  return {
    ok: true,
    value: {
      rows: rowsResult.value,
      cols: colsResult.value
    }
  }
}
