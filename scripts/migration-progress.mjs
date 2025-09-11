#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

const SRC_DIRS = ['app']
const EXTRA_FILES = ['index.js']

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

function listSourceFiles() {
  const files = []
  for (const d of SRC_DIRS) {
    try { files.push(...walk(d)) } catch {}
  }
  for (const f of EXTRA_FILES) {
    try { statSync(f); files.push(f) } catch {}
  }
  return files.filter((p) => /\.(js|ts)$/.test(p))
}

const files = listSourceFiles()
const tsFiles = files.filter((f) => extname(f) === '.ts')
const jsFiles = files.filter((f) => extname(f) === '.js')

let anyCount = 0
for (const f of tsFiles) {
  const txt = readFileSync(f, 'utf8')
  anyCount += (txt.match(/\bany\b/g) || []).length
}

const pctTs = files.length ? Math.round((tsFiles.length / files.length) * 100) : 0

const summary = {
  timestamp: new Date().toISOString(),
  totals: { all: files.length, ts: tsFiles.length, js: jsFiles.length },
  percentTs: pctTs,
  explicitAny: anyCount,
}

// Derive higher-level status
const hasSocketMirror = tsFiles.includes('app/socket.ts')
const hasRoutesMirror = tsFiles.includes('app/routes.ts')
const hasContracts = tsFiles.includes('app/types/contracts/v1/socket.ts')

function readTsConfigFlags(path) {
  try {
    const cfg = JSON.parse(readFileSync(path, 'utf8'))
    const c = cfg.compilerOptions || {}
    return {
      strict: !!c.strict,
      noImplicitAny: !!c.noImplicitAny,
      exactOptionalPropertyTypes: !!c.exactOptionalPropertyTypes,
    }
  } catch {
    return { strict: false, noImplicitAny: false, exactOptionalPropertyTypes: false }
  }
}

const baseFlags = readTsConfigFlags('tsconfig.json')
const buildFlags = readTsConfigFlags('tsconfig.build.json')

let workflowStrict = false
try {
  const wf = readFileSync('.github/workflows/ts-migration.yml', 'utf8')
  workflowStrict = /ENABLE_TYPECHECK=1\s+node\s+scripts\/phases-verify\.mjs/.test(wf)
} catch {}

const areas = [
  { name: 'Constants', done: tsFiles.some((f) => f === 'app/constants.ts') },
  { name: 'Utils', done: tsFiles.some((f) => f === 'app/utils.ts') },
  { name: 'Config + Env', done: tsFiles.some((f) => f === 'app/config.ts') && tsFiles.some((f) => f === 'app/envConfig.ts') },
  { name: 'Socket handlers', done: hasSocketMirror },
  { name: 'Routes', done: hasRoutesMirror },
  { name: 'Entry/Packaging', done: existsSync('dist/index.js') },
]

const md = `# Migration Progress\n\n- Total source files: ${summary.totals.all}\n- TypeScript files: ${summary.totals.ts} (${summary.percentTs}%)\n- JavaScript files: ${summary.totals.js}\n- explicit 'any' uses (TS): ${summary.explicitAny}\n\n## Areas\n${areas
  .map((a) => `- [${a.done ? 'x' : ' '}] ${a.name}${a.name === 'Socket handlers' && hasContracts ? ' (contracts v1 present)' : ''}`)
  .join('\n')}\n\n## Strictness\n- Base tsconfig: strict=${baseFlags.strict}, noImplicitAny=${baseFlags.noImplicitAny}, exactOptionalPropertyTypes=${baseFlags.exactOptionalPropertyTypes}\n- Build tsconfig: strict=${buildFlags.strict}, noImplicitAny=${buildFlags.noImplicitAny}, exactOptionalPropertyTypes=${buildFlags.exactOptionalPropertyTypes}\n- CI: ENABLE_TYPECHECK=${workflowStrict ? 'on' : 'off'}\n\n## Milestones\n- [${hasSocketMirror && hasRoutesMirror ? 'x' : ' '}] PR16-alt: TS mirrors for socket/routes\n- [${buildFlags.noImplicitAny && buildFlags.exactOptionalPropertyTypes ? 'x' : ' '}] PR17: strict typecheck + expanded Socket.IO contract types\n\n_Last updated: ${summary.timestamp}_\n`

writeFileSync('MIGRATION_PROGRESS.md', md)
console.log(JSON.stringify(summary, null, 2))
