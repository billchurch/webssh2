import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..', '..', '..')
const templatePath = path.resolve(__dirname, '..', 'assets', 'config.template.json')
const configPath = path.resolve(rootDir, 'config.json')

function loadTemplate() {
  const raw = readFileSync(templatePath, 'utf8')
  return JSON.parse(raw)
}

function buildConfig() {
  const template = loadTemplate()
  const listenPort = Number.parseInt(process.env.WEBSSH2_LISTEN_PORT ?? '', 10) || 4444
  const sshPort = Number.parseInt(process.env.E2E_SSH_PORT ?? '', 10) || 22

  template.listen.port = listenPort
  template.ssh.port = sshPort

  return template
}

function writeConfig(config) {
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

function cleanup() {
  if (existsSync(configPath)) {
    try {
      rmSync(configPath)
    } catch (error) {
      console.warn('[playwright:start-server] Failed to remove config.json:', error)
    }
  }
}

const config = buildConfig()
writeConfig(config)

const childEnv = {
  ...process.env,
  WEBSSH2_LISTEN_PORT: String(config.listen.port)
}

const child = spawn(process.execPath, ['dist/index.js'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: childEnv
})

child.on('error', (error) => {
  console.error('[playwright:start-server] Failed to start WebSSH2 server:', error)
  cleanup()
  process.exit(1)
})

const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT']

for (const signal of signals) {
  process.on(signal, () => {
    if (child.killed) {
      return
    }
    child.kill(signal)
  })
}

process.on('exit', () => {
  cleanup()
})

child.on('exit', (code, signal) => {
  cleanup()
  const exitCode = code ?? (typeof signal === 'string' ? 1 : 0)
  process.exit(exitCode)
})
