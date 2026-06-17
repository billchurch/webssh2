// scripts/lib/client-bundle-integrity.ts
// Pure logic for verifying the integrity + provenance of the webssh2_client
// browser bundle this gateway ships. I/O (network, subprocess) lives in the
// script entry point; everything here is pure and unit-testable.

import { err, ok } from '../../app/utils/result.js'
import type { Result } from '../../app/types/result.js'

/**
 * First webssh2_client release carrying both `checksums.txt` and the sigstore
 * attestation of it. Releases below this floor ship only `client-public.zip`
 * and cannot be verified, so they are rejected.
 */
export const MINIMUM_CLIENT_VERSION = '5.1.0'

const STRICT_SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

const CLIENT_PACKAGE_PATH = 'node_modules/webssh2_client'

/** Source repository that builds and attests the client bundle. */
export const CLIENT_REPO = 'billchurch/webssh2_client'

/**
 * The exact workflow that runs `actions/attest-build-provenance` in the client
 * repo. Pinning this is what makes verification prove provenance — `--repo`
 * alone would pass for any workflow in the repo, including a malicious one.
 */
export const CLIENT_SIGNER_WORKFLOW =
  'billchurch/webssh2_client/.github/workflows/release.yml'

/**
 * Full sigstore certificate identity (SAN), pinning both the signer workflow
 * and its ref. `release.yml` triggers on push to `main` (release-please), so
 * the signing ref is `refs/heads/main`, not a tag. Passed via `--cert-identity`
 * — which is strictly stronger than `--signer-workflow` (it also pins the ref)
 * and is mutually exclusive with it in the `gh` CLI.
 */
export const CLIENT_CERT_IDENTITY = `https://github.com/${CLIENT_SIGNER_WORKFLOW}@refs/heads/main`

/** Build the `v<version>`-tagged GitHub release asset URL for `checksums.txt`. */
export function buildChecksumsUrl(version: string): string {
  return `https://github.com/${CLIENT_REPO}/releases/download/v${version}/checksums.txt`
}

/**
 * Argv for `gh attestation verify <file>`, pinned to the client's release
 * workflow and certificate identity so the check proves the file was produced
 * by the expected workflow — not merely that some attestation exists.
 */
export function buildAttestationVerifyArgs(file: string): readonly string[] {
  return [
    'attestation',
    'verify',
    file,
    '--repo',
    CLIENT_REPO,
    '--cert-identity',
    CLIENT_CERT_IDENTITY
  ]
}

/**
 * Keep only the `public/` bundle lines from a `checksums.txt`, which are what
 * `sha256sum -c` verifies against the installed `client/public/` directory.
 */
export function extractPublicChecksumLines(checksumsText: string): string[] {
  return checksumsText
    .split('\n')
    .filter((line) => /^[0-9a-f]+ {2}public\//.test(line))
}

/**
 * Why a verification step failed. Tamper reasons mean the artifact is suspect;
 * outage reasons mean the verification infrastructure was unreachable.
 */
export type FailureReason =
  | 'attestation-verification-failed'
  | 'checksum-mismatch'
  | 'asset-missing'
  | 'signature-invalid'
  | 'network-unreachable'
  | 'rate-limited'
  | 'server-error'

/** Whether a failure should fail the build closed (tamper) or be treated as a recoverable infrastructure outage. */
export type FailureClass = 'tamper' | 'outage'

const OUTAGE_REASONS: ReadonlySet<FailureReason> = new Set([
  'network-unreachable',
  'rate-limited',
  'server-error'
])

/**
 * Classify a failure so the caller can fail closed on tamper (always) while
 * routing genuine infrastructure outages to the deliberate, audited override
 * path instead of silently skipping verification. A missing asset on a
 * `>= 5.1.0` release is tamper — those releases must ship `checksums.txt`.
 */
export function classifyFailure(reason: FailureReason): FailureClass {
  return OUTAGE_REASONS.has(reason) ? 'outage' : 'tamper'
}

export interface RetryOptions {
  /** Total attempts including the first. */
  readonly attempts: number
  /** Base backoff; attempt N waits `baseDelayMs * 2^(N-1)`. */
  readonly baseDelayMs: number
  /** Injected sleep so callers (and tests) control timing. */
  readonly sleep: (ms: number) => Promise<void>
  /** Return false to stop retrying a given error (e.g. tamper, not outage). */
  readonly shouldRetry?: (error: unknown) => boolean
}

/**
 * Run an async operation with bounded exponential-backoff retry. Used to ride
 * out transient outages of the GitHub release CDN / Attestations API / Rekor
 * without failing the build closed on a blip (A1). Tamper-class failures should
 * pass a `shouldRetry` that returns false so they fail fast.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { attempts, baseDelayMs, sleep, shouldRetry } = options
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error: unknown) {
      lastError = error
      const retryable = shouldRetry === undefined || shouldRetry(error)
      if (!retryable || attempt === attempts) {
        throw error
      }
      await sleep(baseDelayMs * 2 ** (attempt - 1))
    }
  }
  throw lastError
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Resolve the webssh2_client version from a parsed `package-lock.json` rather
 * than the installed package's self-reported `package.json` — the lockfile is
 * the version the maintainer pinned, so it is the trust anchor. Requires
 * lockfile v3+ per the supply-chain policy. Returns the raw version; callers
 * must pass it through {@link validateClientVersion} before use.
 */
export function resolveClientVersionFromLockfile(
  lockfile: unknown
): Result<string, string> {
  if (!isRecord(lockfile)) {
    return err('package-lock.json did not parse to an object')
  }
  if (lockfile['lockfileVersion'] !== 3) {
    return err('package-lock.json must be lockfileVersion 3 for deterministic resolution')
  }
  const packages = lockfile['packages']
  if (!isRecord(packages) || !Object.hasOwn(packages, CLIENT_PACKAGE_PATH)) {
    return err(`package-lock.json has no "${CLIENT_PACKAGE_PATH}" entry`)
  }
  const entry = packages['node_modules/webssh2_client']
  if (!isRecord(entry) || typeof entry['version'] !== 'string') {
    return err(`"${CLIENT_PACKAGE_PATH}" lockfile entry has no string version`)
  }
  return ok(entry['version'])
}

type SemverTuple = readonly [number, number, number]

function compareSemver(a: SemverTuple, b: SemverTuple): number {
  const [aMajor, aMinor, aPatch] = a
  const [bMajor, bMinor, bPatch] = b
  if (aMajor !== bMajor) {
    return aMajor < bMajor ? -1 : 1
  }
  if (aMinor !== bMinor) {
    return aMinor < bMinor ? -1 : 1
  }
  if (aPatch !== bPatch) {
    return aPatch < bPatch ? -1 : 1
  }
  return 0
}

const [FLOOR_MAJOR, FLOOR_MINOR, FLOOR_PATCH] = MINIMUM_CLIENT_VERSION.split('.').map(Number)
const FLOOR: SemverTuple = [FLOOR_MAJOR ?? 0, FLOOR_MINOR ?? 0, FLOOR_PATCH ?? 0]

/**
 * Validate a client version string before it is interpolated into any URL or
 * shell command. Accepts strict `major.minor.patch` semver only (no prerelease,
 * build metadata, ranges, or other characters) and enforces the minimum floor.
 */
export function validateClientVersion(raw: string): Result<string, string> {
  const match = STRICT_SEMVER.exec(raw)
  if (match === null) {
    return err(
      `client version "${raw}" is not strict semver (expected MAJOR.MINOR.PATCH)`
    )
  }
  const parsed: SemverTuple = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (compareSemver(parsed, FLOOR) < 0) {
    return err(
      `client version ${raw} is below the minimum ${MINIMUM_CLIENT_VERSION} ` +
        '(no checksums.txt/attestation in older releases)'
    )
  }
  return ok(raw)
}
