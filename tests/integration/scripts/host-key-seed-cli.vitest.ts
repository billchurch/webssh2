import { describe, expect, it } from 'vitest'
import {
  spawnSync,
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns
} from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import Database from 'better-sqlite3'

// Project ESM convention — see tests/playwright/utils/test-config.ts
const here = dirname(fileURLToPath(import.meta.url))
const distScript = resolve(here, '../../../dist/scripts/host-key-seed.js')

interface RunCliOptions {
  cwd?: string
  timeout?: number
}

/**
 * Run the compiled CLI with the given args. Uses `process.execPath` (not the
 * bare 'node' string) so Sonar rule typescript:S4036 stays satisfied and the
 * spawned binary matches the version running the test.
 *
 * spawnSync's default `killSignal` is SIGTERM, which is what every test here
 * needs — we don't override it.
 */
function runCli(args: string[], opts: RunCliOptions = {}): SpawnSyncReturns<string> {
  const spawnOpts: SpawnSyncOptionsWithStringEncoding = {
    encoding: 'utf8',
    timeout: opts.timeout ?? 10_000
  }
  if (opts.cwd !== undefined) {
    spawnOpts.cwd = opts.cwd
  }
  return spawnSync(process.execPath, [distScript, ...args], spawnOpts)
}

/**
 * Run `fn` inside a fresh `mkdtemp` directory, passing both the dir path and
 * a conventional `<dir>/keys.db` path. The directory is removed afterward
 * regardless of whether `fn` threw.
 */
function withSeedTempDir(
  slug: string,
  fn: (tmp: string, dbPath: string) => void
): void {
  const tmp = mkdtempSync(join(tmpdir(), `webssh2-seed-${slug}-`))
  try {
    fn(tmp, join(tmp, 'keys.db'))
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

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
    const result = runCli(['--help'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('webssh2 host key management tool')
    expect(result.stdout).toContain('Show this help message')
  })

  it('escapes control characters in --list output when DB rows contain them', () => {
    withSeedTempDir('list-adv', (_tmp, dbPath) => {
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

      const result = runCli(['--list', '--db', dbPath])

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('\\x1B[31mevil.example\\x1B[0m')
      expect(result.stdout.includes('\x1b')).toBe(false)
    })
  })

  it('rejects --db with missing parent dir outside allowlist', () => {
    const result = runCli(['--list', '--db', '/nonexistent/sub/dir/keys.db'])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('refusing to create directories')
  })

  it('accepts --db with existing parent dir', () => {
    withSeedTempDir('db-existing', (_tmp, dbPath) => {
      const result = runCli(['--list', '--db', dbPath])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('No host keys stored.')
    })
  })

  it('accepts --db with missing parent dir under cwd (allowlist member)', () => {
    withSeedTempDir('db-cwd', (tmp) => {
      const dbPath = join(tmp, 'fresh-subdir', 'keys.db')
      const result = runCli(['--list', '--db', dbPath], { cwd: tmp })
      expect(result.status).toBe(0)
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      expect(existsSync(join(tmp, 'fresh-subdir'))).toBe(true)
    })
  })

  it('rejects --hosts file exceeding default cap of 1000', () => {
    withSeedTempDir('hosts-cap', (tmp, dbPath) => {
      const hostsFile = join(tmp, 'hosts.txt')
      const lines: string[] = []
      for (let i = 0; i < 1001; i++) {
        lines.push(`host-${i.toString()}.example`)
      }
      writeFileSync(hostsFile, lines.join('\n'))

      const result = runCli(['--hosts', hostsFile, '--db', dbPath])

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('exceeds default cap of 1000')
      expect(result.stderr).toContain('--max-hosts')
      expect(result.stdout).not.toContain('Probing')
    })
  })

  it('accepts --hosts file at default cap (1000)', { timeout: 30_000 }, () => {
    withSeedTempDir('hosts-cap-ok', (tmp, dbPath) => {
      const hostsFile = join(tmp, 'hosts.txt')
      const lines: string[] = []
      for (let i = 0; i < 1000; i++) {
        lines.push(`unroutable-${i.toString()}.invalid`)
      }
      writeFileSync(hostsFile, lines.join('\n'))

      const result = runCli(
        ['--hosts', hostsFile, '--db', dbPath],
        { timeout: 20_000 }
      )

      expect(result.stderr).not.toContain('exceeds')
    })
  })

  it('honors --max-hosts override above default', { timeout: 30_000 }, () => {
    withSeedTempDir('hosts-override', (tmp, dbPath) => {
      const hostsFile = join(tmp, 'hosts.txt')
      const lines: string[] = []
      for (let i = 0; i < 1500; i++) {
        lines.push(`unroutable-${i.toString()}.invalid`)
      }
      writeFileSync(hostsFile, lines.join('\n'))

      const result = runCli(
        ['--hosts', hostsFile, '--max-hosts', '1500', '--db', dbPath],
        { timeout: 20_000 }
      )

      expect(result.stderr).not.toContain('exceeds')
    })
  })

  it('--known-hosts without --commit is a dry-run (DB row count unchanged)', () => {
    withSeedTempDir('kh-dry', (tmp, dbPath) => {
      const khFile = join(tmp, 'known_hosts')
      writeFileSync(khFile, 'example.com ssh-rsa AAAAB3NzaC1yc2EAAAA\n')

      const result = runCli(['--known-hosts', khFile, '--db', dbPath])

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('DRY RUN')
      expect(result.stdout).toContain('--commit')

      const listResult = runCli(['--list', '--db', dbPath])
      expect(listResult.stdout).toContain('No host keys stored.')
    })
  })

  it('--known-hosts --commit writes to the DB', () => {
    withSeedTempDir('kh-commit', (tmp, dbPath) => {
      const khFile = join(tmp, 'known_hosts')
      writeFileSync(khFile, 'example.com ssh-rsa AAAAB3NzaC1yc2EAAAA\n')

      const result = runCli(['--known-hosts', khFile, '--commit', '--db', dbPath])

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Imported 1 key(s)')

      const listResult = runCli(['--list', '--db', dbPath])
      expect(listResult.stdout).toContain('example.com')
    })
  })

  it('--known-hosts preview sanitizes adversarial hostnames', () => {
    withSeedTempDir('kh-adv', (tmp, dbPath) => {
      const khFile = join(tmp, 'known_hosts')
      writeFileSync(khFile, '\x1b[31mevil\x1b[0m ssh-rsa AAAAB3NzaC1yc2EAAAA\n')

      const result = runCli(['--known-hosts', khFile, '--db', dbPath])

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('\\x1B[31mevil\\x1B[0m')
      expect(result.stdout.includes('\x1b')).toBe(false)
    })
  })
})
