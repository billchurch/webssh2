#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts })
  return res.status === 0
}

let ok = true

// 1) Lint (existing script)
ok &&= run('npm', ['run', '-s', 'lint'])

// 2) Typecheck only when explicitly enabled (non-disruptive default)
if (process.env.ENABLE_TYPECHECK === '1') {
  // Use the build tsconfig to enforce strict TS checks on mirrored modules only
  const project = existsSync('tsconfig.build.json') ? 'tsconfig.build.json' : 'tsconfig.json'
  ok &&= run('npx', ['tsc', '-p', project, '--noEmit'])
}

// 3) Tests (current Node runner)
ok &&= run('npm', ['run', '-s', 'test'])

// 4) Vitest (opt-in) to avoid toolchain issues mid-migration
if (process.env.ENABLE_VITEST === '1' && (existsSync('vitest.config.ts') || existsSync('vitest.config.js'))) {
  ok &&= run('npx', ['vitest', 'run'])
}

// 5) Update migration progress dashboard
if (existsSync('scripts/migration-progress.mjs')) {
  ok &&= run('node', ['scripts/migration-progress.mjs'])
}

if (!ok) {
  console.error('\nPhase verification failed. Fix issues before pushing.')
  process.exit(1)
}

console.log('\nPhase verification passed. Safe to commit/push.')
