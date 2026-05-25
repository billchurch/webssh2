import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import Database from 'better-sqlite3'

// Project ESM convention — see tests/playwright/utils/test-config.ts
const here = dirname(fileURLToPath(import.meta.url))
const distScript = resolve(here, '../../../dist/scripts/host-key-seed.js')

describe('host-key-seed CLI (compiled artifact)', () => {
  it('exists at the expected build output path', () => {
    if (!existsSync(distScript)) {
      throw new Error(
        `Compiled CLI not found at ${distScript}. ` +
        `Run \`npm run build\` before running integration tests. ` +
        `Do not change this to a skip — silently skipping would mask ` +
        `future build-config regressions (e.g., tsconfig changes that ` +
        `drop scripts/** from include) and let issue #527 recur unnoticed.`
      )
    }
  })

  it('prints the usage banner and exits 0 when invoked with --help', () => {
    // Use process.execPath (the absolute path to the currently-running node
    // binary) rather than the bare 'node' string. Bare 'node' would be
    // resolved via $PATH, which Sonar rule typescript:S4036 flags as unsafe
    // if PATH contains a writable directory. process.execPath is fixed at
    // process start, bypasses PATH entirely, and guarantees we spawn the
    // same node version that ran the test.
    const result = spawnSync(process.execPath, [distScript, '--help'], {
      encoding: 'utf8',
      timeout: 10_000
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('webssh2 host key management tool')
    expect(result.stdout).toContain('Show this help message')
  })

  it('escapes control characters in --list output when DB rows contain them', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'webssh2-seed-test-'))
    const dbPath = join(tmp, 'hostkeys.db')

    try {
      const seed = new Database(dbPath)
      seed.exec(
        `CREATE TABLE host_keys (
          host TEXT NOT NULL,
          port INTEGER NOT NULL DEFAULT 22,
          algorithm TEXT NOT NULL,
          key TEXT NOT NULL,
          added_at TEXT NOT NULL DEFAULT (datetime('now')),
          comment TEXT,
          PRIMARY KEY (host, port, algorithm)
        )`
      )
      seed.prepare(
        'INSERT INTO host_keys (host, port, algorithm, key) VALUES (?, ?, ?, ?)'
      ).run('\x1b[31mevil.example\x1b[0m', 22, 'ssh-rsa', 'AAAA')
      seed.close()

      const result = spawnSync(process.execPath, [distScript, '--list', '--db', dbPath], {
        encoding: 'utf8',
        timeout: 10_000
      })

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('\\x1B[31mevil.example\\x1B[0m')
      expect(result.stdout.includes('\x1b')).toBe(false)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
