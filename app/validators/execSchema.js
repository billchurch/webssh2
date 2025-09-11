// server
// app/validators/execSchema.js
// JSON Schema for Socket.IO exec payloads, validated with AJV
// @ts-check

/** @type {import('ajv').JSONSchemaType<any>} */
export const execSchema = {
  type: 'object',
  properties: {
    command: { type: 'string', minLength: 1 },
    pty: { type: 'boolean', nullable: true },
    term: { type: 'string', nullable: true },
    cols: { type: 'integer', minimum: 1, nullable: true },
    rows: { type: 'integer', minimum: 1, nullable: true },
    env: {
      type: 'object',
      nullable: true,
      additionalProperties: { type: 'string' },
    },
    timeoutMs: { type: 'integer', minimum: 1, nullable: true },
  },
  required: ['command'],
  additionalProperties: false,
}
