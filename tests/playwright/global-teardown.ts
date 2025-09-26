import { DOCKER_CONTAINER } from './constants.js'
import { getContainerRuntime } from './container-runtime.js'

export default function globalTeardown(): Promise<void> {
  if (process.env.ENABLE_E2E_SSH !== '1') { return Promise.resolve() }
  const runtime = getContainerRuntime()
  runtime.stop(DOCKER_CONTAINER)
  return Promise.resolve()
}

