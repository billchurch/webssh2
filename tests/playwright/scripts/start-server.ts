import { spawn } from 'node:child_process'
import process from 'node:process'
import { DEFAULTS } from '../../../app/constants.js'
import {
  createTestConfigFile,
  removeTestConfigFile,
  testConfigPaths,
  type ConfigFileError,
} from '../utils/test-config.js'

type ExitHandler = (exitCode: number) => Promise<void>

function parsePort(value: string | undefined, fallback: number): number {
  if (value == null) {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function formatError(error: ConfigFileError): string {
  return `[playwright:start-server] ${error.message}`
}

async function main(): Promise<void> {
  const listenPort = parsePort(process.env.WEBSSH2_LISTEN_PORT, DEFAULTS.LISTEN_PORT)
  const sshPort = parsePort(process.env.E2E_SSH_PORT, DEFAULTS.SSH_PORT)

  const configResult = await createTestConfigFile({ listenPort, sshPort })
  if (!configResult.ok) {
    console.error(formatError(configResult.error))
    process.exit(1)
    return
  }

  const configPath = configResult.value.path
  let cleanupStarted = false

  const cleanup: ExitHandler = async (exitCode) => {
    if (cleanupStarted) {
      process.exit(exitCode)
      return
    }
    cleanupStarted = true
    const removalResult = await removeTestConfigFile(configPath)
    if (!removalResult.ok) {
      console.warn(formatError(removalResult.error))
    }
    process.exit(exitCode)
  }

  const child = spawn(process.execPath, ['dist/index.js'], {
    cwd: testConfigPaths.rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      WEBSSH2_LISTEN_PORT: String(listenPort),
    },
  })

  child.on('error', (error) => {
    console.error('[playwright:start-server] Failed to start WebSSH2 server:', error)
    void cleanup(1)
  })

  child.on('exit', (code, signal) => {
    let exitCode = 0
    if (typeof code === 'number') {
      exitCode = code
    } else if (signal != null) {
      exitCode = 1
    }
    void cleanup(exitCode)
  })

  const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'] as const

  for (const signal of signals) {
    process.once(signal, () => {
      if (child.killed) {
        return
      }
      child.kill(signal)
    })
  }

  process.once('exit', () => {
    if (cleanupStarted) {
      return
    }
    void removeTestConfigFile(configPath).then((result) => {
      if (!result.ok) {
        console.warn(formatError(result.error))
      }
    }).catch((error) => {
      console.warn('[playwright:start-server] Failed to cleanup config on process exit:', error)
    })
  })
}

try {
  await main()
} catch (error: unknown) {
  console.error('[playwright:start-server] Unexpected error:', error)
  process.exit(1)
}
