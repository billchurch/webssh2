import { spawnSync, type SpawnSyncReturns } from 'node:child_process'

export type ContainerRuntimeType = 'docker' | 'apple'

export interface ContainerConfig {
  name: string
  image: string
  ports: Array<{ host: number; container: number }>
  env: Record<string, string>
}

export interface ContainerRuntime {
  type: ContainerRuntimeType
  run(config: ContainerConfig): SpawnSyncReturns<Buffer>
  stop(containerName: string): SpawnSyncReturns<Buffer>
  inspect(containerName: string, format: string): string | null
  isAvailable(): boolean
}

class DockerRuntime implements ContainerRuntime {
  readonly type: ContainerRuntimeType = 'docker'

  isAvailable(): boolean {
    return spawnSync('docker', ['version'], { stdio: 'ignore' }).status === 0
  }

  run(config: ContainerConfig): SpawnSyncReturns<Buffer> {
    const args = [
      'run', '--rm', '-d', '--name', config.name,
      ...config.ports.flatMap(p => ['-p', `${p.host}:${p.container}`]),
      ...Object.entries(config.env).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
      config.image,
    ]
    return spawnSync('docker', args, { stdio: 'inherit' })
  }

  stop(containerName: string): SpawnSyncReturns<Buffer> {
    return spawnSync('docker', ['stop', containerName], { stdio: 'ignore' })
  }

  inspect(containerName: string, format: string): string | null {
    const res = spawnSync('docker', ['inspect', '-f', format, containerName], { encoding: 'utf8' })
    return res.status === 0 ? res.stdout.trim() : null
  }
}

class AppleContainerRuntime implements ContainerRuntime {
  readonly type: ContainerRuntimeType = 'apple'

  isAvailable(): boolean {
    return spawnSync('container', ['version'], { stdio: 'ignore' }).status === 0
  }

  run(config: ContainerConfig): SpawnSyncReturns<Buffer> {
    const args = [
      'run', '--rm', '-d', '--name', config.name,
      ...config.ports.flatMap(p => ['-p', `${p.host}:${p.container}`]),
      ...Object.entries(config.env).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
      config.image,
    ]
    return spawnSync('container', args, { stdio: 'inherit' })
  }

  stop(containerName: string): SpawnSyncReturns<Buffer> {
    return spawnSync('container', ['stop', containerName], { stdio: 'ignore' })
  }

  inspect(containerName: string, format: string): string | null {
    const res = spawnSync('container', ['inspect', '-f', format, containerName], { encoding: 'utf8' })
    return res.status === 0 ? res.stdout.trim() : null
  }
}

export function detectContainerRuntime(): ContainerRuntime {
  const appleContainer = new AppleContainerRuntime()
  if (appleContainer.isAvailable()) {
    console.log('✓ Detected Apple Container Runtime (container)')
    return appleContainer
  }

  const docker = new DockerRuntime()
  if (docker.isAvailable()) {
    console.log('✓ Detected Docker runtime')
    return docker
  }

  throw new Error('No container runtime found. Please install Docker or Apple Container Runtime (container)')
}

let cachedRuntime: ContainerRuntime | null = null

export function getContainerRuntime(): ContainerRuntime {
  if (cachedRuntime === null) {
    cachedRuntime = detectContainerRuntime()
  }
  return cachedRuntime
}