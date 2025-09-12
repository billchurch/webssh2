// TypeScript mirror for exec payload validation schema
// Delegates runtime to JS implementation via impl shim

import * as Impl from './execSchema.impl.js'

export interface ExecPayload {
  command: string
  pty?: boolean
  term?: string
  cols?: number
  rows?: number
  env?: Record<string, string>
  timeoutMs?: number
}

export type JSONSchema = {
  type: 'object'
  properties: Record<string, unknown>
  required: string[]
  additionalProperties: boolean
}

export const execSchema: JSONSchema = Impl.execSchema as unknown as JSONSchema
