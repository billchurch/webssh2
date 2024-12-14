import test from 'node:test'
import assert from 'node:assert/strict'
import { generateSecureSecret } from '../app/crypto-utils.js'

test('generateSecureSecret', async (t) => {
  await t.test('should generate a 64-character hex string', () => {
    const secret = generateSecureSecret()
    assert.match(secret, /^[0-9a-f]{64}$/)
  })
})
