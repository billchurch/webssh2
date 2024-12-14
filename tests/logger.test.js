import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createNamespacedDebug, logError } from '../app/logger.js'

test('createNamespacedDebug creates debug function with correct namespace', (t) => {
  const debug = createNamespacedDebug('test')
  assert.equal(typeof debug, 'function')
  assert.equal(debug.namespace, 'webssh2:test')
})

test('logError logs error message without error object', (t) => {
  const consoleMock = mock.method(console, 'error')

  logError('test message')

  assert.equal(consoleMock.mock.calls.length, 1)
  assert.deepEqual(consoleMock.mock.calls[0].arguments, ['test message'])

  consoleMock.mock.restore()
})

test('logError logs error message with error object', (t) => {
  const consoleMock = mock.method(console, 'error')
  const testError = new Error('test error')

  logError('test message', testError)

  assert.equal(consoleMock.mock.calls.length, 2)
  assert.deepEqual(consoleMock.mock.calls[0].arguments, ['test message'])
  assert.deepEqual(consoleMock.mock.calls[1].arguments, [`ERROR: ${testError}`])

  consoleMock.mock.restore()
})
