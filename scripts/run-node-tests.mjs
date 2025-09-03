#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const testsDir = join(process.cwd(), 'tests')

function walk(dir) {
  const entries = readdirSync(dir)
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      // Skip Playwright tests from node test runner
      if (full.includes(`${join('tests', 'playwright')}`)) continue
      files.push(...walk(full))
    } else if (entry.endsWith('.test.js')) {
      files.push(full)
    }
  }
  return files
}

let files = walk(testsDir)

// Optionally skip network-dependent tests in restricted environments
const skipNetwork = ['1', 'true', 'yes'].includes(
  String(process.env.WEBSSH2_SKIP_NETWORK || '').toLowerCase()
)
if (skipNetwork) {
  files = files.filter((f) => !/\/ssh\.test\.js$/.test(f))
}

if (files.length === 0) {
  console.error('No test files found to run.')
  process.exit(1)
}

const child = spawn(
  process.execPath,
  ['--test', '--test-concurrency=1', ...files],
  { stdio: 'inherit' }
)

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Tests exited with signal ${signal}`)
    process.exit(1)
  }
  process.exit(code ?? 1)
})

