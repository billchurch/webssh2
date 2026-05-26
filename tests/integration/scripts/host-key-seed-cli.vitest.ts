import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

  it('rejects --db with missing parent dir outside allowlist', () => {
    const result = spawnSync(
      process.execPath,
      [distScript, '--list', '--db', '/nonexistent/sub/dir/keys.db'],
      { encoding: 'utf8', timeout: 10_000 }
    )

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('refusing to create directories')
  })

  it('accepts --db with existing parent dir', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'webssh2-seed-db-'))
    const dbPath = join(tmp, 'keys.db')
    try {
      const result = spawnSync(
        process.execPath,
        [distScript, '--list', '--db', dbPath],
        { encoding: 'utf8', timeout: 10_000 }
      )
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('No host keys stored.')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('accepts --db with missing parent dir under cwd (allowlist member)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'webssh2-seed-cwd-'))
    const dbPath = join(tmp, 'fresh-subdir', 'keys.db')
    try {
      const result = spawnSync(
        process.execPath,
        [distScript, '--list', '--db', dbPath],
        {
          encoding: 'utf8',
          timeout: 10_000,
          cwd: tmp
        }
      )
      expect(result.status).toBe(0)
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      expect(existsSync(join(tmp, 'fresh-subdir'))).toBe(true)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('rejects --hosts file exceeding default cap of 1000', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'webssh2-seed-cap-'))
    const dbPath = join(tmp, 'keys.db')
    const hostsFile = join(tmp, 'hosts.txt')
    try {
      const lines: string[] = []
      for (let i = 0; i < 1001; i++) {
        lines.push(`host-${i.toString()}.example`)
      }
      writeFileSync(hostsFile, lines.join('\n'))

      const result = spawnSync(
        process.execPath,
        [distScript, '--hosts', hostsFile, '--db', dbPath],
        { encoding: 'utf8', timeout: 10_000 }
      )

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('exceeds default cap of 1000')
      expect(result.stderr).toContain('--max-hosts')
      expect(result.stdout).not.toContain('Probing')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('accepts --hosts file at default cap (1000)', { timeout: 30_000 }, () => {
    const tmp = mkdtempSync(join(tmpdir(), 'webssh2-seed-cap-ok-'))
    const dbPath = join(tmp, 'keys.db')
    const hostsFile = join(tmp, 'hosts.txt')
    try {
      const lines: string[] = []
      for (let i = 0; i < 1000; i++) {
        lines.push(`unroutable-${i.toString()}.invalid`)
      }
      writeFileSync(hostsFile, lines.join('\n'))

      const result = spawnSync(
        process.execPath,
        [distScript, '--hosts', hostsFile, '--db', dbPath],
        { encoding: 'utf8', timeout: 20_000, killSignal: 'SIGTERM' }
      )

      expect(result.stderr).not.toContain('exceeds')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('honors --max-hosts override above default', { timeout: 30_000 }, () => {
    const tmp = mkdtempSync(join(tmpdir(), 'webssh2-seed-override-'))
    const dbPath = join(tmp, 'keys.db')
    const hostsFile = join(tmp, 'hosts.txt')
    try {
      const lines: string[] = []
      for (let i = 0; i < 1500; i++) {
        lines.push(`unroutable-${i.toString()}.invalid`)
      }
      writeFileSync(hostsFile, lines.join('\n'))

      const result = spawnSync(
        process.execPath,
        [
          distScript,
          '--hosts', hostsFile,
          '--max-hosts', '1500',
          '--db', dbPath
        ],
        { encoding: 'utf8', timeout: 20_000, killSignal: 'SIGTERM' }
      )

      expect(result.stderr).not.toContain('exceeds')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('--known-hosts without --commit is a dry-run (DB row count unchanged)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'webssh2-seed-kh-dry-'))
    const dbPath = join(tmp, 'keys.db')
    const khFile = join(tmp, 'known_hosts')
    try {
      writeFileSync(khFile, 'example.com ssh-rsa AAAAB3NzaC1yc2EAAAA\n')

      const result = spawnSync(
        process.execPath,
        [distScript, '--known-hosts', khFile, '--db', dbPath],
        { encoding: 'utf8', timeout: 10_000 }
      )

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('DRY RUN')
      expect(result.stdout).toContain('--commit')

      const listResult = spawnSync(
        process.execPath,
        [distScript, '--list', '--db', dbPath],
        { encoding: 'utf8', timeout: 10_000 }
      )
      expect(listResult.stdout).toContain('No host keys stored.')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('--known-hosts --commit writes to the DB', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'webssh2-seed-kh-commit-'))
    const dbPath = join(tmp, 'keys.db')
    const khFile = join(tmp, 'known_hosts')
    try {
      writeFileSync(khFile, 'example.com ssh-rsa AAAAB3NzaC1yc2EAAAA\n')

      const result = spawnSync(
        process.execPath,
        [distScript, '--known-hosts', khFile, '--commit', '--db', dbPath],
        { encoding: 'utf8', timeout: 10_000 }
      )

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Imported 1 key(s)')

      const listResult = spawnSync(
        process.execPath,
        [distScript, '--list', '--db', dbPath],
        { encoding: 'utf8', timeout: 10_000 }
      )
      expect(listResult.stdout).toContain('example.com')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('--known-hosts preview sanitizes adversarial hostnames', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'webssh2-seed-kh-adv-'))
    const dbPath = join(tmp, 'keys.db')
    const khFile = join(tmp, 'known_hosts')
    try {
      writeFileSync(khFile, '\x1b[31mevil\x1b[0m ssh-rsa AAAAB3NzaC1yc2EAAAA\n')

      const result = spawnSync(
        process.execPath,
        [distScript, '--known-hosts', khFile, '--db', dbPath],
        { encoding: 'utf8', timeout: 10_000 }
      )

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('\\x1B[31mevil\\x1B[0m')
      expect(result.stdout.includes('\x1b')).toBe(false)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
