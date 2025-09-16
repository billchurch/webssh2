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

describe('extractHost', () => {
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

describe('extractPort', () => {
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

describe('extractAuthCredentials', () => {
  it('extracts username and password', () => {
    const result = extractAuthCredentials({
      username: 'user',
      password: 'pass'
    })
    
    expect(result).toEqual({
      username: 'user',
      password: 'pass'
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
      passphrase: 'secret'
    })
    
    expect(result).toEqual({
      privateKey: encryptedKey,
      passphrase: 'secret'
    })
  })
  
  it('omits empty strings', () => {
    const result = extractAuthCredentials({
      username: '',
      password: 'pass',
      privateKey: ''
    })
    
    expect(result).toEqual({
      password: 'pass'
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

describe('buildSshConfig', () => {
  const config = createDefaultConfig()
  
  it('builds complete SSH config', () => {
    const creds = {
      host: 'example.com',
      port: 2222,
      username: 'user',
      password: 'pass'
    }
    
    const result = buildSshConfig(creds, config, true)
    
    expect(result).toMatchObject({
      host: 'example.com',
      port: 2222,
      username: 'user',
      password: 'pass',
      tryKeyboard: true,
      readyTimeout: config.ssh.readyTimeout,
      keepaliveInterval: config.ssh.keepaliveInterval,
      keepaliveCountMax: config.ssh.keepaliveCountMax
    })
  })
  
  it('includes debug function when provided', () => {
    const debugFn = (msg: string) => console.log(msg)
    const result = buildSshConfig({}, config, false, debugFn)
    
    expect(result.debug).toBe(debugFn)
  })
  
  it('uses default port 22 when not provided', () => {
    const result = buildSshConfig({ host: 'example.com' }, config, false)
    
    expect(result.port).toBe(22)
  })
})

describe('createPtyOptions', () => {
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

describe('createExecOptions', () => {
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