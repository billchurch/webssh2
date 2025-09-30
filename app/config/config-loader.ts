// app/config/config-loader.ts
// I/O operations for loading configuration (separated from pure logic)

import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'
import type { Result } from '../types/result.js'
import { ok, err } from '../utils/index.js'

export type ConfigFileLocation = 'currentWorkingDirectory' | 'parentDirectory'

export interface ConfigFileResolution {
  location: ConfigFileLocation
  exists: boolean
}

export function resolveConfigFile(): ConfigFileResolution {
  if (existsSync('config.json')) {
    return { location: 'currentWorkingDirectory', exists: true }
  }

  if (existsSync('../config.json')) {
    return { location: 'parentDirectory', exists: true }
  }

  return { location: 'currentWorkingDirectory', exists: false }
}

export function configLocationToPath(location: ConfigFileLocation): string {
  if (location === 'currentWorkingDirectory') {
    return path.resolve('config.json')
  }
  return path.resolve('..', 'config.json')
}

export async function readConfigFile(location: ConfigFileLocation): Promise<Result<string, Error>> {
  if (location === 'currentWorkingDirectory') {
    return readConfigFromCurrentDirectory()
  }
  return readConfigFromParentDirectory()
}

async function readConfigFromCurrentDirectory(): Promise<Result<string, Error>> {
  try {
    await fs.access('config.json')
    const data = await fs.readFile('config.json', 'utf8')
    return ok(data)
  } catch (error) {
    if (error instanceof Error) {
      return err(error)
    }
    return err(new Error(String(error)))
  }
}

async function readConfigFromParentDirectory(): Promise<Result<string, Error>> {
  try {
    await fs.access('../config.json')
    const data = await fs.readFile('../config.json', 'utf8')
    return ok(data)
  } catch (error) {
    if (error instanceof Error) {
      return err(error)
    }
    return err(new Error(String(error)))
  }
}
