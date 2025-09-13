import { spawnSync } from 'node:child_process'
import { DOCKER_CONTAINER } from './constants.js'

export default async function globalTeardown() {
  if (process.env.ENABLE_E2E_SSH !== '1') return
  // Stop container if present (ignore errors)
  spawnSync('docker', ['stop', DOCKER_CONTAINER], { stdio: 'ignore' })
}

