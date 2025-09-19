// app/validators/execSchema.ts
// JSON Schema for exec command validation

import type { JSONSchemaType } from 'ajv'

export interface ExecPayload {
  command: string
  pty?: boolean
  term?: string
  cols?: number
  rows?: number
  env?: Record<string, string>
  timeoutMs?: number
}

/**
 * JSON Schema for exec payload validation
 * Used with AJV for strict runtime validation
 */
export const execSchema: JSONSchemaType<ExecPayload> = {
  type: 'object',
  properties: {
    command: {
      type: 'string',
      minLength: 1
    },
    pty: {
      type: 'boolean',
      nullable: true
    },
    term: {
      type: 'string',
      nullable: true
    },
    cols: {
      type: 'integer',
      minimum: 1,
      maximum: 9999,
      nullable: true
    },
    rows: {
      type: 'integer',
      minimum: 1,
      maximum: 9999,
      nullable: true
    },
    env: {
      type: 'object',
      additionalProperties: {
        type: 'string'
      },
      required: [],
      nullable: true
    },
    timeoutMs: {
      type: 'integer',
      minimum: 0,
      maximum: 3600000, // Max 1 hour
      nullable: true
    }
  },
  required: ['command'],
  additionalProperties: false
}