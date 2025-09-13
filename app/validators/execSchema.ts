export interface ExecPayload {
  command: string
  pty?: boolean
  term?: string
  cols?: number
  rows?: number
  env?: Record<string, string>
  timeoutMs?: number
}

export interface JSONSchema {
  type: 'object'
  properties: Record<string, unknown>
  required: string[]
  additionalProperties: boolean
}

export const execSchema: JSONSchema = {
  type: 'object',
  properties: {
    command: { type: 'string', minLength: 1 },
    pty: { type: 'boolean' },
    term: { type: 'string' },
    cols: { type: 'integer', minimum: 1 },
    rows: { type: 'integer', minimum: 1 },
    env: { type: 'object', additionalProperties: { type: 'string' } },
    timeoutMs: { type: 'integer', minimum: 1 },
  },
  required: ['command'],
  additionalProperties: false,
}
