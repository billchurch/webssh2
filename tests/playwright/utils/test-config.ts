import { access, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import * as path from 'node:path'
import type { Result } from '../../../app/types/result.js'
import { ok, err, isRecord } from '../../../app/utils/index.js'
import { DEFAULTS } from '../../../app/constants.js'

type NumericPort = number & { readonly __brand: unique symbol }

interface TestConfigTemplate extends Record<string, unknown> {
  readonly listen: Record<string, unknown>
  readonly ssh: Record<string, unknown>
}

export interface ConfigFileError {
  readonly type:
    | 'config_exists'
    | 'check_failed'
    | 'template_read_failed'
    | 'template_parse_failed'
    | 'config_write_failed'
    | 'cleanup_failed'
  readonly message: string
  readonly cause?: unknown
}

interface CreateTestConfigOptions {
  readonly listenPort?: number
  readonly sshPort?: number
}

interface ConfigArtifact {
  readonly path: string
  readonly config: Record<string, unknown>
}

interface ConfigManagerDependencies {
  readonly checkExists: (filePath: string) => Promise<Result<'exists' | 'missing', ConfigFileError>>
  readonly readTemplate: (filePath: string) => Promise<Result<string, ConfigFileError>>
  readonly writeConfig: (filePath: string, contents: string) => Promise<Result<void, ConfigFileError>>
  readonly removeConfig: (filePath: string) => Promise<Result<void, ConfigFileError>>
}

const CURRENT_FILE = fileURLToPath(import.meta.url)
const CURRENT_DIR = path.dirname(CURRENT_FILE)
const ROOT_DIR = path.resolve(CURRENT_DIR, '../../..')
const TEMPLATE_PATH = path.resolve(CURRENT_DIR, '..', 'assets', 'config.template.json')
const CONFIG_PATH = path.resolve(ROOT_DIR, 'config.json')

interface ErrnoLike {
  readonly code?: unknown
}

function extractErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined
  }
  const maybeCode = (error as ErrnoLike).code
  return typeof maybeCode === 'string' ? maybeCode : undefined
}

function isAllowedPath(filePath: string, expected: string): boolean {
  return path.resolve(filePath) === expected
}

const defaultDependencies: ConfigManagerDependencies = {
  async checkExists(filePath) {
    if (!isAllowedPath(filePath, CONFIG_PATH)) {
      return err({
        type: 'check_failed',
        message: `Access to ${filePath} is not permitted`,
      })
    }
    try {
      await access(CONFIG_PATH)
      return ok('exists')
    } catch (error: unknown) {
      if (extractErrorCode(error) === 'ENOENT') {
        return ok('missing')
      }
      return err({
        type: 'check_failed',
        message: `Failed to check for existing config at ${CONFIG_PATH}`,
        cause: error,
      })
    }
  },
  async readTemplate(filePath) {
    if (!isAllowedPath(filePath, TEMPLATE_PATH)) {
      return err({
        type: 'template_read_failed',
        message: `Access to ${filePath} is not permitted`,
      })
    }
    try {
      const contents = await readFile(TEMPLATE_PATH, 'utf8')
      return ok(contents)
    } catch (error: unknown) {
      return err({
        type: 'template_read_failed',
        message: `Unable to read template config at ${TEMPLATE_PATH}`,
        cause: error,
      })
    }
  },
  async writeConfig(filePath, contents) {
    if (!isAllowedPath(filePath, CONFIG_PATH)) {
      return err({
        type: 'config_write_failed',
        message: `Access to ${filePath} is not permitted`,
      })
    }
    try {
      await writeFile(CONFIG_PATH, contents, 'utf8')
      return ok(undefined)
    } catch (error: unknown) {
      return err({
        type: 'config_write_failed',
        message: `Failed to write test config to ${CONFIG_PATH}`,
        cause: error,
      })
    }
  },
  async removeConfig(filePath) {
    if (!isAllowedPath(filePath, CONFIG_PATH)) {
      return err({
        type: 'cleanup_failed',
        message: `Access to ${filePath} is not permitted`,
      })
    }
    try {
      await rm(CONFIG_PATH, { force: true })
      return ok(undefined)
    } catch (error: unknown) {
      return err({
        type: 'cleanup_failed',
        message: `Failed to remove test config at ${CONFIG_PATH}`,
        cause: error,
      })
    }
  },
}

function toPort(value: number | undefined, fallback: number): NumericPort {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value) || value <= 0) {
    return fallback as NumericPort
  }
  return Math.trunc(value) as NumericPort
}

function parseTemplate(contents: string): Result<TestConfigTemplate, ConfigFileError> {
  try {
    const parsed = JSON.parse(contents) as unknown
    if (!isRecord(parsed)) {
      return err({
        type: 'template_parse_failed',
        message: 'Template config must be an object',
      })
    }
    const listen = isRecord(parsed.listen) ? parsed.listen : {}
    const ssh = isRecord(parsed.ssh) ? parsed.ssh : {}
    return ok({
      ...parsed,
      listen,
      ssh,
    })
  } catch (error: unknown) {
    return err({
      type: 'template_parse_failed',
      message: 'Template config contains invalid JSON',
      cause: error,
    })
  }
}

type AppliedConfig = Record<string, unknown> & {
  readonly listen: Record<string, unknown>
  readonly ssh: Record<string, unknown>
}

function applyOverrides(
  template: TestConfigTemplate,
  overrides: { readonly listenPort: NumericPort; readonly sshPort: NumericPort }
): AppliedConfig {
  const listen = {
    ...template.listen,
    port: overrides.listenPort,
  }
  const ssh = {
    ...template.ssh,
    port: overrides.sshPort,
  }
  return {
    ...template,
    listen,
    ssh,
  }
}

function serializeConfig(config: AppliedConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`
}

export async function createTestConfigFile(
  options: CreateTestConfigOptions = {},
  dependencies: ConfigManagerDependencies = defaultDependencies
): Promise<Result<ConfigArtifact, ConfigFileError>> {
  const existenceResult = await dependencies.checkExists(CONFIG_PATH)
  if (!existenceResult.ok) {
    return existenceResult
  }
  if (existenceResult.value === 'exists') {
    return err({
      type: 'config_exists',
      message: `A config.json already exists at ${CONFIG_PATH}. Remove it before running E2E tests.`,
    })
  }

  const templateResult = await dependencies.readTemplate(TEMPLATE_PATH)
  if (!templateResult.ok) {
    return templateResult
  }

  const parsedTemplate = parseTemplate(templateResult.value)
  if (!parsedTemplate.ok) {
    return parsedTemplate
  }

  const listenPort = toPort(options.listenPort, DEFAULTS.LISTEN_PORT)
  const sshPort = toPort(options.sshPort, DEFAULTS.SSH_PORT)
  const config = applyOverrides(parsedTemplate.value, { listenPort, sshPort })
  const persistResult = await dependencies.writeConfig(CONFIG_PATH, serializeConfig(config))
  if (!persistResult.ok) {
    return persistResult
  }

  return ok({ path: CONFIG_PATH, config })
}

export async function removeTestConfigFile(
  filePath: string = CONFIG_PATH,
  dependencies: ConfigManagerDependencies = defaultDependencies
): Promise<Result<void, ConfigFileError>> {
  const removalResult = await dependencies.removeConfig(filePath)
  if (!removalResult.ok) {
    return removalResult
  }
  return ok(undefined)
}

export const testConfigPaths = {
  rootDir: ROOT_DIR,
  templatePath: TEMPLATE_PATH,
  configPath: CONFIG_PATH,
} as const
