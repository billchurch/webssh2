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
import path from 'node:path'
import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { Client as SSH2Client } from 'ssh2'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PORT = 22
const PROBE_TIMEOUT_MS = 15_000
const READY_TIMEOUT_MS = 10_000

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
  --known-hosts <file>                Import keys from an OpenSSH known_hosts file
  --list                              List all stored host keys
  --remove <host:port>                Remove all keys for a host:port pair
  --help                              Show this help message

Options:
  --db <path>                         Database file path
                                      (default: config.json ssh.hostKeyVerification.serverStore.dbPath
                                       or /data/hostkeys.db)

Examples:
  npm run hostkeys -- --host example.com
  npm run hostkeys -- --host example.com --port 2222
  npm run hostkeys -- --hosts servers.txt
  npm run hostkeys -- --known-hosts ~/.ssh/known_hosts
  npm run hostkeys -- --list
  npm run hostkeys -- --list --db /custom/path/hostkeys.db
  npm run hostkeys -- --remove example.com:22
`.trim()

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
// known_hosts parsing
// ---------------------------------------------------------------------------

interface KnownHostEntry {
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
function extractDbPathFromConfig(config: unknown): string | undefined {
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

function resolveDbPath(explicitPath: string | undefined): string {
  if (explicitPath !== undefined) {
    return explicitPath
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

interface CliArgs {
  command: 'host' | 'hosts' | 'known-hosts' | 'list' | 'remove' | 'help'
  host?: string | undefined
  port?: number | undefined
  file?: string | undefined
  removeTarget?: string | undefined
  dbPath?: string | undefined
}

function nextArg(args: readonly string[], index: number): string | undefined {
  const next = index + 1
  return next < args.length ? args.at(next) : undefined
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args = argv.slice(2) // skip node and script path
  let command: CliArgs['command'] = 'help'
  let host: string | undefined
  let port: number | undefined
  let file: string | undefined
  let removeTarget: string | undefined
  let dbPath: string | undefined

  for (let i = 0; i < args.length; i++) {
    const arg = args.at(i)

    if (arg === '--help' || arg === '-h') {
      command = 'help'
    } else if (arg === '--host') {
      command = 'host'
      host = nextArg(args, i)
      i++
    } else if (arg === '--port') {
      const portStr = nextArg(args, i)
      i++
      if (portStr !== undefined) {
        port = Number.parseInt(portStr, 10)
      }
    } else if (arg === '--hosts') {
      command = 'hosts'
      file = nextArg(args, i)
      i++
    } else if (arg === '--known-hosts') {
      command = 'known-hosts'
      file = nextArg(args, i)
      i++
    } else if (arg === '--list') {
      command = 'list'
    } else if (arg === '--remove') {
      command = 'remove'
      removeTarget = nextArg(args, i)
      i++
    } else if (arg === '--db') {
      dbPath = nextArg(args, i)
      i++
    }
  }

  return { command, host, port, file, removeTarget, dbPath }
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function handleProbeHost(
  db: DatabaseType,
  host: string,
  port: number
): Promise<void> {
  process.stdout.write(`Probing ${host}:${port}...\n`)
  try {
    const result = await probeHostKey(host, port)
    upsertKey(db, host, port, result.algorithm, result.key)
    const fingerprint = computeFingerprint(result.key)
    process.stdout.write(`Added ${result.algorithm} key for ${host}:${port}\n`)
    process.stdout.write(`Fingerprint: ${fingerprint}\n`)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`Error probing ${host}:${port}: ${message}\n`)
  }
}

async function handleProbeHosts(
  db: DatabaseType,
  filePath: string
): Promise<void> {
  if (!fs.existsSync(filePath)) {
    process.stderr.write(`File not found: ${filePath}\n`)
    return
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n').filter((line) => {
    const trimmed = line.trim()
    return trimmed !== '' && !trimmed.startsWith('#')
  })

  for (const line of lines) {
    const trimmed = line.trim()
    const colonIndex = trimmed.lastIndexOf(':')

    let host: string
    let port: number

    if (colonIndex > 0) {
      host = trimmed.slice(0, colonIndex)
      port = Number.parseInt(trimmed.slice(colonIndex + 1), 10)
      if (Number.isNaN(port)) {
        host = trimmed
        port = DEFAULT_PORT
      }
    } else {
      host = trimmed
      port = DEFAULT_PORT
    }

    await handleProbeHost(db, host, port)
  }
}

function handleKnownHosts(
  db: DatabaseType,
  filePath: string
): void {
  if (!fs.existsSync(filePath)) {
    process.stderr.write(`File not found: ${filePath}\n`)
    return
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const entries = parseKnownHosts(content)

  if (entries.length === 0) {
    process.stdout.write('No valid entries found in known_hosts file.\n')
    return
  }

  let imported = 0
  for (const entry of entries) {
    upsertKey(db, entry.host, entry.port, entry.algorithm, entry.key)
    imported++
  }

  process.stdout.write(`Imported ${String(imported)} key(s) from ${filePath}\n`)
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
      row.host,
      String(row.port),
      row.algorithm,
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
  process.stdout.write(`Removed ${String(result.changes)} key(s) for ${host}:${port}\n`)
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
  const db = openDb(dbPath)

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
        await handleProbeHosts(db, cli.file)
        break
      }
      case 'known-hosts': {
        if (cli.file === undefined) {
          process.stderr.write('Error: --known-hosts requires a file path\n')
          return 1
        }
        handleKnownHosts(db, cli.file)
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

const exitCode = await main()
process.exitCode = exitCode
