// app/config/config-loader.ts
// I/O operations for loading configuration (separated from pure logic)

import { promises as fs } from 'fs'
import type { Result } from '../types/result.js'
import { ok, err } from '../utils/result.js'

/**
 * Read configuration file
 * I/O operation - not pure
 * 
 * @param configPath - Path to configuration file
 * @returns Result with file contents or error
 */
export async function readConfigFile(configPath: string): Promise<Result<string, Error>> {
  try {
    await fs.access(configPath)
    // Configuration path is from internal application config, not user input
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const data = await fs.readFile(configPath, 'utf8')
    return ok(data)
  } catch (error) {
    if (error instanceof Error) {
      return err(error)
    }
    return err(new Error(String(error)))
  }
}