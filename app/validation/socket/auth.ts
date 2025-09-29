import type { Result } from '../../types/result.js'
import { VALIDATION_LIMITS } from '../../constants/index.js'
import type { AuthCredentials } from './types.js'
import {
  ensureRecord,
  validateStringField,
  validatePort,
  collectOptionalStrings,
  collectOptionalDimensions
} from './helpers.js'
import { safeGet } from '../../utils/safe-property-access.js'
import {
  USERNAME_FIELD,
  HOST_FIELD,
  PORT_FIELD,
  AUTH_OPTIONAL_FIELDS,
  AUTH_DIMENSION_FIELDS
} from './fields.js'

export const validateAuthMessage = (data: unknown): Result<AuthCredentials> => {
  const recordResult = ensureRecord(data, 'Authentication data must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<AuthCredentials>
  }

  const creds = recordResult.value

  const usernameResult = validateStringField(creds, USERNAME_FIELD, {
    required: true,
    errorMessage: 'Username is required and must be a non-empty string',
    trim: true
  })
  if (!usernameResult.ok) {
    return usernameResult as Result<AuthCredentials>
  }

  const hostResult = validateStringField(creds, HOST_FIELD, {
    required: true,
    errorMessage: 'Host is required and must be a non-empty string',
    trim: true
  })
  if (!hostResult.ok) {
    return hostResult as Result<AuthCredentials>
  }

  const portSource = safeGet(creds, PORT_FIELD.key)
  const portResult = portSource == null
    ? ({ ok: true, value: 22 } as Result<number>)
    : validatePort(portSource)
  if (!portResult.ok) {
    return portResult as Result<AuthCredentials>
  }

  const optionalStringsResult = collectOptionalStrings(creds, AUTH_OPTIONAL_FIELDS)
  if (!optionalStringsResult.ok) {
    return optionalStringsResult as Result<AuthCredentials>
  }

  const optionalDimensionsResult = collectOptionalDimensions(
    creds,
    AUTH_DIMENSION_FIELDS,
    {
      min: VALIDATION_LIMITS.MIN_TERMINAL_ROWS,
      max: VALIDATION_LIMITS.MAX_TERMINAL_DIMENSION
    }
  )
  if (!optionalDimensionsResult.ok) {
    return optionalDimensionsResult as Result<AuthCredentials>
  }

  const validated: AuthCredentials = {
    username: usernameResult.value as string,
    host: hostResult.value as string,
    port: portResult.value
  }

  const optionalStrings = optionalStringsResult.value
  if (optionalStrings.password !== undefined) {
    validated.password = optionalStrings.password
  }
  if (optionalStrings.privateKey !== undefined) {
    validated.privateKey = optionalStrings.privateKey
  }
  if (optionalStrings.passphrase !== undefined) {
    validated.passphrase = optionalStrings.passphrase
  }
  if (optionalStrings.term !== undefined) {
    validated.term = optionalStrings.term
  }

  const optionalDimensions = optionalDimensionsResult.value
  if (optionalDimensions.cols !== undefined) {
    validated.cols = optionalDimensions.cols
  }
  if (optionalDimensions.rows !== undefined) {
    validated.rows = optionalDimensions.rows
  }

  return { ok: true, value: validated }
}
