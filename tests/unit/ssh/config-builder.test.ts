// tests/unit/ssh/config-builder.test.ts

import { describe, it, expect } from 'vitest'
import {
  extractHost,
  extractPort,
  extractAuthCredentials,
  buildSshConfig,
  createPtyOptions,
  createExecOptions
} from '../../../app/ssh/config-builder.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'
import { TEST_PASSWORDS, TEST_PASSPHRASE } from '../../test-constants.js'

void describe('extractHost', () => {
  it('extracts string host', () => {
    expect(extractHost({ host: 'example.com' })).toBe('example.com')
  })
  
  it('converts number host to string', () => {
    expect(extractHost({ host: 192168001001 })).toBe('192168001001')
  })
  
  it('returns empty string for null/undefined', () => {
    expect(extractHost({})).toBe('')
    expect(extractHost({ host: null })).toBe('')
    expect(extractHost({ host: undefined })).toBe('')
  })
  
  it('returns empty string for non-string/number types', () => {
    expect(extractHost({ host: {} })).toBe('')
    expect(extractHost({ host: [] })).toBe('')
    expect(extractHost({ host: true })).toBe('')
  })
})

void describe('extractPort', () => {
  it('extracts number port', () => {
    expect(extractPort({ port: 2222 })).toBe(2222)
  })
  
  it('parses string port', () => {
    expect(extractPort({ port: '3333' })).toBe(3333)
  })
  
  it('returns 22 for invalid or missing port', () => {
    expect(extractPort({})).toBe(22)
    expect(extractPort({ port: null })).toBe(22)
    expect(extractPort({ port: 'invalid' })).toBe(22)
    expect(extractPort({ port: {} })).toBe(22)
  })
})

void describe('extractAuthCredentials', () => {
  it('extracts username and password', () => {
    const result = extractAuthCredentials({
      username: 'user',
      password: TEST_PASSWORDS.basic
    })
    
    expect(result).toEqual({
      username: 'user',
      password: TEST_PASSWORDS.basic
    })
  })
  
  it('extracts valid private key', () => {
    const validKey = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----'
    const result = extractAuthCredentials({
      privateKey: validKey
    })
    
    expect(result).toEqual({
      privateKey: validKey
    })
  })
  
  it('includes passphrase for encrypted keys', () => {
    const encryptedKey = `-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
DEK-Info: AES-256-CBC,test

encrypted content
-----END RSA PRIVATE KEY-----`
    
    const result = extractAuthCredentials({
      privateKey: encryptedKey,
      passphrase: TEST_PASSPHRASE
    })
    
    expect(result).toEqual({
      privateKey: encryptedKey,
      passphrase: TEST_PASSPHRASE
    })
  })
  
  it('omits empty strings', () => {
    const result = extractAuthCredentials({
      username: '',
      password: TEST_PASSWORDS.basic,
      privateKey: ''
    })
    
    expect(result).toEqual({
      password: TEST_PASSWORDS.basic
    })
  })
  
  it('omits non-string values', () => {
    const result = extractAuthCredentials({
      username: 123,
      password: null,
      privateKey: undefined
    })
    
    expect(result).toEqual({})
  })
})

void describe('buildSshConfig', () => {
  const config = createDefaultConfig()
  
  it('builds complete SSH config', () => {
    const creds = {
      host: 'example.com',
      port: 2222,
      username: 'user',
      password: TEST_PASSWORDS.basic
    }
    
    const result = buildSshConfig(creds, config, true)
    
    expect(result).toMatchObject({
      host: 'example.com',
      port: 2222,
      username: 'user',
      password: TEST_PASSWORDS.basic,
      tryKeyboard: true,
      readyTimeout: config.ssh.readyTimeout,
      keepaliveInterval: config.ssh.keepaliveInterval,
      keepaliveCountMax: config.ssh.keepaliveCountMax
    })
  })
  
  it('includes debug function when provided', () => {
    const debugFn = (msg: string): void => { console.info(msg) }
    const result = buildSshConfig({}, config, false, debugFn)
    
    expect(result.debug).toBe(debugFn)
  })
  
  it('uses default port 22 when not provided', () => {
    const result = buildSshConfig({ host: 'example.com' }, config, false)
    
    expect(result.port).toBe(22)
  })
})

void describe('createPtyOptions', () => {
  it('creates PTY options with all fields', () => {
    const options = {
      term: 'xterm',
      rows: 24,
      cols: 80,
      width: 640,
      height: 480
    }
    
    const result = createPtyOptions(options)
    
    expect(result).toEqual({
      term: 'xterm',
      rows: 24,
      cols: 80,
      width: 640,
      height: 480
    })
  })
  
  it('omits null/undefined fields', () => {
    const options = {
      term: 'xterm',
      rows: undefined,
      cols: 80
    }
    
    const result = createPtyOptions(options)
    
    expect(result).toEqual({
      term: 'xterm',
      cols: 80
    })
  })
  
  it('handles null term', () => {
    const result = createPtyOptions({ term: null })
    
    expect(result).toEqual({})
  })
})

void describe('createExecOptions', () => {
  it('creates options with environment', () => {
    const envVars = { FOO: 'bar', BAZ: 'qux' }
    
    const result = createExecOptions(undefined, envVars)
    
    expect(result).toEqual({
      env: { FOO: 'bar', BAZ: 'qux' }
    })
  })
  
  it('creates options with PTY', () => {
    const ptyOptions = { term: 'xterm', rows: 24, cols: 80 }
    
    const result = createExecOptions(ptyOptions)
    
    expect(result).toEqual({
      pty: { term: 'xterm', rows: 24, cols: 80 }
    })
  })
  
  it('combines PTY and environment', () => {
    const ptyOptions = { term: 'xterm' }
    const envVars = { FOO: 'bar' }
    
    const result = createExecOptions(ptyOptions, envVars)
    
    expect(result).toEqual({
      env: { FOO: 'bar' },
      pty: { term: 'xterm' }
    })
  })
  
  it('returns empty object when no options', () => {
    const result = createExecOptions()
    
    expect(result).toEqual({})
  })
  
  it('omits empty environment object', () => {
    const result = createExecOptions(undefined, {})
    
    expect(result).toEqual({})
  })
})