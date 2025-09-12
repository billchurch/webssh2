import { spawnSync } from 'node:child_process'

export default async function globalTeardown() {
  if (process.env.ENABLE_E2E_SSH !== '1') return
  // Stop container if present (ignore errors)
  spawnSync('docker', ['stop', 'webssh2-e2e-sshd'], { stdio: 'ignore' })
}

