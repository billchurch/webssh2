import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

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
    const result = spawnSync('node', [distScript, '--help'], {
      encoding: 'utf8',
      timeout: 10_000
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('webssh2 host key management tool')
    expect(result.stdout).toContain('Show this help message')
  })
})
