import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Packages must arrive through package-lock.json (pinned, integrity-checked,
// quarantined), never from a script that installs them at install time.

const repoRoot = join(import.meta.dirname, '..', '..', '..')

type PackageJson = {
  readonly scripts: Readonly<Record<string, string>>
}

const readText = (relativePath: string): string =>
  readFileSync(join(repoRoot, relativePath), 'utf8')

const packageJson = JSON.parse(readText('package.json')) as PackageJson

// Lifecycle scripts npm runs on its own during `npm install` / `npm ci`.
const INSTALL_LIFECYCLE_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepare'] as const

// `npm install` and its common aliases.
const NPM_INSTALL_PATTERN = /\bnpm\s+(?:install|i|add|in)\b/

describe('install-time lifecycle scripts', () => {
  it.each(INSTALL_LIFECYCLE_SCRIPTS)('package.json defines no %s script', (name) => {
    expect(Object.hasOwn(packageJson.scripts, name)).toBe(false)
  })

  it('no package.json script runs npm install', () => {
    const offenders = Object.entries(packageJson.scripts)
      .filter(([, command]) => NPM_INSTALL_PATTERN.test(command))
      .map(([name]) => name)
    expect(offenders).toEqual([])
  })

  it('prepare:runtime stays a no-op that runs no script file', () => {
    const command = packageJson.scripts['prepare:runtime']
    expect(command).toBeDefined()
    expect(command).not.toMatch(/\bnode\b|\bnpm\b|\bnpx\b/)
  })

  it('scripts/postinstall.js is gone', () => {
    expect(existsSync(join(repoRoot, 'scripts', 'postinstall.js'))).toBe(false)
  })

  it('the release artifact does not stage postinstall.js', () => {
    expect(readText('scripts/create-release-artifact.ts')).not.toContain('postinstall.js')
  })

  it.each(['.github/workflows/ci.yml', '.devcontainer/scripts/tools.sh'])(
    '%s does not run prepare:runtime after an --ignore-scripts install',
    (file) => {
      expect(readText(file)).not.toContain('prepare:runtime')
    }
  )
})
