import { createSafeKey, type SafeKey } from '../../utils/safe-property-access.js'
import { VALIDATION_LIMITS } from '../../constants/validation.js'

export interface FieldDescriptor<Name extends string> {
  readonly key: SafeKey
  readonly name: Name
  /** Upper bound on string length; undefined means the field is not a bounded string */
  readonly maxLength?: number
}

export interface DimensionFieldDescriptor<Name extends string> extends FieldDescriptor<Name> {
  readonly label: string
}

const createFieldDescriptor = <Name extends string>(
  name: Name,
  maxLength?: number
): FieldDescriptor<Name> => ({
  key: createSafeKey(name),
  name,
  ...(maxLength === undefined ? {} : { maxLength })
})

const createDimensionFieldDescriptor = <Name extends string>(
  name: Name,
  label: string
): DimensionFieldDescriptor<Name> => ({
  ...createFieldDescriptor(name),
  label
})

export type AuthOptionalStringField = 'password' | 'privateKey' | 'passphrase' | 'term'
export type DimensionField = 'cols' | 'rows'

export const USERNAME_FIELD = createFieldDescriptor('username', VALIDATION_LIMITS.MAX_USERNAME_LENGTH)
export const HOST_FIELD = createFieldDescriptor('host', VALIDATION_LIMITS.MAX_HOSTNAME_LENGTH)
export const PORT_FIELD = createFieldDescriptor('port')
export const PASSWORD_FIELD = createFieldDescriptor('password', VALIDATION_LIMITS.MAX_PASSWORD_LENGTH)
export const PRIVATE_KEY_FIELD = createFieldDescriptor(
  'privateKey',
  VALIDATION_LIMITS.MAX_PRIVATE_KEY_LENGTH
)
export const PASSPHRASE_FIELD = createFieldDescriptor(
  'passphrase',
  VALIDATION_LIMITS.MAX_PASSPHRASE_LENGTH
)
export const TERM_FIELD = createFieldDescriptor('term', VALIDATION_LIMITS.MAX_TERMINAL_TYPE_LENGTH)
export const FORWARD_ALL_PROMPTS_FIELD = createFieldDescriptor('forwardAllKeyboardInteractivePrompts')
export const RESPONSES_FIELD = createFieldDescriptor('responses')
export const PTY_FIELD = createFieldDescriptor('pty')
export const ENV_FIELD = createFieldDescriptor('env')
export const TIMEOUT_FIELD = createFieldDescriptor('timeoutMs')

export const COLS_FIELD = createDimensionFieldDescriptor('cols', 'Columns')
export const ROWS_FIELD = createDimensionFieldDescriptor('rows', 'Rows')

export const AUTH_OPTIONAL_FIELDS: ReadonlyArray<FieldDescriptor<AuthOptionalStringField>> = [
  PASSWORD_FIELD,
  PRIVATE_KEY_FIELD,
  PASSPHRASE_FIELD,
  TERM_FIELD
]

export const AUTH_DIMENSION_FIELDS: ReadonlyArray<DimensionFieldDescriptor<DimensionField>> = [
  COLS_FIELD,
  ROWS_FIELD
]

export const EXEC_DIMENSION_FIELDS: ReadonlyArray<DimensionFieldDescriptor<DimensionField>> = [
  COLS_FIELD,
  ROWS_FIELD
]

export const ENV_KEY_PATTERN = /^[A-Za-z_]\w*$/

// Control messages are bare strings on the wire, matching the client and the
// ServiceSocketControl switch
export const VALID_CONTROL_ACTIONS = ['replayCredentials', 'reauth'] as const
export type ControlAction = typeof VALID_CONTROL_ACTIONS[number]
