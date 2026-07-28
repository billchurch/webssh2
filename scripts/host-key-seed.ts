// scripts/host-key-seed.ts
// CLI tool for managing the SQLite host key database.
//
// Usage:
//   npm run hostkeys -- --help
//   npm run hostkeys -- --host example.com --port 22
//   npm run hostkeys -- --hosts hosts.txt
//   npm run hostkeys -- --known-hosts ~/.ssh/known_hosts
//   npm run hostkeys -- --list
//   npm run hostkeys -- --remove example.com:22

import crypto from 'node:crypto'
import fs from 'node:fs'
import path, { basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { Client as SSH2Client } from 'ssh2'
import type { Result } from '../app/types/result.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PORT = 22
const PROBE_TIMEOUT_MS = 15_000
const READY_TIMEOUT_MS = 10_000
const DEFAULT_MAX_HOSTS = 1000

const HOST_KEY_SCHEMA = `
CREATE TABLE IF NOT EXISTS host_keys (
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    algorithm TEXT NOT NULL,
    key TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    comment TEXT,
    PRIMARY KEY (host, port, algorithm)
);
`

const USAGE = `
webssh2 host key management tool

Usage:
  npm run hostkeys -- <command> [options]

Commands:
  --host <hostname> [--port <port>]   Probe a host via SSH and store its key
  --hosts <file>                      Probe hosts from a file (host[:port] per line)
                                      Capped at 1000 entries by default; see --max-hosts
  --known-hosts <file>                Preview keys from an OpenSSH known_hosts file
                                      (dry-run by default; add --commit to write)
  --list                              List all stored host keys
  --remove <host:port>                Remove all keys for a host:port pair
  --help                              Show this help message

Options:
  --commit                            With --known-hosts, write to the trust store
                                      (otherwise the command is a dry-run preview)
  --max-hosts <N>                     Override the default --hosts cap (default 1000)
  --db <path>                         Database file path
                                      Resolution order:
                                        1. --db <path> argument
                                        2. WEBSSH2_SSH_HOSTKEY_DB_PATH env var
                                        3. config.json ssh.hostKeyVerification.serverStore.dbPath
                                        4. /data/hostkeys.db (default)

Examples:
  npm run hostkeys -- --host example.com
  npm run hostkeys -- --host example.com --port 2222
  npm run hostkeys -- --hosts servers.txt
  npm run hostkeys -- --known-hosts ~/.ssh/known_hosts            # preview only
  npm run hostkeys -- --known-hosts ~/.ssh/known_hosts --commit   # write
  npm run hostkeys -- --list
  npm run hostkeys -- --list --db /custom/path/hostkeys.db
  npm run hostkeys -- --remove example.com:22
`.trim()

// ---------------------------------------------------------------------------
// Display sanitization
// ---------------------------------------------------------------------------

/**
 * Escape control characters in a string for safe terminal display.
 *
 * Replaces bytes in [0x00, 0x1F] (C0 controls), 0x7F (DEL), and [0x80, 0x9F]
 * (C1 controls) with `\xNN` escape notation. Printable ASCII (0x20-0x7E) and
 * printable Unicode above 0x9F pass through unchanged.
 */
export function sanitizeForDisplay(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x1F\x7F-\x9F]/g, (ch) => {
    const code = ch.codePointAt(0) ?? 0
    return String.raw`\x${code.toString(16).padStart(2, '0').toUpperCase()}`
  })
}

// ---------------------------------------------------------------------------
// Algorithm extraction (mirrors host-key-verifier.ts)
// ---------------------------------------------------------------------------

/**
 * Extract the algorithm name from an SSH public key buffer.
 * SSH wire format: 4-byte big-endian length + algorithm string + key data.
 */
function extractAlgorithm(keyBuffer: Buffer): string {
  if (keyBuffer.length < 4) {
    return 'unknown'
  }
  const algLength = keyBuffer.readUInt32BE(0)
  if (keyBuffer.length < 4 + algLength) {
    return 'unknown'
  }
  return keyBuffer.subarray(4, 4 + algLength).toString('ascii')
}

/**
 * Compute a SHA-256 fingerprint matching OpenSSH conventions.
 */
function computeFingerprint(base64Key: string): string {
  const keyBytes = Buffer.from(base64Key, 'base64')
  const hash = crypto.createHash('sha256').update(keyBytes).digest('base64')
  return `SHA256:${hash}`
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

const BASE_DB_ALLOWLIST: readonly string[] = ['/data']

/**
 * Resolve a path to its real (symlink-free) canonical form.
 *
 * If the path does not exist, walks up the ancestor chain to find the
 * deepest existing prefix, resolves that via `realpathSync`, then
 * re-appends the non-existing tail.  This normalises macOS symlinks such
 * as `/var/folders` → `/private/var/folders` even when the full path does
 * not yet exist on disk.
 */
function resolveRealpath(p: string): string {
  let current = path.resolve(p)
  const tail: string[] = []

  while (current !== path.dirname(current)) {
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const real = fs.realpathSync(current)
      // Re-append any non-existing tail segments
      return tail.length === 0 ? real : path.join(real, ...tail.toReversed())
    } catch {
      tail.push(path.basename(current))
      current = path.dirname(current)
    }
  }
  return p
}

/**
 * Compose the `--db` path allowlist from its four sources, in priority order:
 *   1. `/data` (the documented default)
 *   2. The directory of `WEBSSH2_SSH_HOSTKEY_DB_PATH` if set
 *   3. The directory of `config.json`'s `ssh.hostKeyVerification.serverStore.dbPath` if set
 *   4. The current working directory
 *
 * Each entry is resolved to an absolute path. Duplicates are removed while
 * preserving the order above so the runtime allowlist reads in priority order.
 */
export function buildDbPathAllowlist(
  env: Record<string, string | undefined>,
  configDbPath: string | undefined,
  cwd: string
): string[] {
  const candidates: string[] = [...BASE_DB_ALLOWLIST]

  const envPath = env['WEBSSH2_SSH_HOSTKEY_DB_PATH']
  if (typeof envPath === 'string' && envPath !== '') {
    candidates.push(path.dirname(path.resolve(envPath)))
  }

  if (configDbPath !== undefined && configDbPath !== '') {
    candidates.push(path.dirname(path.resolve(configDbPath)))
  }

  candidates.push(path.resolve(cwd))

  const seen = new Set<string>()
  const dedup: string[] = []
  for (const entry of candidates) {
    if (!seen.has(entry)) {
      seen.add(entry)
      dedup.push(entry)
    }
  }
  return dedup
}

/**
 * Validate a `--db` path. Returns the canonical absolute path on ok.
 *
 * Policy:
 *   1. Resolve the requested path to a canonical absolute path.
 *   2. If the parent directory exists anywhere on disk, accept.
 *   3. If the parent directory does not exist, accept only when the canonical
 *      path equals an allowlist entry or sits under one (matched with a path
 *      separator to avoid /datafoo matching /data).
 *   4. Otherwise reject with a message listing the allowlist.
 */
export function validateDbPath(
  requestedPath: string,
  allowlist: readonly string[]
): Result<string, string> {
  const canonical = path.resolve(requestedPath)
  const parentDir = path.dirname(canonical)

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (fs.existsSync(parentDir)) {
    return { ok: true, value: canonical }
  }

  // Resolve symlinks on both sides of the comparison so that macOS paths
  // such as /var/folders (symlink → /private/var/folders) match correctly
  // even when the destination does not yet exist.
  const realCanonical = resolveRealpath(canonical)

  for (const allowed of allowlist) {
    const realAllowed = resolveRealpath(path.resolve(allowed))
    if (
      realCanonical === realAllowed ||
      realCanonical.startsWith(`${realAllowed}${path.sep}`)
    ) {
      return { ok: true, value: canonical }
    }
  }

  return {
    ok: false,
    error: `refusing to create directories outside allowlist for --db. Allowed: ${allowlist.join(', ')}`
  }
}

function openDb(dbPath: string): DatabaseType {
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const db = new Database(dbPath)
  db.exec(HOST_KEY_SCHEMA)
  return db
}

function upsertKey(
  db: DatabaseType,
  host: string,
  port: number,
  algorithm: string,
  key: string,
  comment?: string
): void {
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO host_keys (host, port, algorithm, key, added_at, comment)
     VALUES (?, ?, ?, ?, datetime('now'), ?)`
  )
  stmt.run(host, port, algorithm, key, comment ?? null)
}

// ---------------------------------------------------------------------------
// SSH host probing
// ---------------------------------------------------------------------------

interface ProbeResult {
  algorithm: string
  key: string
}

function probeHostKey(host: string, port: number): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const client = new SSH2Client()
    let resolved = false

    client.on('error', (err: Error) => {
      if (!resolved) {
        resolved = true
        reject(err)
      }
    })

    client.connect({
      host,
      port,
      username: 'probe',
      readyTimeout: READY_TIMEOUT_MS,
      hostVerifier: (key: Buffer, verify: (valid: boolean) => void) => {
        if (resolved) {
          verify(false)
          return
        }
        resolved = true
        const base64Key = key.toString('base64')
        const algorithm = extractAlgorithm(key)
        resolve({ algorithm, key: base64Key })
        verify(false)
        client.end()
      },
    })

    setTimeout(() => {
      if (!resolved) {
        resolved = true
        client.end()
        reject(new Error(`Timeout connecting to ${host}:${port}`))
      }
    }, PROBE_TIMEOUT_MS)
  })
}

// ---------------------------------------------------------------------------
// --hosts file parsing
// ---------------------------------------------------------------------------

export interface HostsFileEntry {
  host: string
  port: number
}

/**
 * Parse the `--hosts` file format: one `host` or `host:port` per line.
 * Lines that are blank or start with `#` are skipped. When a `:port`
 * suffix is non-numeric, the full line is treated as a hostname and the
 * default port is used.
 */
export function parseHostsFile(content: string): HostsFileEntry[] {
  const entries: HostsFileEntry[] = []
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) {
      continue
    }
    const colonIndex = line.lastIndexOf(':')
    if (colonIndex > 0) {
      const port = Number.parseInt(line.slice(colonIndex + 1), 10)
      if (!Number.isNaN(port)) {
        entries.push({ host: line.slice(0, colonIndex), port })
        continue
      }
    }
    entries.push({ host: line, port: DEFAULT_PORT })
  }
  return entries
}

/**
 * Enforce the `--hosts` entry cap. `explicit=true` means the operator
 * passed `--max-hosts` so the error message uses different wording.
 */
export function checkHostsCap(
  count: number,
  maxHosts: number,
  explicit: boolean
): Result<number, string> {
  if (!Number.isFinite(maxHosts) || maxHosts <= 0) {
    return {
      ok: false,
      error: '--max-hosts requires a positive integer'
    }
  }
  if (count <= maxHosts) {
    return { ok: true, value: maxHosts }
  }
  if (explicit) {
    return {
      ok: false,
      error: `file contains ${count} entries, exceeds explicit --max-hosts cap of ${maxHosts}`
    }
  }
  return {
    ok: false,
    error:
      `file contains ${count} entries, exceeds default cap of ${maxHosts}.\n` +
      `  Use --max-hosts N to override.`
  }
}

// ---------------------------------------------------------------------------
// known_hosts parsing
// ---------------------------------------------------------------------------

export interface KnownHostEntry {
  host: string
  port: number
  algorithm: string
  key: string
}

function parseKnownHostLine(line: string): KnownHostEntry[] {
  const entries: KnownHostEntry[] = []

  // Format: hostname[,hostname2] algorithm base64key [comment]
  const parts = line.split(/\s+/)
  if (parts.length < 3) {
    return entries
  }

  const hostnameField = parts[0] ?? ''
  const algorithm = parts[1] ?? ''
  const key = parts[2] ?? ''

  if (hostnameField === '' || algorithm === '' || key === '') {
    return entries
  }

  // Hostnames may be comma-separated (e.g. "host1,host2")
  const hostnames = hostnameField.split(',')

  for (const hostname of hostnames) {
    if (hostname === '') {
      continue
    }

    // Skip hashed entries (start with |)
    if (hostname.startsWith('|')) {
      continue
    }

    // Check for [host]:port format (non-standard port)
    const bracketMatch = /^\[([^\]]+)\]:(\d+)$/.exec(hostname)
    if (bracketMatch === null) {
      entries.push({ host: hostname, port: DEFAULT_PORT, algorithm, key })
    } else {
      const matchedHost = bracketMatch[1] ?? hostname
      const matchedPort = Number.parseInt(bracketMatch[2] ?? String(DEFAULT_PORT), 10)
      entries.push({ host: matchedHost, port: matchedPort, algorithm, key })
    }
  }

  return entries
}

function parseKnownHosts(content: string): KnownHostEntry[] {
  const entries: KnownHostEntry[] = []

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()

    // Skip empty lines and comments
    if (line === '' || line.startsWith('#')) {
      continue
    }

    entries.push(...parseKnownHostLine(line))
  }

  return entries
}

// ---------------------------------------------------------------------------
// Resolve default DB path
// ---------------------------------------------------------------------------

/**
 * Safely traverse a nested JSON structure to extract the dbPath.
 * Uses explicit type narrowing rather than indexed access to satisfy
 * the security/detect-object-injection rule.
 */
export function extractDbPathFromConfig(config: unknown): string | undefined {
  if (typeof config !== 'object' || config === null) {
    return undefined
  }

  const ssh: unknown = (config as Record<string, unknown>)['ssh']
  if (typeof ssh !== 'object' || ssh === null) {
    return undefined
  }

  const hkv: unknown = (ssh as Record<string, unknown>)['hostKeyVerification']
  if (typeof hkv !== 'object' || hkv === null) {
    return undefined
  }

  const store: unknown = (hkv as Record<string, unknown>)['serverStore']
  if (typeof store !== 'object' || store === null) {
    return undefined
  }

  const dbPath: unknown = (store as Record<string, unknown>)['dbPath']
  if (typeof dbPath === 'string' && dbPath !== '') {
    return dbPath
  }

  return undefined
}

/**
 * Read the dbPath from config.json without applying any fallbacks.
 * Used by buildDbPathAllowlist so an operator-configured dbPath dir is
 * in the allowlist even when no DB exists there yet.
 */
export function readConfiguredDbPath(): string | undefined {
  const configPath = path.resolve(process.cwd(), 'config.json')
  if (!fs.existsSync(configPath)) {
    return undefined
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf8')
    const config: unknown = JSON.parse(raw)
    return extractDbPathFromConfig(config)
  } catch {
    return undefined
  }
}

export function resolveDbPath(explicitPath: string | undefined): string {
  if (explicitPath !== undefined) {
    return explicitPath
  }

  // Try environment variable (same as main app uses)
  const envDbPath = process.env['WEBSSH2_SSH_HOSTKEY_DB_PATH']
  if (typeof envDbPath === 'string' && envDbPath !== '') {
    return envDbPath
  }

  // Try reading from config.json
  const configPath = path.resolve(process.cwd(), 'config.json')
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8')
      const config: unknown = JSON.parse(raw)
      const extracted = extractDbPathFromConfig(config)
      if (extracted !== undefined) {
        return extracted
      }
    } catch {
      // Ignore parse errors; fall through to default
    }
  }

  return '/data/hostkeys.db'
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

export interface CliArgs {
  command: 'host' | 'hosts' | 'known-hosts' | 'list' | 'remove' | 'help'
  host?: string | undefined
  port?: number | undefined
  file?: string | undefined
  removeTarget?: string | undefined
  dbPath?: string | undefined
  commit: boolean
  maxHosts?: number | undefined
  maxHostsExplicit: boolean
}

function nextArg(args: readonly string[], index: number): string | undefined {
  const next = index + 1
  return next < args.length ? args.at(next) : undefined
}

function parseOptionalInt(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number.parseInt(value, 10)
}

interface ParsedFlag {
  patch: Partial<CliArgs>
  // Number of extra argv entries this flag consumed beyond itself.
  consumed: number
}

// Interprets a single CLI flag, returning the CliArgs fields it sets and how
// many additional argv entries (e.g. a flag's value) it consumed.
function parseFlag(arg: string, args: readonly string[], index: number): ParsedFlag {
  switch (arg) {
    case '--help':
    case '-h':
      return { patch: { command: 'help' }, consumed: 0 }
    case '--host':
      return { patch: { command: 'host', host: nextArg(args, index) }, consumed: 1 }
    case '--port':
      return { patch: { port: parseOptionalInt(nextArg(args, index)) }, consumed: 1 }
    case '--hosts':
      return { patch: { command: 'hosts', file: nextArg(args, index) }, consumed: 1 }
    case '--known-hosts':
      return { patch: { command: 'known-hosts', file: nextArg(args, index) }, consumed: 1 }
    case '--list':
      return { patch: { command: 'list' }, consumed: 0 }
    case '--remove':
      return { patch: { command: 'remove', removeTarget: nextArg(args, index) }, consumed: 1 }
    case '--db':
      return { patch: { dbPath: nextArg(args, index) }, consumed: 1 }
    case '--commit':
      // Consumed by handleKnownHosts in Task 4 to gate dry-run vs. write.
      return { patch: { commit: true }, consumed: 0 }
    case '--max-hosts': {
      const maxHosts = parseOptionalInt(nextArg(args, index))
      const patch: Partial<CliArgs> =
        maxHosts === undefined ? {} : { maxHosts, maxHostsExplicit: true }
      return { patch, consumed: 1 }
    }
    default:
      return { patch: {}, consumed: 0 }
  }
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args = argv.slice(2) // skip node and script path
  let result: CliArgs = {
    command: 'help',
    host: undefined,
    port: undefined,
    file: undefined,
    removeTarget: undefined,
    dbPath: undefined,
    commit: false,
    maxHosts: undefined,
    maxHostsExplicit: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args.at(i)
    if (arg === undefined) {
      continue
    }
    const { patch, consumed } = parseFlag(arg, args, i)
    result = { ...result, ...patch }
    i += consumed
  }

  return result
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function handleProbeHost(
  db: DatabaseType,
  host: string,
  port: number
): Promise<void> {
  const safeHost = sanitizeForDisplay(host)
  process.stdout.write(`Probing ${safeHost}:${port}...\n`)
  try {
    const result = await probeHostKey(host, port)
    upsertKey(db, host, port, result.algorithm, result.key)
    const fingerprint = computeFingerprint(result.key)
    const safeAlgorithm = sanitizeForDisplay(result.algorithm)
    process.stdout.write(`Added ${safeAlgorithm} key for ${safeHost}:${port}\n`)
    process.stdout.write(`Fingerprint: ${fingerprint}\n`)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`Error probing ${safeHost}:${port}: ${message}\n`)
  }
}

async function handleProbeHosts(
  db: DatabaseType,
  filePath: string,
  maxHosts: number,
  maxHostsExplicit: boolean
): Promise<number> {
  if (!fs.existsSync(filePath)) {
    process.stderr.write(`File not found: ${sanitizeForDisplay(filePath)}\n`)
    return 1
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const entries = parseHostsFile(content)

  const cap = checkHostsCap(entries.length, maxHosts, maxHostsExplicit)
  if (!cap.ok) {
    process.stderr.write(`Error: ${cap.error}\n`)
    return 1
  }

  for (const entry of entries) {
    await handleProbeHost(db, entry.host, entry.port)
  }

  return 0
}

function handleKnownHosts(
  db: DatabaseType,
  filePath: string,
  commit: boolean
): void {
  if (!fs.existsSync(filePath)) {
    process.stderr.write(`File not found: ${sanitizeForDisplay(filePath)}\n`)
    return
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const entries = parseKnownHosts(content)

  if (entries.length === 0) {
    process.stdout.write('No valid entries found in known_hosts file.\n')
    return
  }

  process.stdout.write(formatListRow('Host', 'Port', 'Algorithm', 'Fingerprint', '(preview)'))
  for (const entry of entries) {
    process.stdout.write(formatKnownHostsPreviewRow(entry))
  }

  const safePath = sanitizeForDisplay(filePath)
  if (!commit) {
    process.stdout.write(
      `\nDRY RUN: would import ${String(entries.length)} key(s) from ${safePath}.\n` +
      `Re-run with --commit to write to the trust store.\n`
    )
    return
  }

  for (const entry of entries) {
    upsertKey(db, entry.host, entry.port, entry.algorithm, entry.key)
  }

  process.stdout.write(`\nImported ${String(entries.length)} key(s) from ${safePath}\n`)
}

function formatListRow(
  hostVal: string,
  portVal: string,
  algVal: string,
  fpVal: string,
  dateVal: string
): string {
  const hostWidth = 24
  const portWidth = 6
  const algWidth = 24
  const fpWidth = 38
  const dateWidth = 20
  return `${hostVal.padEnd(hostWidth)}${portVal.padEnd(portWidth)}${algVal.padEnd(algWidth)}${fpVal.padEnd(fpWidth)}${dateVal.padEnd(dateWidth)}\n`
}

/**
 * Format one preview row for `--known-hosts` dry-run output. Sanitizes the
 * host for safe terminal display, computes the SHA-256 fingerprint, and
 * lays out the columns using formatListRow's widths.
 */
export function formatKnownHostsPreviewRow(entry: KnownHostEntry): string {
  const fingerprint = computeFingerprint(entry.key)
  const truncatedFp = fingerprint.length > 36
    ? `${fingerprint.slice(0, 36)}...`
    : fingerprint
  return formatListRow(
    sanitizeForDisplay(entry.host),
    String(entry.port),
    sanitizeForDisplay(entry.algorithm),
    truncatedFp,
    ''
  )
}

function handleList(db: DatabaseType): void {
  const rows = db.prepare(
    'SELECT host, port, algorithm, key, added_at FROM host_keys ORDER BY host, port, algorithm'
  ).all() as Array<{
    host: string
    port: number
    algorithm: string
    key: string
    added_at: string
  }>

  if (rows.length === 0) {
    process.stdout.write('No host keys stored.\n')
    return
  }

  process.stdout.write(formatListRow('Host', 'Port', 'Algorithm', 'Fingerprint', 'Added'))

  for (const row of rows) {
    const fingerprint = computeFingerprint(row.key)
    const truncatedFp = fingerprint.length > 36
      ? `${fingerprint.slice(0, 36)}...`
      : fingerprint
    process.stdout.write(formatListRow(
      sanitizeForDisplay(row.host),
      String(row.port),
      sanitizeForDisplay(row.algorithm),
      truncatedFp,
      row.added_at
    ))
  }
}

function handleRemove(db: DatabaseType, target: string): void {
  const colonIndex = target.lastIndexOf(':')
  if (colonIndex <= 0) {
    process.stderr.write('Invalid format. Use: --remove host:port\n')
    return
  }

  const host = target.slice(0, colonIndex)
  const port = Number.parseInt(target.slice(colonIndex + 1), 10)

  if (Number.isNaN(port)) {
    process.stderr.write('Invalid port number.\n')
    return
  }

  const result = db.prepare('DELETE FROM host_keys WHERE host = ? AND port = ?').run(host, port)
  process.stdout.write(`Removed ${String(result.changes)} key(s) for ${sanitizeForDisplay(host)}:${port}\n`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const cli = parseArgs(process.argv)

  if (cli.command === 'help') {
    process.stdout.write(`${USAGE}\n`)
    return 0
  }

  const dbPath = resolveDbPath(cli.dbPath)

  const configuredDbPath = readConfiguredDbPath()
  const allowlist = buildDbPathAllowlist(
    process.env,
    configuredDbPath,
    process.cwd()
  )
  const validation = validateDbPath(dbPath, allowlist)
  if (!validation.ok) {
    process.stderr.write(`Error: ${validation.error}\n`)
    return 1
  }

  const db = openDb(validation.value)

  try {
    switch (cli.command) {
      case 'host': {
        if (cli.host === undefined) {
          process.stderr.write('Error: --host requires a hostname\n')
          return 1
        }
        await handleProbeHost(db, cli.host, cli.port ?? DEFAULT_PORT)
        break
      }
      case 'hosts': {
        if (cli.file === undefined) {
          process.stderr.write('Error: --hosts requires a file path\n')
          return 1
        }
        const effectiveMax = cli.maxHosts ?? DEFAULT_MAX_HOSTS
        const probeExit = await handleProbeHosts(
          db,
          cli.file,
          effectiveMax,
          cli.maxHostsExplicit
        )
        if (probeExit !== 0) {
          return probeExit
        }
        break
      }
      case 'known-hosts': {
        if (cli.file === undefined) {
          process.stderr.write('Error: --known-hosts requires a file path\n')
          return 1
        }
        handleKnownHosts(db, cli.file, cli.commit)
        break
      }
      case 'list': {
        handleList(db)
        break
      }
      case 'remove': {
        if (cli.removeTarget === undefined) {
          process.stderr.write('Error: --remove requires a host:port argument\n')
          return 1
        }
        handleRemove(db, cli.removeTarget)
        break
      }
      default: {
        const exhaustiveCheck: never = cli.command
        process.stderr.write(`Unknown command: ${exhaustiveCheck as string}\n`)
        return 1
      }
    }
  } finally {
    db.close()
  }

  return 0
}

/**
 * Returns true when this module is the program entry point.
 *
 * Combines two checks:
 *   - Canonical: import.meta.url === pathToFileURL(argv1).href. The standard
 *     ESM "is this the entry?" idiom. Rename-proof — works regardless of
 *     filename or extension.
 *   - Basename allowlist: matches the three known basenames this script can
 *     legitimately be invoked under. Acts as a safety net for cases where
 *     the canonical check fails because import.meta.url and argv1 use
 *     different path representations (macOS /tmp → /private/tmp realpath,
 *     symlinked checkouts, npm/pnpm wrapper scripts, Windows casing). Tested
 *     independently from the canonical branch.
 *
 * Pure function — exported for unit testing.
 */
export function isMainModule(
  importMetaUrl: string,
  argv1: string | undefined
): boolean {
  if (argv1 === undefined || argv1 === '') {
    return false
  }
  if (importMetaUrl === pathToFileURL(argv1).href) {
    return true
  }
  const base = basename(argv1)
  return (
    base === 'host-key-seed' ||
    base === 'host-key-seed.js' ||
    base === 'host-key-seed.ts'
  )
}

// Only run main() when executed directly (not when imported for testing).
// See isMainModule above for why both checks are needed.
const isDirectExecution = isMainModule(import.meta.url, process.argv[1])

if (isDirectExecution) {
  const exitCode = await main()
  process.exitCode = exitCode
}
