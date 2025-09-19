// tests/exec-schema.test.ts
import test from 'node:test'
import assert from 'node:assert'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { execSchema } from '../app/validators/execSchema.js'

test('execSchema validates minimal valid payload', () => {
  const ajv = new Ajv({ allErrors: true })
  addFormats(ajv)
  const validate = ajv.compile(execSchema)

  assert.strictEqual(validate({ command: 'echo 123' }), true, JSON.stringify(validate.errors))
})

test('execSchema rejects invalid payloads', () => {
  const ajv = new Ajv({ allErrors: true })
  addFormats(ajv)
  const validate = ajv.compile(execSchema)

  assert.strictEqual(validate({}), false) // missing command
  assert.strictEqual(validate({ command: '' }), false) // empty command
  assert.strictEqual(validate({ command: 'ls', cols: 0 }), false) // invalid cols
  assert.strictEqual(validate({ command: 'ls', rows: -1 }), false) // invalid rows
  assert.strictEqual(validate({ command: 'ls', env: { FOO: 1 } }), false) // non-string env
  assert.strictEqual(validate({ command: 'ls', extra: true }), false) // additional properties
})