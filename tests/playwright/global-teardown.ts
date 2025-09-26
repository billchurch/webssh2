import { spawnSync } from 'node:child_process'
import { DOCKER_CONTAINER } from './constants.js'

export default function globalTeardown(): Promise<void> {
  if (process.env.ENABLE_E2E_SSH !== '1') { return Promise.resolve() }
  // Stop container if present (ignore errors)
  spawnSync('docker', ['stop', DOCKER_CONTAINER], { stdio: 'ignore' })
  return Promise.resolve()
}

