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

interface RequiredAuthFields {
  username: string
  host: string
}

const validateRequiredAuthFields = (
  creds: Record<string, unknown>
): Result<RequiredAuthFields> => {
  const usernameResult = validateStringField(creds, USERNAME_FIELD, {
    required: true,
    errorMessage: 'Username is required and must be a non-empty string',
    trim: true
  })
  if (!usernameResult.ok) {
    return { ok: false, error: usernameResult.error }
  }

  const hostResult = validateStringField(creds, HOST_FIELD, {
    required: true,
    errorMessage: 'Host is required and must be a non-empty string',
    trim: true
  })
  if (!hostResult.ok) {
    return { ok: false, error: hostResult.error }
  }

  return {
    ok: true,
    value: {
      username: usernameResult.value as string,
      host: hostResult.value as string
    }
  }
}

const resolveAuthPort = (creds: Record<string, unknown>): Result<number> => {
  const portSource = safeGet(creds, PORT_FIELD.key)
  if (portSource == null) {
    return { ok: true, value: 22 }
  }

  return validatePort(portSource)
}

const buildAuthCredentials = (
  required: RequiredAuthFields,
  port: number,
  optionalStrings: Partial<Record<'password' | 'privateKey' | 'passphrase' | 'term', string>>,
  optionalDimensions: Partial<Record<'cols' | 'rows', number>>
): AuthCredentials => {
  const credentials: AuthCredentials = {
    username: required.username,
    host: required.host,
    port
  }

  if (optionalStrings.password !== undefined) {
    credentials.password = optionalStrings.password
  }
  if (optionalStrings.privateKey !== undefined) {
    credentials.privateKey = optionalStrings.privateKey
  }
  if (optionalStrings.passphrase !== undefined) {
    credentials.passphrase = optionalStrings.passphrase
  }
  if (optionalStrings.term !== undefined) {
    credentials.term = optionalStrings.term
  }

  if (optionalDimensions.cols !== undefined) {
    credentials.cols = optionalDimensions.cols
  }
  if (optionalDimensions.rows !== undefined) {
    credentials.rows = optionalDimensions.rows
  }

  return credentials
}

export const validateAuthMessage = (data: unknown): Result<AuthCredentials> => {
  const recordResult = ensureRecord(data, 'Authentication data must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<AuthCredentials>
  }

  const creds = recordResult.value

  const requiredResult = validateRequiredAuthFields(creds)
  if (!requiredResult.ok) {
    return requiredResult as Result<AuthCredentials>
  }

  const portResult = resolveAuthPort(creds)
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

  const credentials = buildAuthCredentials(
    requiredResult.value,
    portResult.value,
    optionalStringsResult.value,
    optionalDimensionsResult.value
  )

  return { ok: true, value: credentials }
}
