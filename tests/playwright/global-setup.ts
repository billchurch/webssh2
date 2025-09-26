/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { spawnSync } from 'node:child_process'
import * as net from 'node:net'
import { DOCKER_CONTAINER, DOCKER_IMAGE, SSH_PORT, USERNAME, PASSWORD, TIMEOUTS } from './constants.js'

function docker(...args: string[]) {
  return spawnSync('docker', args, { stdio: 'inherit' })
}

function dockerOutput(...args: string[]): string | null {
  const res = spawnSync('docker', args, { encoding: 'utf8' })
  if (res.status === 0) { return res.stdout.trim() }
  return null
}

async function waitForPort(host: string, port: number, timeoutMs = TIMEOUTS.DOCKER_WAIT): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise<boolean>((resolve) => {
      const s = net.createConnection({ host, port })
      s.once('connect', () => { s.end(); resolve(true) })
      s.once('error', () => resolve(false))
    })
    if (ok) {return}
    await new Promise((r) => setTimeout(r, TIMEOUTS.DOCKER_RETRY))
  }
  throw new Error(`Timeout waiting for ${host}:${port}`)
}

export default async function globalSetup() {
  if (process.env.ENABLE_E2E_SSH !== '1') {return}
  // Check docker availability
  const hasDocker = spawnSync('docker', ['version'], { stdio: 'ignore' }).status === 0
  if (!hasDocker) {throw new Error('Docker is required for E2E SSH tests')}

  const running = dockerOutput('inspect', '-f', '{{.State.Running}}', DOCKER_CONTAINER)
  if (running === 'true') {
    // Already running; reuse
    await waitForPort('127.0.0.1', SSH_PORT)
    return
  }

  const args = [
    'run', '--rm', '-d', '--name', DOCKER_CONTAINER,
    '-p', `${SSH_PORT}:22`,
    '-e', `SSH_USER=${USERNAME}`,
    '-e', `SSH_PASSWORD=${PASSWORD}`,
    '-e', 'SSH_DEBUG_LEVEL=3',
    '-e', 'SSH_PERMIT_PASSWORD_AUTH=yes',
    '-e', 'SSH_PERMIT_PUBKEY_AUTH=yes',
    '-e', 'SSH_CUSTOM_CONFIG=PermitUserEnvironment yes\nAcceptEnv FOO VAR1 VAR2 SPECIAL',
    DOCKER_IMAGE,
  ]
  const res = docker(...args)
  if (res.status !== 0) {throw new Error('Failed to start SSH test container')}
  await waitForPort('127.0.0.1', SSH_PORT)
}

