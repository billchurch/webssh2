import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import {
  cp,
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'
import { err, isErr, ok } from '../app/utils/result.js'
import type { Result } from '../app/types/result.js'

type Manifest = {
  readonly version: string
  readonly gitSha: string
  readonly buildTime: string
  readonly distSha256: string
}

type ArtifactPaths = {
  readonly tarballPath: string
  readonly checksumPath: string
}

type DirectoryHashInput = {
  readonly basePath: string
  readonly directory: string
}

type TarConfig = {
  readonly command: string
}

const execFileAsync = promisify(execFile)

async function main(): Promise<number> {
  const artifactResult = await createReleaseArtifact()
  if (isErr(artifactResult)) {
    const message = artifactResult.error instanceof Error
      ? artifactResult.error.message
      : String(artifactResult.error)
    process.stderr.write(`release artifact failed: ${message}\n`)
    return 1
  }

  const { tarballPath, checksumPath } = artifactResult.value
  process.stdout.write(`release artifact created:\n`)
  process.stdout.write(`  tarball: ${tarballPath}\n`)
  process.stdout.write(`  checksum: ${checksumPath}\n`)
  return 0
}

async function createReleaseArtifact(): Promise<Result<ArtifactPaths, Error>> {
  const workspace = resolve(process.cwd())
  const distPath = join(workspace, 'dist')
  const packageJsonPath = join(workspace, 'package.json')
  const packageLockPath = join(workspace, 'package-lock.json')
  const outputDir = join(workspace, process.env['RELEASE_ARTIFACT_DIR'] ?? 'release-artifacts')

  const distExists = await ensureDirectoryExists(distPath)
  if (isErr(distExists)) {
    return distExists
  }

  const packageVersion = await readPackageVersion(packageJsonPath)
  if (isErr(packageVersion)) {
    return packageVersion
  }

  const gitSha = await resolveGitSha(workspace)
  if (isErr(gitSha)) {
    return gitSha
  }

  const distHash = await hashDirectory({ basePath: distPath, directory: distPath })
  if (isErr(distHash)) {
    return distHash
  }

  const buildTime = new Date().toISOString()
  const manifest: Manifest = {
    version: packageVersion.value,
    gitSha: gitSha.value,
    buildTime,
    distSha256: distHash.value
  }

  const stagingDir = await createStagingDirectory(workspace)
  if (isErr(stagingDir)) {
    return stagingDir
  }

  const stageDist = await copyInto(join(stagingDir.value, 'dist'), distPath)
  if (isErr(stageDist)) {
    await safeCleanup(stagingDir.value)
    return stageDist
  }

  const stagePackageJson = await copyInto(join(stagingDir.value, 'package.json'), packageJsonPath)
  if (isErr(stagePackageJson)) {
    await safeCleanup(stagingDir.value)
    return stagePackageJson
  }

  const stagePackageLock = await copyInto(join(stagingDir.value, 'package-lock.json'), packageLockPath)
  if (isErr(stagePackageLock)) {
    await safeCleanup(stagingDir.value)
    return stagePackageLock
  }

  const scriptsDirResult = await ensureDirectory(join(stagingDir.value, 'scripts'))
  if (isErr(scriptsDirResult)) {
    await safeCleanup(stagingDir.value)
    return scriptsDirResult
  }

  const scriptFiles: readonly string[] = ['postinstall.js', 'prestart.js']
  for (const scriptName of scriptFiles) {
    const scriptSource = join(workspace, 'scripts', scriptName)
    const scriptDestination = join(stagingDir.value, 'scripts', scriptName)
    const stageScript = await copyInto(scriptDestination, scriptSource)
    if (isErr(stageScript)) {
      await safeCleanup(stagingDir.value)
      return stageScript
    }
  }

  const manifestResult = await writeManifest(stagingDir.value, manifest)
  if (isErr(manifestResult)) {
    await safeCleanup(stagingDir.value)
    return manifestResult
  }

  const tarConfig = await resolveTarConfig()
  if (isErr(tarConfig)) {
    await safeCleanup(stagingDir.value)
    return tarConfig
  }

  const ensureOutputDir = await ensureDirectory(outputDir)
  if (isErr(ensureOutputDir)) {
    await safeCleanup(stagingDir.value)
    return ensureOutputDir
  }

  const tarballResult = await createTarball(stagingDir.value, outputDir, manifest.version, tarConfig.value)
  if (isErr(tarballResult)) {
    await safeCleanup(stagingDir.value)
    return tarballResult
  }

  const checksumResult = await writeChecksum(tarballResult.value)
  await safeCleanup(stagingDir.value)
  if (isErr(checksumResult)) {
    return checksumResult
  }

  return ok({ tarballPath: tarballResult.value, checksumPath: checksumResult.value })
}

async function ensureDirectoryExists(path: string): Promise<Result<'exists', Error>> {
  try {
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

async function readPackageVersion(path: string): Promise<Result<string, Error>> {
  try {
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

async function resolveGitSha(cwd: string): Promise<Result<string, Error>> {
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

async function hashDirectory(input: DirectoryHashInput): Promise<Result<string, Error>> {
  const fileList = await listFiles(input.directory, input.basePath)
  if (isErr(fileList)) {
    return fileList
  }

  const hash = createHash('sha256')
  for (const relativePath of fileList.value) {
    const absolutePath = join(input.basePath, relativePath)
    try {
      const contents = await readFile(absolutePath)
      hash.update(relativePath)
      hash.update('\u0000')
      hash.update(contents)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error'
      return err(new Error(`failed to hash file ${absolutePath}: ${message}`))
    }
  }

  return ok(hash.digest('hex'))
}

async function listFiles(directory: string, basePath: string): Promise<Result<readonly string[], Error>> {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    const files: string[] = []
    for (const entry of entries) {
      const entryPath = join(directory, entry.name)
      if (entry.isDirectory()) {
        const nested = await listFiles(entryPath, basePath)
        if (isErr(nested)) {
          return nested
        }

        files.push(...nested.value)
      } else if (entry.isFile()) {
        files.push(relative(basePath, entryPath))
      }
    }

    files.sort()
    return ok(files)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return err(new Error(`failed to enumerate files for ${directory}: ${message}`))
  }
}

async function createStagingDirectory(workspace: string): Promise<Result<string, Error>> {
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

async function ensureDirectory(path: string): Promise<Result<'created' | 'existing', Error>> {
  try {
    await mkdir(path, { recursive: true })
    return ok('created')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return err(new Error(`failed to ensure directory ${path}: ${message}`))
  }
}

async function copyInto(destination: string, source: string): Promise<Result<'copied', Error>> {
  try {
    await cp(source, destination, { recursive: true, force: true })
    return ok('copied')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return err(new Error(`failed to copy ${source} to ${destination}: ${message}`))
  }
}

async function writeManifest(directory: string, manifest: Manifest): Promise<Result<'written', Error>> {
  try {
    const manifestPath = join(directory, 'manifest.json')
    const manifestJson = JSON.stringify(manifest, null, 2)
    await writeFile(manifestPath, `${manifestJson}\n`, { encoding: 'utf8' })
    return ok('written')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return err(new Error(`failed to write manifest: ${message}`))
  }
}

async function resolveTarConfig(): Promise<Result<TarConfig, Error>> {
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

async function createTarball(
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

async function writeChecksum(tarballPath: string): Promise<Result<string, Error>> {
  try {
    const contents = await readFile(tarballPath)
    const hash = createHash('sha256')
    hash.update(contents)
    const digest = hash.digest('hex')
    const checksumPath = `${tarballPath}.sha256`
    const line = `${digest}  ${basename(tarballPath)}\n`
    await writeFile(checksumPath, line, { encoding: 'utf8' })
    return ok(checksumPath)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return err(new Error(`failed to write checksum: ${message}`))
  }
}

async function safeCleanup(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    process.stderr.write(`cleanup warning for ${path}: ${message}\n`)
  }
}

void main().then((code) => {
  process.exitCode = code
})
