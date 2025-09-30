import { createSafeKey, type SafeKey } from '../../utils/safe-property-access.js'

export interface FieldDescriptor<Name extends string> {
  readonly key: SafeKey
  readonly name: Name
}

export interface DimensionFieldDescriptor<Name extends string> extends FieldDescriptor<Name> {
  readonly label: string
}

const createFieldDescriptor = <Name extends string>(name: Name): FieldDescriptor<Name> => ({
  key: createSafeKey(name),
  name
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

export const USERNAME_FIELD = createFieldDescriptor('username')
export const HOST_FIELD = createFieldDescriptor('host')
export const PORT_FIELD = createFieldDescriptor('port')
export const PASSWORD_FIELD = createFieldDescriptor('password')
export const PRIVATE_KEY_FIELD = createFieldDescriptor('privateKey')
export const PASSPHRASE_FIELD = createFieldDescriptor('passphrase')
export const TERM_FIELD = createFieldDescriptor('term')
export const PTY_FIELD = createFieldDescriptor('pty')
export const ENV_FIELD = createFieldDescriptor('env')
export const TIMEOUT_FIELD = createFieldDescriptor('timeoutMs')
export const ACTION_FIELD = createFieldDescriptor('action')

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

export const VALID_CONTROL_ACTIONS = new Set<string>([
  'reauth',
  'clear-credentials',
  'disconnect'
])
