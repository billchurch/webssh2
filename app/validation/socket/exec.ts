import type { Result } from '../../types/result.js'
import { VALIDATION_LIMITS } from '../../constants/index.js'
import type { ExecCommand } from './types.js'
import {
  ensureRecord,
  collectOptionalDimensions,
  validateEnvironmentVars,
  validateOptionalTerm,
  validateOptionalTimeout
} from './helpers.js'
import {
  PTY_FIELD,
  TERM_FIELD,
  EXEC_DIMENSION_FIELDS,
  ENV_FIELD,
  TIMEOUT_FIELD
} from './fields.js'
import { createSafeKey, safeGet } from '../../utils/safe-property-access.js'

const COMMAND_KEY = createSafeKey('command')
const COMMAND_ERROR_MESSAGE = 'Command is required and must be a non-empty string'

export const validateExecMessage = (data: unknown): Result<ExecCommand> => {
  const recordResult = ensureRecord(data, 'Exec data must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<ExecCommand>
  }

  const exec = recordResult.value
  const commandSource = safeGet(exec, COMMAND_KEY)
  if (typeof commandSource !== 'string') {
    return {
      ok: false,
      error: new Error(COMMAND_ERROR_MESSAGE)
    }
  }

  const command = commandSource.trim()
  if (command === '') {
    return {
      ok: false,
      error: new Error(COMMAND_ERROR_MESSAGE)
    }
  }

  const validated: ExecCommand = { command }

  const ptySource = safeGet(exec, PTY_FIELD.key)
  if (ptySource != null) {
    validated.pty = Boolean(ptySource)
  }

  const termValue = validateOptionalTerm(safeGet(exec, TERM_FIELD.key))
  if (termValue != null) {
    validated.term = termValue
  }

  const dimensionResult = collectOptionalDimensions(
    exec,
    EXEC_DIMENSION_FIELDS,
    {
      min: VALIDATION_LIMITS.MIN_TERMINAL_ROWS,
      max: VALIDATION_LIMITS.MAX_TERMINAL_DIMENSION
    }
  )
  if (!dimensionResult.ok) {
    return dimensionResult as Result<ExecCommand>
  }

  const dimensions = dimensionResult.value
  if (dimensions.cols !== undefined) {
    validated.cols = dimensions.cols
  }
  if (dimensions.rows !== undefined) {
    validated.rows = dimensions.rows
  }

  const envValue = validateEnvironmentVars(safeGet(exec, ENV_FIELD.key))
  if (envValue != null) {
    validated.env = envValue
  }

  const timeoutValue = validateOptionalTimeout(safeGet(exec, TIMEOUT_FIELD.key))
  if (timeoutValue != null) {
    validated.timeoutMs = timeoutValue
  }

  return { ok: true, value: validated }
}
