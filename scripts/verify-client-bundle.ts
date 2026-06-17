// scripts/verify-client-bundle.ts
// Verify the integrity + provenance of the installed webssh2_client browser
// bundle before it ships. Anchored to the client's release workflow via
// sigstore attestation; see issue #547. Pure logic lives in
// ./lib/client-bundle-integrity.ts — this file is the I/O adapter.

import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { isErr } from '../app/utils/result.js'
import {
  buildAttestationVerifyArgs,
  buildChecksumsUrl,
  classifyFailure,
  extractPublicChecksumLines,
  resolveClientVersionFromLockfile,
  validateClientVersion,
  withRetry,
  type FailureReason
} from './lib/client-bundle-integrity.js'

const CHECKSUMS_MAX_BYTES = 1_048_576
const DOWNLOAD_ATTEMPTS = 4
const DOWNLOAD_BASE_DELAY_MS = 1_000

/** Error carrying the classification used to decide fail-closed vs outage. */
class VerifyError extends Error {
  constructor(
    message: string,
    readonly reason: FailureReason,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'VerifyError'
  }
}

interface RunResult {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

function run(
  command: string,
  args: readonly string[],
  options: { readonly cwd?: string; readonly stdin?: string } = {}
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (error: Error) => {
      reject(error)
    })
    child.on('close', (code: number | null) => {
      resolve({ code: code ?? 1, stdout, stderr })
    })
    if (options.stdin !== undefined) {
      child.stdin.write(options.stdin)
    }
    child.stdin.end()
  })
}

async function downloadChecksums(version: string): Promise<string> {
  const url = buildChecksumsUrl(version)
  return withRetry(
    async () => {
      let response: Response
      try {
        response = await globalThis.fetch(url, { redirect: 'follow' })
      } catch (cause: unknown) {
        throw new VerifyError(`network error fetching ${url}`, 'network-unreachable', { cause })
      }
      if (response.status === 404) {
        throw new VerifyError(`checksums.txt missing for release v${version}`, 'asset-missing')
      }
      if (response.status === 429) {
        throw new VerifyError(`rate limited fetching ${url}`, 'rate-limited')
      }
      if (response.status >= 500) {
        throw new VerifyError(`server error ${response.status} fetching ${url}`, 'server-error')
      }
      if (!response.ok) {
        throw new VerifyError(`unexpected status ${response.status} fetching ${url}`, 'asset-missing')
      }
      const declared = Number(response.headers.get('content-length') ?? '0')
      if (declared > CHECKSUMS_MAX_BYTES) {
        throw new VerifyError('checksums.txt exceeds size cap', 'asset-missing')
      }
      const body = await response.text()
      if (body.length > CHECKSUMS_MAX_BYTES) {
        throw new VerifyError('checksums.txt exceeds size cap', 'asset-missing')
      }
      return body
    },
    {
      attempts: DOWNLOAD_ATTEMPTS,
      baseDelayMs: DOWNLOAD_BASE_DELAY_MS,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      shouldRetry: (error) =>
        error instanceof VerifyError && classifyFailure(error.reason) === 'outage'
    }
  )
}

async function verifyAttestation(checksumsPath: string): Promise<void> {
  let result: RunResult
  try {
    result = await run('gh', buildAttestationVerifyArgs(checksumsPath))
  } catch (cause: unknown) {
    // A missing/unusable gh CLI is an environment fault, not a bypassable
    // outage — surface it as a hard error so it can never skip verification.
    throw new Error('gh CLI is required for attestation verification but could not be launched', {
      cause
    })
  }
  if (result.code !== 0) {
    throw new VerifyError(
      `attestation verification failed:\n${result.stderr.trim()}`,
      'attestation-verification-failed'
    )
  }
}

async function verifyChecksums(checksumsText: string, clientDir: string): Promise<void> {
  const lines = extractPublicChecksumLines(checksumsText)
  if (lines.length === 0) {
    throw new VerifyError('checksums.txt listed no public/ bundle files', 'asset-missing')
  }
  const result = await run('sha256sum', ['-c', '-'], {
    cwd: clientDir,
    stdin: `${lines.join('\n')}\n`
  })
  if (result.code !== 0) {
    throw new VerifyError(
      `bundle checksum mismatch:\n${result.stdout.trim()}\n${result.stderr.trim()}`,
      'checksum-mismatch'
    )
  }
}

interface Paths {
  readonly lockfilePath: string
  readonly clientDir: string
}

function resolvePaths(): Paths {
  const workspace = process.cwd()
  return {
    lockfilePath: join(workspace, 'package-lock.json'),
    // Allows pointing at a bundle extracted from the built Docker image.
    clientDir:
      process.env['WEBSSH2_CLIENT_DIR'] ??
      join(workspace, 'node_modules', 'webssh2_client', 'client')
  }
}

async function resolveVersion(lockfilePath: string): Promise<string> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- lockfilePath is workspace-relative, not user input
  const raw = await readFile(lockfilePath, 'utf8')
  const parsed: unknown = JSON.parse(raw)
  const resolved = resolveClientVersionFromLockfile(parsed)
  if (isErr(resolved)) {
    throw new VerifyError(resolved.error, 'asset-missing')
  }
  const validated = validateClientVersion(resolved.value)
  if (isErr(validated)) {
    throw new VerifyError(validated.error, 'asset-missing')
  }
  return validated.value
}

async function verifyBundle(paths: Paths): Promise<string> {
  const version = await resolveVersion(paths.lockfilePath)
  const checksumsText = await downloadChecksums(version)
  const dir = await mkdtemp(join(tmpdir(), 'webssh2-bundle-'))
  const checksumsPath = join(dir, 'checksums.txt')
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- checksumsPath is under a freshly created mkdtemp directory
  await writeFile(checksumsPath, checksumsText, 'utf8')
  await verifyAttestation(checksumsPath)
  await verifyChecksums(checksumsText, paths.clientDir)
  return version
}

function isBypassAllowed(): boolean {
  return process.env['WEBSSH2_BUNDLE_VERIFY_OUTAGE_OVERRIDE'] === 'true'
}

async function main(): Promise<number> {
  const paths = resolvePaths()
  try {
    const version = await verifyBundle(paths)
    process.stdout.write(`✓ webssh2_client@${version} bundle verified (provenance + checksums)\n`)
    return 0
  } catch (error: unknown) {
    if (error instanceof VerifyError) {
      const failureClass = classifyFailure(error.reason)
      if (failureClass === 'outage' && isBypassAllowed()) {
        process.stderr.write(
          `⚠ bundle verification skipped — infrastructure outage (${error.reason}) and ` +
            `WEBSSH2_BUNDLE_VERIFY_OUTAGE_OVERRIDE set.\n${error.message}\n`
        )
        return 0
      }
      const label = failureClass === 'tamper' ? 'TAMPER' : 'OUTAGE'
      process.stderr.write(`✗ bundle verification failed [${label}/${error.reason}]\n${error.message}\n`)
      return 1
    }
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`✗ bundle verification error: ${message}\n`)
    return 1
  }
}

const exitCode = await main()
process.exitCode = exitCode
