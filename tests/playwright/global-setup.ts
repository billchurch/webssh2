/* eslint-disable @typescript-eslint/explicit-function-return-type */
import * as net from 'node:net'
import { DOCKER_CONTAINER, DOCKER_IMAGE, SSH_PORT, USERNAME, PASSWORD, TIMEOUTS } from './constants.js'
import { getContainerRuntime } from './container-runtime.js'

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

  const runtime = getContainerRuntime()

  const running = runtime.inspect(DOCKER_CONTAINER, '{{.State.Running}}')
  if (running === 'true') {
    await waitForPort('127.0.0.1', SSH_PORT)
    return
  }

  const res = runtime.run({
    name: DOCKER_CONTAINER,
    image: DOCKER_IMAGE,
    ports: [{ host: SSH_PORT, container: 22 }],
    env: {
      SSH_USER: USERNAME,
      SSH_PASSWORD: PASSWORD,
      SSH_DEBUG_LEVEL: '3',
      SSH_PERMIT_PASSWORD_AUTH: 'yes',
      SSH_PERMIT_PUBKEY_AUTH: 'yes',
      SSH_CUSTOM_CONFIG: 'PermitUserEnvironment yes\nAcceptEnv FOO VAR1 VAR2 SPECIAL',
    },
  })

  if (res.status !== 0) {throw new Error('Failed to start SSH test container')}
  await waitForPort('127.0.0.1', SSH_PORT)
}

