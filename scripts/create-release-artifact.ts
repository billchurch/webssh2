import { join, resolve } from 'node:path'
import { isErr, ok } from '../app/utils/result.js'
import type { Result } from '../app/types/result.js'
import { hashDirectory } from './lib/hash-directory.js'
import {
  copyInto,
  createStagingDirectory,
  createTarball,
  ensureDirectory,
  ensureDirectoryExists,
  readPackageVersion,
  resolveGitSha,
  resolveTarConfig,
  safeCleanup,
  writeManifest,
  type Manifest,
  type TarConfig
} from './lib/release-fs.js'
import { writeChecksum } from './lib/release-checksum.js'

type ArtifactPaths = {
  readonly tarballPath: string
  readonly checksumPath: string
}
const SCRIPT_FILES = ['postinstall.js', 'prestart.js'] as const

type ReleasePaths = {
  readonly workspace: string
  readonly distPath: string
  readonly packageJsonPath: string
  readonly packageLockPath: string
  readonly outputDir: string
}

type ReleaseContext = {
  readonly workspace: string
  readonly distPath: string
  readonly packageJsonPath: string
  readonly packageLockPath: string
  readonly outputDir: string
  readonly manifest: Manifest
  readonly tarConfig: TarConfig
  readonly scriptFiles: readonly string[]
}

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
  const contextResult = await prepareReleaseContext()
  if (isErr(contextResult)) {
    return contextResult
  }

  const context = contextResult.value

  return withStagingDirectory(context.workspace, async (stagingDir) => {
    const stageResult = await stageReleaseContents({ stagingDir, context })
    if (isErr(stageResult)) {
      return stageResult
    }

    const tarballResult = await createTarball(
      stagingDir,
      context.outputDir,
      context.manifest.version,
      context.tarConfig
    )
    if (isErr(tarballResult)) {
      return tarballResult
    }

    const checksumResult = await writeChecksum(tarballResult.value)
    if (isErr(checksumResult)) {
      return checksumResult
    }

    return ok({
      tarballPath: tarballResult.value,
      checksumPath: checksumResult.value
    })
  })
}

function resolveReleasePaths(): ReleasePaths {
  const workspace = resolve(process.cwd())
  return {
    workspace,
    distPath: join(workspace, 'dist'),
    packageJsonPath: join(workspace, 'package.json'),
    packageLockPath: join(workspace, 'package-lock.json'),
    outputDir: join(workspace, process.env['RELEASE_ARTIFACT_DIR'] ?? 'release-artifacts')
  }
}

async function prepareReleaseContext(): Promise<Result<ReleaseContext, Error>> {
  const paths = resolveReleasePaths()

  const manifestResult = await resolveManifest(paths)
  if (isErr(manifestResult)) {
    return manifestResult
  }

  const tarConfig = await resolveTarConfig()
  if (isErr(tarConfig)) {
    return tarConfig
  }

  const ensuredOutputDir = await ensureDirectory(paths.outputDir)
  if (isErr(ensuredOutputDir)) {
    return ensuredOutputDir
  }

  return ok({
    workspace: paths.workspace,
    distPath: paths.distPath,
    packageJsonPath: paths.packageJsonPath,
    packageLockPath: paths.packageLockPath,
    outputDir: paths.outputDir,
    manifest: manifestResult.value,
    tarConfig: tarConfig.value,
    scriptFiles: SCRIPT_FILES
  })
}

async function resolveManifest(paths: ReleasePaths): Promise<Result<Manifest, Error>> {
  const distExists = await ensureDirectoryExists(paths.distPath)
  if (isErr(distExists)) {
    return distExists
  }

  const packageVersion = await readPackageVersion(paths.packageJsonPath)
  if (isErr(packageVersion)) {
    return packageVersion
  }

  const gitSha = await resolveGitSha(paths.workspace)
  if (isErr(gitSha)) {
    return gitSha
  }

  const distHash = await hashDirectory({ basePath: paths.distPath, directory: paths.distPath })
  if (isErr(distHash)) {
    return distHash
  }

  return ok({
    version: packageVersion.value,
    gitSha: gitSha.value,
    buildTime: new Date().toISOString(),
    distSha256: distHash.value
  })
}

async function withStagingDirectory<T>(
  workspace: string,
  action: (stagingDir: string) => Promise<Result<T, Error>>
): Promise<Result<T, Error>> {
  const stagingDirResult = await createStagingDirectory(workspace)
  if (isErr(stagingDirResult)) {
    return stagingDirResult
  }

  const stagingDir = stagingDirResult.value
  try {
    return await action(stagingDir)
  } finally {
    await safeCleanup(stagingDir)
  }
}

type StageReleaseInput = {
  readonly stagingDir: string
  readonly context: ReleaseContext
}

async function stageReleaseContents(input: StageReleaseInput): Promise<Result<'staged', Error>> {
  const distributionResult = await stageDistribution(input)
  if (isErr(distributionResult)) {
    return distributionResult
  }

  const metadataResult = await stageMetadataFiles(input)
  if (isErr(metadataResult)) {
    return metadataResult
  }

  const scriptsResult = await stageScriptFiles(input)
  if (isErr(scriptsResult)) {
    return scriptsResult
  }

  const manifestResult = await writeManifest(input.stagingDir, input.context.manifest)
  if (isErr(manifestResult)) {
    return manifestResult
  }

  return ok('staged')
}

async function stageDistribution(input: StageReleaseInput): Promise<Result<void, Error>> {
  const result = await copyInto(join(input.stagingDir, 'dist'), input.context.distPath)
  if (isErr(result)) {
    return result
  }
  return ok(undefined)
}

async function stageMetadataFiles(input: StageReleaseInput): Promise<Result<void, Error>> {
  const packageJsonResult = await copyInto(join(input.stagingDir, 'package.json'), input.context.packageJsonPath)
  if (isErr(packageJsonResult)) {
    return packageJsonResult
  }

  const packageLockResult = await copyInto(join(input.stagingDir, 'package-lock.json'), input.context.packageLockPath)
  if (isErr(packageLockResult)) {
    return packageLockResult
  }

  return ok(undefined)
}

async function stageScriptFiles(input: StageReleaseInput): Promise<Result<void, Error>> {
  const scriptsDirResult = await ensureDirectory(join(input.stagingDir, 'scripts'))
  if (isErr(scriptsDirResult)) {
    return scriptsDirResult
  }

  for (const scriptName of input.context.scriptFiles) {
    const scriptSource = join(input.context.workspace, 'scripts', scriptName)
    const scriptDestination = join(input.stagingDir, 'scripts', scriptName)
    const copyResult = await copyInto(scriptDestination, scriptSource)
    if (isErr(copyResult)) {
      return copyResult
    }
  }

  return ok(undefined)
}

const exitCode = await main()
process.exitCode = exitCode
