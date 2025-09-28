// tests/routes-helpers.test.ts
import { it, expect } from 'vitest'
import {
  processHeaderParameters,
  processEnvironmentVariables,
  setupSshCredentials,
  processSessionRecordingParams,
} from '../dist/app/auth/auth-utils.js'
import { TEST_PASSWORDS } from './test-constants.js'

it('processHeaderParameters sets session overrides from GET-like source', () => {
  const session: { headerOverride?: { text: string; background: string; style: string } } = {}
  processHeaderParameters(
    { header: 'Hello', headerBackground: 'blue', headerStyle: 'color: white' },
    session
  )
  expect(session.headerOverride).toEqual({
    text: 'Hello',
    background: 'blue',
    style: 'color: white',
  })
})

it('processEnvironmentVariables parses env var string into session.envVars', () => {
  const session: { envVars?: Record<string, string> } = {}
  processEnvironmentVariables({ env: 'FOO:bar,BAZ:qux' }, session)
  expect(session.envVars).toEqual({ FOO: 'bar', BAZ: 'qux' })
})

it('setupSshCredentials sets and masks credentials', () => {
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
  expect(session.usedBasicAuth).toBe(true)
  expect(session.sshCredentials.host).toBe('example.com')
  expect(session.sshCredentials.port).toBe(22)
  expect(session.sshCredentials.username).toBe('user')
  // sanitized should not expose raw password value
  expect(JSON.stringify(sanitized).includes(TEST_PASSWORDS.secret)).toBe(false)
})

it('processSessionRecordingParams toggles replay and sets extras', () => {
  const session: {
    allowReplay?: boolean
    mrhSession?: string
    readyTimeout?: number
  } = {}
  processSessionRecordingParams(
    { allowreplay: 'true', mrhsession: 'abc', readyTimeout: '3000' },
    session
  )
  expect(session.allowReplay).toBe(true)
  expect(session.mrhSession).toBe('abc')
  expect(session.readyTimeout).toBe(3000)
})