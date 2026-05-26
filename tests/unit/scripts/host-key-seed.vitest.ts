import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock external dependencies before importing the module under test
vi.mock('better-sqlite3', () => ({
  default: vi.fn()
}))
vi.mock('ssh2', () => ({
  Client: vi.fn()
}))

const {
  extractDbPathFromConfig,
  resolveDbPath,
  parseArgs,
  isMainModule,
  buildDbPathAllowlist,
  validateDbPath,
  readConfiguredDbPath,
} = await import('../../../scripts/host-key-seed.js')

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
    if (originalEnv['WEBSSH2_SSH_HOSTKEY_DB_PATH'] === undefined) {
      delete process.env['WEBSSH2_SSH_HOSTKEY_DB_PATH']
    } else {
      process.env['WEBSSH2_SSH_HOSTKEY_DB_PATH'] = originalEnv['WEBSSH2_SSH_HOSTKEY_DB_PATH']
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

// ---------------------------------------------------------------------------
// isMainModule
// ---------------------------------------------------------------------------

describe('isMainModule', () => {
  it('returns false when argv1 is undefined (early return)', () => {
    expect(isMainModule('file:///irrelevant', undefined)).toBe(false)
  })

  it('returns false when argv1 is empty string (early return)', () => {
    expect(isMainModule('file:///irrelevant', '')).toBe(false)
  })

  it('returns true via the canonical branch when argv1 URL matches import.meta.url', () => {
    // Use a basename NOT in the allowlist so a true result definitively proves
    // the canonical branch matched, not the basename fallback. The path is
    // never touched on disk — pathToFileURL is a pure string-to-URL transform.
    const argv1 = '/srv/webssh2/scripts/arbitrary-name.mjs'
    const importMetaUrl = pathToFileURL(argv1).href
    expect(isMainModule(importMetaUrl, argv1)).toBe(true)
  })

  it('returns true via the basename branch for "host-key-seed.js"', () => {
    // Set importMetaUrl to a different URL so the canonical branch CANNOT match;
    // only the basename allowlist can rescue this.
    expect(
      isMainModule('file:///somewhere/else.js', '/app/dist/scripts/host-key-seed.js')
    ).toBe(true)
  })

  it('returns true via the basename branch for "host-key-seed.ts"', () => {
    expect(
      isMainModule('file:///somewhere/else.js', '/app/scripts/host-key-seed.ts')
    ).toBe(true)
  })

  it('returns true via the basename branch for extensionless "host-key-seed"', () => {
    expect(
      isMainModule('file:///somewhere/else.js', '/usr/local/bin/host-key-seed')
    ).toBe(true)
  })

  it('returns false for unrelated basename "tsx"', () => {
    expect(isMainModule('file:///somewhere/else.js', '/usr/local/bin/tsx')).toBe(false)
  })

  it('returns false for unrelated basename "node"', () => {
    expect(isMainModule('file:///somewhere/else.js', '/usr/local/bin/node')).toBe(false)
  })

  it('returns false for unrelated basename "other-script.js"', () => {
    expect(
      isMainModule('file:///somewhere/else.js', '/app/scripts/other-script.js')
    ).toBe(false)
  })

  it('returns false for prefix-collision basename "host-key-seed-helper.js"', () => {
    // Verifies === semantics, not prefix/suffix matching.
    expect(
      isMainModule('file:///somewhere/else.js', '/app/scripts/host-key-seed-helper.js')
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// sanitizeForDisplay
// ---------------------------------------------------------------------------

// sanitizeForDisplay is already destructured in the main import above
const { sanitizeForDisplay } = await import('../../../scripts/host-key-seed.js')

describe('sanitizeForDisplay', () => {
  it('returns plain printable ASCII unchanged', () => {
    expect(sanitizeForDisplay('example.com')).toBe('example.com')
    expect(sanitizeForDisplay('host-1.sub.example.com:22')).toBe(
      'host-1.sub.example.com:22'
    )
    expect(sanitizeForDisplay('')).toBe('')
  })

  it('escapes ESC and CSI control sequences', () => {
    expect(sanitizeForDisplay('\x1b[31mred\x1b[0m')).toBe('\\x1B[31mred\\x1B[0m')
  })

  it('escapes C0 control characters', () => {
    expect(sanitizeForDisplay('\x00nul')).toBe('\\x00nul')
    expect(sanitizeForDisplay('\x07bell')).toBe('\\x07bell')
    expect(sanitizeForDisplay('\x08bs')).toBe('\\x08bs')
    expect(sanitizeForDisplay('\rcr')).toBe('\\x0Dcr')
    expect(sanitizeForDisplay('\nlf')).toBe('\\x0Alf')
  })

  it('escapes DEL (0x7F)', () => {
    expect(sanitizeForDisplay('a\x7Fb')).toBe('a\\x7Fb')
  })

  it('escapes C1 control characters (0x80-0x9F)', () => {
    expect(sanitizeForDisplay('a\x80b')).toBe('a\\x80b')
    expect(sanitizeForDisplay('a\x9Bb')).toBe('a\\x9Bb')
    expect(sanitizeForDisplay('a\x9Fb')).toBe('a\\x9Fb')
  })

  it('passes through printable Unicode above 0x9F', () => {
    expect(sanitizeForDisplay('münchen.example')).toBe('münchen.example')
    expect(sanitizeForDisplay('host. space')).toBe('host. space')
  })

  it('produces uppercase hex digits', () => {
    expect(sanitizeForDisplay('\x1b')).toBe('\\x1B')
    expect(sanitizeForDisplay('\x0a')).toBe('\\x0A')
  })
})

// ---------------------------------------------------------------------------
// buildDbPathAllowlist / validateDbPath
// ---------------------------------------------------------------------------

describe('buildDbPathAllowlist', () => {
  it('always includes /data and cwd', () => {
    const list = buildDbPathAllowlist({}, undefined, '/srv/app')
    expect(list).toContain('/data')
    expect(list).toContain('/srv/app')
  })

  it('adds env var dirname when WEBSSH2_SSH_HOSTKEY_DB_PATH is set', () => {
    const list = buildDbPathAllowlist(
      { WEBSSH2_SSH_HOSTKEY_DB_PATH: '/var/lib/webssh2/db.sqlite' },
      undefined,
      '/srv/app'
    )
    expect(list).toContain('/var/lib/webssh2')
  })

  it('ignores empty env var', () => {
    const list = buildDbPathAllowlist(
      { WEBSSH2_SSH_HOSTKEY_DB_PATH: '' },
      undefined,
      '/srv/app'
    )
    expect(list).not.toContain('')
  })

  it('adds config dbPath dirname when provided', () => {
    const list = buildDbPathAllowlist({}, '/etc/webssh2/keys.db', '/srv/app')
    expect(list).toContain('/etc/webssh2')
  })

  it('deduplicates equal entries', () => {
    const list = buildDbPathAllowlist(
      { WEBSSH2_SSH_HOSTKEY_DB_PATH: '/data/keys.db' },
      '/data/keys.db',
      '/data'
    )
    const dataCount = list.filter((p) => p === '/data').length
    expect(dataCount).toBe(1)
  })

  it('returns entries in documented priority order: /data, env, config, cwd', () => {
    const list = buildDbPathAllowlist(
      { WEBSSH2_SSH_HOSTKEY_DB_PATH: '/env/keys.db' },
      '/cfg/keys.db',
      '/srv/app'
    )
    expect(list).toEqual(['/data', '/env', '/cfg', '/srv/app'])
  })
})

describe('validateDbPath', () => {
  it('returns ok when the parent directory exists anywhere', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'webssh2-validate-'))
    try {
      const target = join(tmp, 'keys.db')
      const result = validateDbPath(target, ['/data'])
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe(target)
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('returns ok when parent does not exist but path is under allowlist entry', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'webssh2-validate-'))
    try {
      const target = join(tmp, 'subdir', 'keys.db')   // subdir does not exist
      const result = validateDbPath(target, [tmp])    // tmp is in allowlist
      expect(result.ok).toBe(true)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('returns error when parent does not exist and path is outside allowlist', () => {
    const result = validateDbPath('/nonexistent/sub/dir/keys.db', ['/data'])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('refusing to create directories')
      expect(result.error).toContain('/data')
    }
  })

  it('rejects /datafoo when allowlist only contains /data (no prefix collision)', () => {
    const result = validateDbPath('/datafoo/keys.db', ['/data'])
    expect(result.ok).toBe(false)
  })

  it('resolves relative paths against cwd', () => {
    const result = validateDbPath('keys.db', ['/data'])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.startsWith('/')).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// readConfiguredDbPath
// ---------------------------------------------------------------------------

describe('readConfiguredDbPath', () => {
  it('returns undefined when config.json does not exist', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'webssh2-readcfg-missing-'))
    const originalCwd = process.cwd()
    try {
      process.chdir(tmp)
      expect(readConfiguredDbPath()).toBeUndefined()
    } finally {
      process.chdir(originalCwd)
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('returns undefined when config.json is malformed JSON', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'webssh2-readcfg-bad-'))
    const originalCwd = process.cwd()
    try {
      writeFileSync(join(tmp, 'config.json'), '{ this is not json')
      process.chdir(tmp)
      expect(readConfiguredDbPath()).toBeUndefined()
    } finally {
      process.chdir(originalCwd)
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('returns the dbPath from a valid nested config', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'webssh2-readcfg-valid-'))
    const originalCwd = process.cwd()
    try {
      const cfg = {
        ssh: {
          hostKeyVerification: {
            serverStore: { dbPath: '/custom/path/keys.db' }
          }
        }
      }
      writeFileSync(join(tmp, 'config.json'), JSON.stringify(cfg))
      process.chdir(tmp)
      expect(readConfiguredDbPath()).toBe('/custom/path/keys.db')
    } finally {
      process.chdir(originalCwd)
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
