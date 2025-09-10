#!/usr/bin/env node
/**
 * Test runner for TypeScript tests
 * Compiles TypeScript and runs tests against compiled JS
 */

import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'

async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`)
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(code)
      } else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })

    proc.on('error', reject)
  })
}

async function createJSTestFiles() {
  console.log('Creating JS test files from TS test files...')

  const testsDir = 'tests'
  const testFiles = await fs.readdir(testsDir, { recursive: true })

  for (const file of testFiles) {
    if (file.endsWith('.test.ts')) {
      const tsPath = path.join(testsDir, file)
      const jsPath = tsPath.replace('.ts', '.mjs')

      const tsContent = await fs.readFile(tsPath, 'utf8')

      // Convert TS imports to JS imports pointing to dist and strip TypeScript syntax
      const jsContent = tsContent
        .replace(/from ['"]\.\.\/app\/(.+)\.js['"]/g, "from '../dist/app/$1.js'")
        .replace(/from ['"]\.\/test-helpers\.js['"]/g, "from './test-helpers.mjs'")
        // Strip TypeScript type annotations
        .replace(/:\s*void/g, '')
        .replace(/:\s*string(\[\])?/g, '')
        .replace(/:\s*number(\[\])?/g, '')
        .replace(/:\s*boolean(\[\])?/g, '')
        .replace(/:\s*any(\[\])?/g, '')
        .replace(/:\s*unknown(\[\])?/g, '')
        .replace(/:\s*Record<[^>]+>/g, '')
        .replace(/:\s*\w+Response/g, '')
        .replace(/:\s*Mock\w+/g, '')
        .replace(/export\s+interface\s+\w+\s*{[^}]*}/gs, '')
        .replace(/interface\s+\w+\s*{[^}]*}/gs, '')
        .replace(/import\s+type\s+{[^}]+}\s+from\s+['"][^'"]+['"]/g, '')

      await fs.writeFile(jsPath, jsContent)
      console.log(`Created: ${jsPath}`)
    }
  }

  // Handle test-helpers separately
  const testHelpersTs = path.join(testsDir, 'test-helpers.ts')
  const testHelpersJs = path.join(testsDir, 'test-helpers.mjs')

  if (
    await fs
      .access(testHelpersTs)
      .then(() => true)
      .catch(() => false)
  ) {
    const helpersContent = await fs.readFile(testHelpersTs, 'utf8')
    // Strip TypeScript type annotations
    const jsHelpersContent = helpersContent
      .replace(/:\s*void/g, '')
      .replace(/:\s*string(\[\])?/g, '')
      .replace(/:\s*number(\[\])?/g, '')
      .replace(/:\s*boolean(\[\])?/g, '')
      .replace(/:\s*any(\[\])?/g, '')
      .replace(/:\s*unknown(\[\])?/g, '')
      .replace(/:\s*Record<[^>]+>/g, '')
      .replace(/export\s+interface\s+\w+\s*{[^}]*}/gs, '')
      .replace(/interface\s+\w+\s*{[^}]*}/gs, '')
      .replace(/import\s+type\s+{[^}]+}\s+from\s+['"][^'"]+['"]/g, '')
    await fs.writeFile(testHelpersJs, jsHelpersContent)
    console.log(`Created: ${testHelpersJs}`)
  }
}

async function cleanupJSTestFiles() {
  console.log('Cleaning up generated JS test files...')

  const testsDir = 'tests'
  const testFiles = await fs.readdir(testsDir, { recursive: true })

  for (const file of testFiles) {
    if (file.endsWith('.test.mjs') || file.endsWith('test-helpers.mjs')) {
      const jsPath = path.join(testsDir, file)
      try {
        await fs.unlink(jsPath)
        console.log(`Cleaned up: ${jsPath}`)
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  }
}

async function main() {
  try {
    console.log('🔨 Building TypeScript...')
    await runCommand('npm', ['run', 'build'])

    console.log('📝 Generating JS test files...')
    await createJSTestFiles()

    console.log('🧪 Running tests...')
    // Run non-Playwright tests only
    await runCommand('node', ['--test', 'tests/*.test.mjs'])
  } catch (error) {
    console.error('❌ Test run failed:', error.message)
    process.exit(1)
  } finally {
    console.log('🧹 Cleaning up...')
    await cleanupJSTestFiles()
  }
}

main()
