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

type ExecDimensions = Partial<Record<'cols' | 'rows', number>>

const validateCommand = (exec: Record<string, unknown>): Result<string> => {
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

  return { ok: true, value: command }
}

const resolveDimensions = (
  exec: Record<string, unknown>
): Result<ExecDimensions> => {
  const dimensionResult = collectOptionalDimensions(
    exec,
    EXEC_DIMENSION_FIELDS,
    {
      min: VALIDATION_LIMITS.MIN_TERMINAL_ROWS,
      max: VALIDATION_LIMITS.MAX_TERMINAL_DIMENSION
    }
  )

  if (!dimensionResult.ok) {
    return { ok: false, error: dimensionResult.error }
  }

  return { ok: true, value: dimensionResult.value }
}

export const validateExecMessage = (data: unknown): Result<ExecCommand> => {
  const recordResult = ensureRecord(data, 'Exec data must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<ExecCommand>
  }

  const exec = recordResult.value

  const commandResult = validateCommand(exec)
  if (!commandResult.ok) {
    return commandResult as Result<ExecCommand>
  }

  const dimensionsResult = resolveDimensions(exec)
  if (!dimensionsResult.ok) {
    return dimensionsResult as Result<ExecCommand>
  }

  const ptySource = safeGet(exec, PTY_FIELD.key)
  const ptyValue = ptySource === null || ptySource === undefined ? undefined : Boolean(ptySource)
  const termValue = validateOptionalTerm(safeGet(exec, TERM_FIELD.key))
  const envValue = validateEnvironmentVars(safeGet(exec, ENV_FIELD.key))
  const timeoutValue = validateOptionalTimeout(safeGet(exec, TIMEOUT_FIELD.key))
  const { cols, rows } = dimensionsResult.value

  const validated: ExecCommand = {
    command: commandResult.value,
    ...(ptyValue === undefined ? {} : { pty: ptyValue }),
    ...(termValue === undefined ? {} : { term: termValue }),
    ...(cols === undefined ? {} : { cols }),
    ...(rows === undefined ? {} : { rows }),
    ...(envValue === undefined ? {} : { env: envValue }),
    ...(timeoutValue === undefined ? {} : { timeoutMs: timeoutValue })
  }

  return { ok: true, value: validated }
}
