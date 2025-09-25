// tests/routes-helpers.test.ts
import test from 'node:test'
import assert from 'node:assert'
import {
  processHeaderParameters,
  processEnvironmentVariables,
  setupSshCredentials,
  processSessionRecordingParams,
} from '../dist/app/auth/auth-utils.js'
import { TEST_PASSWORDS } from './test-constants.js'

void test('processHeaderParameters sets session overrides from GET-like source', () => {
  const session: { headerOverride?: { text: string; background: string; style: string } } = {}
  processHeaderParameters(
    { header: 'Hello', headerBackground: 'blue', headerStyle: 'color: white' },
    session
  )
  assert.deepStrictEqual(session.headerOverride, {
    text: 'Hello',
    background: 'blue',
    style: 'color: white',
  })
})

void test('processEnvironmentVariables parses env var string into session.envVars', () => {
  const session: { envVars?: Record<string, string> } = {}
  processEnvironmentVariables({ env: 'FOO:bar,BAZ:qux' }, session)
  assert.deepStrictEqual(session.envVars, { FOO: 'bar', BAZ: 'qux' })
})

void test('setupSshCredentials sets and masks credentials', () => {
  const session: {
    usedBasicAuth?: boolean
    sshCredentials?: { host: string; port: number; username: string }
  } = {}
  const sanitized = setupSshCredentials(session, {
    host: 'example.com',
    port: 22,
    username: 'user',
    password: TEST_PASSWORDS.secret,
    term: 'xterm-256color',
  })
  assert.strictEqual(session.usedBasicAuth, true)
  assert.strictEqual(session.sshCredentials.host, 'example.com')
  assert.strictEqual(session.sshCredentials.port, 22)
  assert.strictEqual(session.sshCredentials.username, 'user')
  // sanitized should not expose raw password value
  assert.notStrictEqual(JSON.stringify(sanitized).includes(TEST_PASSWORDS.secret), true)
})

void test('processSessionRecordingParams toggles replay and sets extras', () => {
  const session: {
    allowReplay?: boolean
    mrhSession?: string
    readyTimeout?: number
  } = {}
  processSessionRecordingParams(
    { allowreplay: 'true', mrhsession: 'abc', readyTimeout: '3000' },
    session
  )
  assert.strictEqual(session.allowReplay, true)
  assert.strictEqual(session.mrhSession, 'abc')
  assert.strictEqual(session.readyTimeout, 3000)
})