import test from 'node:test'
import assert from 'node:assert/strict'
import { WebSSH2Error, ConfigError, SSHConnectionError, handleError } from '../dist/app/errors.js'
import { logError } from '../dist/app/logger.js'
import { HTTP, MESSAGES } from '../dist/app/constants.js'

// Mock logger
const mockLogError = () => {}

test('errors', async (t) => {
  t.beforeEach(() => {
    // Reset mocks between tests
  })

  await t.test('WebSSH2Error', async (t) => {
    await t.test('should create WebSSH2Error with correct properties', () => {
      const error = new WebSSH2Error('Test error', 'TEST_CODE')
      assert.ok(error instanceof Error)
      assert.equal(error.name, 'WebSSH2Error')
      assert.equal(error.message, 'Test error')
      assert.equal(error.code, 'TEST_CODE')
    })
  })

  await t.test('ConfigError', async (t) => {
    await t.test('should create ConfigError with correct properties', () => {
      const error = new ConfigError('Config error')
      assert.ok(error instanceof WebSSH2Error)
      assert.equal(error.name, 'ConfigError')
      assert.equal(error.message, 'Config error')
      assert.equal(error.code, MESSAGES.CONFIG_ERROR)
    })
  })

  await t.test('SSHConnectionError', async (t) => {
    await t.test('should create SSHConnectionError with correct properties', () => {
      const error = new SSHConnectionError('SSH connection error')
      assert.ok(error instanceof WebSSH2Error)
      assert.equal(error.name, 'SSHConnectionError')
      assert.equal(error.message, 'SSH connection error')
      assert.equal(error.code, MESSAGES.SSH_CONNECTION_ERROR)
    })
  })

  await t.test('handleError', async (t) => {
    let responseData
    const mockRes = {
      status: function(code) { 
        this.statusCode = code
        return this
      },
      json: function(data) { 
        responseData = data
        return this
      }
    }

    await t.test('should handle WebSSH2Error correctly', () => {
      const error = new WebSSH2Error('Test error', 'TEST_CODE')
      handleError(error, mockRes)
      assert.deepEqual(responseData, {
        error: 'Test error',
        code: 'TEST_CODE'
      })
    })

    await t.test('should handle generic Error correctly', () => {
      const error = new Error('Generic error')
      handleError(error, mockRes)
      assert.deepEqual(responseData, {
        error: MESSAGES.UNEXPECTED_ERROR
      })
    })

    await t.test('should not send response if res is not provided', () => {
      const error = new Error('No response error')
      const result = handleError(error)
      assert.equal(result, undefined)
    })
  })
})
