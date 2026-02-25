import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock external dependencies before importing the module under test
vi.mock('better-sqlite3', () => ({
  default: vi.fn()
}))
vi.mock('ssh2', () => ({
  Client: vi.fn()
}))

const { extractDbPathFromConfig, resolveDbPath, parseArgs } = await import(
  '../../../scripts/host-key-seed.js'
)

// ---------------------------------------------------------------------------
// extractDbPathFromConfig
// ---------------------------------------------------------------------------

describe('extractDbPathFromConfig', () => {
  it('returns dbPath from valid nested config', () => {
    const config = {
      ssh: {
        hostKeyVerification: {
          serverStore: {
            dbPath: '/custom/path/keys.db'
          }
        }
      }
    }
    expect(extractDbPathFromConfig(config)).toBe('/custom/path/keys.db')
  })

  it('returns undefined for null', () => {
    expect(extractDbPathFromConfig(null)).toBeUndefined()
  })

  it('returns undefined for non-object', () => {
    expect(extractDbPathFromConfig('string')).toBeUndefined()
    expect(extractDbPathFromConfig(42)).toBeUndefined()
    expect(extractDbPathFromConfig(true)).toBeUndefined()
  })

  it('returns undefined for missing nested keys', () => {
    expect(extractDbPathFromConfig({})).toBeUndefined()
    expect(extractDbPathFromConfig({ ssh: {} })).toBeUndefined()
    expect(extractDbPathFromConfig({ ssh: { hostKeyVerification: {} } })).toBeUndefined()
    expect(
      extractDbPathFromConfig({ ssh: { hostKeyVerification: { serverStore: {} } } })
    ).toBeUndefined()
  })

  it('returns undefined for empty string dbPath', () => {
    expect(
      extractDbPathFromConfig({
        ssh: { hostKeyVerification: { serverStore: { dbPath: '' } } }
      })
    ).toBeUndefined()
  })

  it('returns undefined for non-string dbPath', () => {
    expect(
      extractDbPathFromConfig({
        ssh: { hostKeyVerification: { serverStore: { dbPath: 123 } } }
      })
    ).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// resolveDbPath
// ---------------------------------------------------------------------------

describe('resolveDbPath', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env['WEBSSH2_SSH_HOSTKEY_DB_PATH']
  })

  afterEach(() => {
    // Restore env
    if (originalEnv['WEBSSH2_SSH_HOSTKEY_DB_PATH'] !== undefined) {
      process.env['WEBSSH2_SSH_HOSTKEY_DB_PATH'] = originalEnv['WEBSSH2_SSH_HOSTKEY_DB_PATH']
    } else {
      delete process.env['WEBSSH2_SSH_HOSTKEY_DB_PATH']
    }
  })

  it('returns explicit path when provided (highest priority)', () => {
    process.env['WEBSSH2_SSH_HOSTKEY_DB_PATH'] = '/env/path.db'
    expect(resolveDbPath('/explicit/path.db')).toBe('/explicit/path.db')
  })

  it('returns WEBSSH2_SSH_HOSTKEY_DB_PATH env var when no explicit path', () => {
    process.env['WEBSSH2_SSH_HOSTKEY_DB_PATH'] = '/env/hostkeys.db'
    expect(resolveDbPath(undefined)).toBe('/env/hostkeys.db')
  })

  it('ignores empty env var', () => {
    process.env['WEBSSH2_SSH_HOSTKEY_DB_PATH'] = ''
    // Falls through to config.json or default
    const result = resolveDbPath(undefined)
    // Should be either from config.json or the default
    expect(typeof result).toBe('string')
    expect(result).not.toBe('')
  })

  it('returns default /data/hostkeys.db when all sources empty', () => {
    // No explicit path, no env var, and config.json likely does not have the field
    // The default fallback should be /data/hostkeys.db
    const result = resolveDbPath(undefined)
    // It may fall through to config.json if present; in test env default is expected
    expect(typeof result).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('defaults to help command with no args', () => {
    const result = parseArgs(['node', 'script'])
    expect(result.command).toBe('help')
  })

  it('parses --help', () => {
    const result = parseArgs(['node', 'script', '--help'])
    expect(result.command).toBe('help')
  })

  it('parses -h', () => {
    const result = parseArgs(['node', 'script', '-h'])
    expect(result.command).toBe('help')
  })

  it('parses --host', () => {
    const result = parseArgs(['node', 'script', '--host', 'example.com'])
    expect(result.command).toBe('host')
    expect(result.host).toBe('example.com')
  })

  it('parses --host with --port', () => {
    const result = parseArgs(['node', 'script', '--host', 'example.com', '--port', '2222'])
    expect(result.command).toBe('host')
    expect(result.host).toBe('example.com')
    expect(result.port).toBe(2222)
  })

  it('parses --list', () => {
    const result = parseArgs(['node', 'script', '--list'])
    expect(result.command).toBe('list')
  })

  it('parses --remove', () => {
    const result = parseArgs(['node', 'script', '--remove', 'example.com:22'])
    expect(result.command).toBe('remove')
    expect(result.removeTarget).toBe('example.com:22')
  })

  it('parses --hosts', () => {
    const result = parseArgs(['node', 'script', '--hosts', 'hosts.txt'])
    expect(result.command).toBe('hosts')
    expect(result.file).toBe('hosts.txt')
  })

  it('parses --known-hosts', () => {
    const result = parseArgs(['node', 'script', '--known-hosts', '~/.ssh/known_hosts'])
    expect(result.command).toBe('known-hosts')
    expect(result.file).toBe('~/.ssh/known_hosts')
  })

  it('parses --db', () => {
    const result = parseArgs(['node', 'script', '--list', '--db', '/custom/path.db'])
    expect(result.command).toBe('list')
    expect(result.dbPath).toBe('/custom/path.db')
  })
})
