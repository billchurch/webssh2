import { DOCKER_CONTAINER } from './constants.js'
import { getContainerRuntime } from './container-runtime.js'
import { removeTestConfigFile, testConfigPaths } from './utils/test-config.js'

export default async function globalTeardown(): Promise<void> {
  // Always clean up the test config file if it exists
  const removalResult = await removeTestConfigFile(testConfigPaths.configPath)
  if (!removalResult.ok && removalResult.error.type !== 'cleanup_failed') {
    console.warn('[global-teardown] Failed to remove test config:', removalResult.error.message)
  }

  // Stop the SSH container if E2E tests were enabled
  if (process.env.ENABLE_E2E_SSH === '1') {
    const runtime = getContainerRuntime()
    runtime.stop(DOCKER_CONTAINER)
  }
}

