#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const testsDir = join(process.cwd(), 'tests')

interface TestFile {
  path: string
  isTypeScript: boolean
}

function walk(dir: string): TestFile[] {
  const entries = readdirSync(dir)
  const files: TestFile[] = []
  
  for (const entry of entries) {
    const full = join(dir, entry)
    const st = statSync(full)
    
    if (st.isDirectory()) {
      // Skip Playwright tests from node test runner
      if (full.includes(join('tests', 'playwright'))) continue
      files.push(...walk(full))
    } else if (entry.endsWith('.test.js')) {
      files.push({ path: full, isTypeScript: false })
    } else if (entry.endsWith('.test.ts')) {
      // Skip Vitest files (they have their own runner)
      // Also skip files in unit/ and integration/ dirs that use Vitest
      if (entry.includes('.vitest.')) continue
      if (full.includes(join('tests', 'unit')) || full.includes(join('tests', 'integration'))) {
        // These directories contain Vitest tests
        continue
      }
      files.push({ path: full, isTypeScript: true })
    }
  }
  
  return files
}

let testFiles = walk(testsDir)

// Optionally skip network-dependent tests in restricted environments
const skipNetwork = ['1', 'true', 'yes'].includes(
  String(process.env.WEBSSH2_SKIP_NETWORK || '').toLowerCase()
)

if (skipNetwork) {
  testFiles = testFiles.filter((f) => !/\/ssh\.test\.(js|ts)$/.test(f.path))
  // Also skip HTTP route tests that bind/listen via supertest in restricted envs
  testFiles = testFiles.filter((f) => !/\/post-auth\.test\.(js|ts)$/.test(f.path))
}

if (testFiles.length === 0) {
  console.error('No test files found to run.')
  process.exit(1)
}

// Separate TypeScript and JavaScript files
const tsFiles = testFiles.filter(f => f.isTypeScript)
const jsFiles = testFiles.filter(f => !f.isTypeScript)

console.log(`Found ${testFiles.length} test files (${tsFiles.length} TypeScript, ${jsFiles.length} JavaScript)`)

// Function to run tests
async function runTests(): Promise<void> {
  let exitCode = 0
  
  // Run TypeScript tests with tsx if any exist
  if (tsFiles.length > 0) {
    console.log('\n📝 Running TypeScript tests...')
    const tsxArgs = [
      '--test',
      '--test-concurrency=1',
      ...tsFiles.map(f => f.path)
    ]
    
    const tsxChild = spawn(
      'npx',
      ['tsx', ...tsxArgs],
      { stdio: 'inherit' }
    )
    
    const tsExitCode = await new Promise<number>((resolve) => {
      tsxChild.on('exit', (code, signal) => {
        if (signal) {
          console.error(`TypeScript tests exited with signal ${signal}`)
          resolve(1)
        } else {
          resolve(code ?? 1)
        }
      })
    })
    
    if (tsExitCode !== 0) {
      exitCode = tsExitCode
    }
  }
  
  // Run JavaScript tests with Node.js test runner if any exist
  if (jsFiles.length > 0) {
    console.log('\n📄 Running JavaScript tests...')
    const nodeChild = spawn(
      process.execPath,
      ['--test', '--test-concurrency=1', ...jsFiles.map(f => f.path)],
      { stdio: 'inherit' }
    )
    
    const jsExitCode = await new Promise<number>((resolve) => {
      nodeChild.on('exit', (code, signal) => {
        if (signal) {
          console.error(`JavaScript tests exited with signal ${signal}`)
          resolve(1)
        } else {
          resolve(code ?? 1)
        }
      })
    })
    
    if (jsExitCode !== 0) {
      exitCode = jsExitCode
    }
  }
  
  process.exit(exitCode)
}

// Run the tests
runTests().catch((error) => {
  console.error('Error running tests:', error)
  process.exit(1)
})