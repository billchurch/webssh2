import { execFile } from 'node:child_process'
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { err, isErr, ok } from '../../app/utils/result.js'
import type { Result } from '../../app/types/result.js'

export type Manifest = {
  readonly version: string
  readonly gitSha: string
  readonly buildTime: string
  readonly distSha256: string
}

export type TarConfig = {
  readonly command: string
}

const execFileAsync = promisify(execFile)

export async function ensureDirectoryExists(path: string): Promise<Result<'exists', Error>> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is derived from workspace-resolved release directories
    const stats = await stat(path)
    if (stats.isDirectory()) {
      return ok('exists')
    }

    return err(new Error(`expected directory at ${path}`))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return err(new Error(`missing build output directory ${path}: ${message}`))
  }
}

export async function readPackageVersion(path: string): Promise<Result<string, Error>> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path targets package.json inside controlled workspace
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) {
      return err(new Error(`package.json at ${path} is not an object`))
    }

    const versionCandidate = (parsed as { version?: unknown }).version
    if (typeof versionCandidate !== 'string' || versionCandidate.length === 0) {
      return err(new Error(`package.json at ${path} does not contain a valid version`))
    }

    return ok(versionCandidate)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return err(new Error(`failed to read package.json: ${message}`))
  }
}

export async function resolveGitSha(cwd: string): Promise<Result<string, Error>> {
  try {
    const result = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd })
    const sha = result.stdout.toString().trim()
    if (sha.length === 0) {
      return err(new Error('git returned an empty sha'))
    }

    return ok(sha)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return err(new Error(`failed to resolve git sha: ${message}`))
  }
}

export async function createStagingDirectory(workspace: string): Promise<Result<string, Error>> {
  try {
    const parentPath = join(tmpdir(), 'webssh2-artifacts')
    const parentResult = await ensureDirectory(parentPath)
    if (isErr(parentResult)) {
      return parentResult
    }

    const stagingPath = await mkdtemp(join(parentPath, 'webssh2-'))
    return ok(stagingPath)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return err(new Error(`failed to create staging directory in ${workspace}: ${message}`))
  }
}

export async function ensureDirectory(path: string): Promise<Result<'created' | 'existing', Error>> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path references staging directory tree inside tmpdir
    await mkdir(path, { recursive: true })
    return ok('created')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return err(new Error(`failed to ensure directory ${path}: ${message}`))
  }
}

export async function copyInto(destination: string, source: string): Promise<Result<'copied', Error>> {
  try {
    await cp(source, destination, { recursive: true, force: true })
    return ok('copied')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return err(new Error(`failed to copy ${source} to ${destination}: ${message}`))
  }
}

export async function writeManifest(directory: string, manifest: Manifest): Promise<Result<'written', Error>> {
  try {
    const manifestPath = join(directory, 'manifest.json')
    const manifestJson = JSON.stringify(manifest, null, 2)
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- manifestPath is created within stagingDir
    await writeFile(manifestPath, `${manifestJson}\n`, { encoding: 'utf8' })
    return ok('written')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return err(new Error(`failed to write manifest: ${message}`))
  }
}

export async function resolveTarConfig(): Promise<Result<TarConfig, Error>> {
  const candidates = ['tar', 'gtar']
  for (const candidate of candidates) {
    const versionResult = await readTarVersion(candidate)
    if (isErr(versionResult)) {
      continue
    }

    if (versionResult.value.includes('GNU tar')) {
      return ok({ command: candidate })
    }
  }

  return err(new Error('GNU tar is required to create reproducible archives'))
}

async function readTarVersion(command: string): Promise<Result<string, Error>> {
  try {
    const result = await execFileAsync(command, ['--version'])
    return ok(result.stdout.toString())
  } catch (error: unknown) {
    const actualError = error instanceof Error ? error : new Error(String(error))
    return err(new Error(`unable to execute ${command}`, { cause: actualError }))
  }
}

export async function createTarball(
  stagingDir: string,
  outputDir: string,
  version: string,
  tarConfig: TarConfig
): Promise<Result<string, Error>> {
  const tarballPath = join(outputDir, `webssh2-${version}.tar.gz`)
  try {
    const args = [
      '--sort=name',
      '--owner=0',
      '--group=0',
      '--numeric-owner',
      '--mtime=@0',
      '-czf',
      tarballPath,
      '-C',
      stagingDir,
      '.'
    ]
    await execFileAsync(tarConfig.command, args)
    return ok(tarballPath)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return err(new Error(`failed to create tarball: ${message}`))
  }
}

export async function safeCleanup(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    process.stderr.write(`cleanup warning for ${path}: ${message}\n`)
  }
}
