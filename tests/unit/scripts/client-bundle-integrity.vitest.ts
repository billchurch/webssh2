import { describe, expect, it } from 'vitest'

import {
  buildAttestationVerifyArgs,
  buildChecksumsUrl,
  CLIENT_CERT_IDENTITY,
  CLIENT_REPO,
  classifyFailure,
  extractPublicChecksumLines,
  MINIMUM_CLIENT_VERSION,
  resolveClientVersionFromLockfile,
  validateClientVersion,
  withRetry
} from '../../../scripts/lib/client-bundle-integrity.js'

const aLockfile = (overrides?: Record<string, unknown>): Record<string, unknown> => ({
  lockfileVersion: 3,
  packages: {
    'node_modules/webssh2_client': {
      version: '5.1.0',
      resolved: 'https://registry.npmjs.org/webssh2_client/-/webssh2_client-5.1.0.tgz',
      integrity: 'sha512-deadbeef'
    }
  },
  ...overrides
})

describe('validateClientVersion', () => {
  it('accepts a strict semver at or above the minimum floor', () => {
    const result = validateClientVersion('5.1.0')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('5.1.0')
    }
  })

  it('accepts a version above the floor', () => {
    const result = validateClientVersion('5.2.3')
    expect(result.ok).toBe(true)
  })

  it('exposes 5.1.0 as the minimum client version', () => {
    expect(MINIMUM_CLIENT_VERSION).toBe('5.1.0')
  })

  it('rejects a version below the floor (no checksums/attestation)', () => {
    const result = validateClientVersion('5.0.0')
    expect(result.ok).toBe(false)
  })

  it('rejects a prerelease/build-metadata version as non-strict', () => {
    const result = validateClientVersion('5.1.0-beta.1')
    expect(result.ok).toBe(false)
  })

  it('rejects a version carrying shell metacharacters', () => {
    const result = validateClientVersion('5.1.0; rm -rf /')
    expect(result.ok).toBe(false)
  })

  it('rejects a version attempting path traversal', () => {
    const result = validateClientVersion('5.1.0/../../other-repo')
    expect(result.ok).toBe(false)
  })

  it('rejects an empty string', () => {
    const result = validateClientVersion('')
    expect(result.ok).toBe(false)
  })
})

describe('resolveClientVersionFromLockfile', () => {
  it('extracts the webssh2_client version from a lockfile v3 packages entry', () => {
    const result = resolveClientVersionFromLockfile(aLockfile())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('5.1.0')
    }
  })

  it('rejects a lockfile older than version 3', () => {
    const result = resolveClientVersionFromLockfile(aLockfile({ lockfileVersion: 2 }))
    expect(result.ok).toBe(false)
  })

  it('rejects a lockfile missing the webssh2_client package entry', () => {
    const result = resolveClientVersionFromLockfile(aLockfile({ packages: {} }))
    expect(result.ok).toBe(false)
  })

  it('rejects a non-object input', () => {
    const result = resolveClientVersionFromLockfile('not-a-lockfile')
    expect(result.ok).toBe(false)
  })

  it('does not read inherited prototype properties as the package entry', () => {
    const result = resolveClientVersionFromLockfile(aLockfile({ packages: Object.create({ 'node_modules/webssh2_client': { version: '9.9.9' } }) }))
    expect(result.ok).toBe(false)
  })
})

describe('buildChecksumsUrl', () => {
  it('builds the v<version>-tagged release asset URL', () => {
    expect(buildChecksumsUrl('5.1.0')).toBe(
      'https://github.com/billchurch/webssh2_client/releases/download/v5.1.0/checksums.txt'
    )
  })
})

describe('buildAttestationVerifyArgs', () => {
  const args = buildAttestationVerifyArgs('checksums.txt')

  it('verifies the provided file', () => {
    expect(args.slice(0, 3)).toEqual(['attestation', 'verify', 'checksums.txt'])
  })

  it('pins the source repository', () => {
    const i = args.indexOf('--repo')
    expect(i).toBeGreaterThan(-1)
    expect(args[i + 1]).toBe(CLIENT_REPO)
  })

  it('pins the certificate identity to the release workflow on refs/heads/main (provenance, not just "an attestation exists")', () => {
    const i = args.indexOf('--cert-identity')
    expect(i).toBeGreaterThan(-1)
    expect(args[i + 1]).toBe(CLIENT_CERT_IDENTITY)
    expect(CLIENT_CERT_IDENTITY).toBe(
      'https://github.com/billchurch/webssh2_client/.github/workflows/release.yml@refs/heads/main'
    )
  })

  it('does not combine mutually exclusive signer flags (gh rejects --cert-identity with --signer-workflow)', () => {
    expect(args).not.toContain('--signer-workflow')
    expect(args).not.toContain('--signer-repo')
    expect(args).not.toContain('--cert-identity-regex')
  })
})

describe('extractPublicChecksumLines', () => {
  const checksums = [
    '# webssh2_client v5.1.0 SHA-256 checksums',
    'aaaa1111  client-public.zip',
    'bbbb2222  public/index.html',
    'cccc3333  public/assets/app.js',
    '',
    'dddd4444  some/other/path'
  ].join('\n')

  it('keeps only the public/ bundle lines', () => {
    const lines = extractPublicChecksumLines(checksums)
    expect(lines).toEqual([
      'bbbb2222  public/index.html',
      'cccc3333  public/assets/app.js'
    ])
  })

  it('returns no lines when the file lists nothing under public/', () => {
    expect(extractPublicChecksumLines('aaaa1111  client-public.zip')).toEqual([])
  })
})

describe('classifyFailure', () => {
  it('treats a failed attestation verification as tamper (fail closed)', () => {
    expect(classifyFailure('attestation-verification-failed')).toBe('tamper')
  })

  it('treats a checksum mismatch as tamper', () => {
    expect(classifyFailure('checksum-mismatch')).toBe('tamper')
  })

  it('treats a missing asset on a >=5.1.0 release as tamper', () => {
    expect(classifyFailure('asset-missing')).toBe('tamper')
  })

  it('treats an invalid registry signature as tamper', () => {
    expect(classifyFailure('signature-invalid')).toBe('tamper')
  })

  it('treats an unreachable network as an outage (override path)', () => {
    expect(classifyFailure('network-unreachable')).toBe('outage')
  })

  it('treats rate limiting as an outage', () => {
    expect(classifyFailure('rate-limited')).toBe('outage')
  })

  it('treats an upstream 5xx as an outage', () => {
    expect(classifyFailure('server-error')).toBe('outage')
  })
})

describe('withRetry', () => {
  const noSleep = (): Promise<void> => Promise.resolve()

  it('returns the value on first success without sleeping', async () => {
    const sleeps: number[] = []
    const value = await withRetry(() => Promise.resolve('ok'), {
      attempts: 3,
      baseDelayMs: 100,
      sleep: (ms) => {
        sleeps.push(ms)
        return Promise.resolve()
      }
    })
    expect(value).toBe('ok')
    expect(sleeps).toEqual([])
  })

  it('retries a throwing operation and succeeds on a later attempt', async () => {
    let attempts = 0
    const value = await withRetry(
      () => {
        attempts += 1
        if (attempts < 3) {
          return Promise.reject(new Error('transient'))
        }
        return Promise.resolve('recovered')
      },
      { attempts: 3, baseDelayMs: 100, sleep: noSleep }
    )
    expect(value).toBe('recovered')
    expect(attempts).toBe(3)
  })

  it('uses exponential backoff between attempts', async () => {
    const sleeps: number[] = []
    await expect(
      withRetry(() => Promise.reject(new Error('down')), {
        attempts: 3,
        baseDelayMs: 100,
        sleep: (ms) => {
          sleeps.push(ms)
          return Promise.resolve()
        }
      })
    ).rejects.toThrow('down')
    expect(sleeps).toEqual([100, 200])
  })

  it('rethrows the last error after exhausting attempts', async () => {
    let attempts = 0
    await expect(
      withRetry(
        () => {
          attempts += 1
          return Promise.reject(new Error(`fail-${attempts}`))
        },
        { attempts: 2, baseDelayMs: 1, sleep: noSleep }
      )
    ).rejects.toThrow('fail-2')
    expect(attempts).toBe(2)
  })

  it('does not retry when shouldRetry returns false', async () => {
    let attempts = 0
    await expect(
      withRetry(
        () => {
          attempts += 1
          return Promise.reject(new Error('tamper'))
        },
        {
          attempts: 5,
          baseDelayMs: 1,
          sleep: noSleep,
          shouldRetry: () => false
        }
      )
    ).rejects.toThrow('tamper')
    expect(attempts).toBe(1)
  })
})
