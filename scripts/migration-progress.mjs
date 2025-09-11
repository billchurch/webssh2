#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Migration progress reporter.
 * Scans source dirs, counts TS/JS, finds "any" usage,
 * inspects tsconfig flags, and writes a markdown summary.
 *
 * Usage: node scripts/ts-migration-report.mjs
 */

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, extname, sep, resolve } from 'node:path'

/** Directories to scan for source files. */
const SRC_DIRS = ['app']

/** Additional top-level files to consider. */
const EXTRA_FILES = ['index.js']

/**
 * Normalize a path to POSIX style for consistent comparisons.
 * @param {string} p
 * @returns {string}
 */
function npath(p) {
  return p.split(sep).join('/')
}

/**
 * Recursively walk a directory and return file paths.
 * @param {string} dir
 * @returns {string[]}
 */
function walk(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) {
      out.push(...walk(p))
    } else {
      out.push(p)
    }
  }
  return out
}

/**
 * Collect JS/TS source files from SRC_DIRS and EXTRA_FILES.
 * @returns {string[]}
 */
function listSourceFiles() {
  const files = []
  for (const d of SRC_DIRS) {
    try {
      files.push(...walk(d))
    } catch {
      /* ignore */
    }
  }
  for (const f of EXTRA_FILES) {
    try {
      statSync(f)
      files.push(f)
    } catch {
      /* ignore */
    }
  }
  return files.filter((p) => /\.(js|ts)$/.test(p))
}

/**
 * Read a tsconfig and extract strictness flags (booleans).
 * @param {string} path
 * @returns {Record<string, boolean>}
 */
function readTsConfigFlags(path) {
  try {
    const cfg = JSON.parse(readFileSync(path, 'utf8'))
    const c = cfg.compilerOptions || {}
    return {
      strict: !!c.strict,
      noImplicitAny: !!c.noImplicitAny,
      exactOptionalPropertyTypes: !!c.exactOptionalPropertyTypes,
      noUncheckedIndexedAccess: !!c.noUncheckedIndexedAccess,
      noImplicitOverride: !!c.noImplicitOverride,
      useUnknownInCatchVariables: !!c.useUnknownInCatchVariables,
      noImplicitReturns: !!c.noImplicitReturns,
      noUnusedLocals: !!c.noUnusedLocals,
      noUnusedParameters: !!c.noUnusedParameters,
      noFallthroughCasesInSwitch: !!c.noFallthroughCasesInSwitch,
    }
  } catch {
    return {
      strict: false,
      noImplicitAny: false,
      exactOptionalPropertyTypes: false,
      noUncheckedIndexedAccess: false,
      noImplicitOverride: false,
      useUnknownInCatchVariables: false,
      noImplicitReturns: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
      noFallthroughCasesInSwitch: false,
    }
  }
}

/** Main */
const files = listSourceFiles().map(npath)
const tsFiles = files.filter((f) => extname(f) === '.ts')
const jsFiles = files.filter((f) => extname(f) === '.js')

let anyCount = 0
for (const f of tsFiles) {
  const txt = readFileSync(f, 'utf8')
  const m = txt.match(/\bany\b/g)
  anyCount += m ? m.length : 0
}

const pctTs = files.length ? Math.round((tsFiles.length / files.length) * 100) : 0

const summary = {
  timestamp: new Date().toISOString(),
  totals: { all: files.length, ts: tsFiles.length, js: jsFiles.length },
  percentTs: pctTs,
  explicitAny: anyCount,
}

const hasSocketMirror = tsFiles.includes('app/socket.ts')
const hasRoutesMirror = tsFiles.includes('app/routes.ts')
const hasContracts = tsFiles.includes('app/types/contracts/v1/socket.ts')

const baseFlags = readTsConfigFlags('tsconfig.json')
const buildFlags = readTsConfigFlags('tsconfig.build.json')

let workflowStrict = false
try {
  const wf = readFileSync('.github/workflows/ts-migration.yml', 'utf8')
  workflowStrict = /ENABLE_TYPECHECK=1[^\n]*\bnode\b[^\n]*scripts\/phases-verify\.mjs/.test(wf)
} catch {
  /* ignore */
}

/** Areas checklist */
const areas = [
  { name: 'Constants', done: tsFiles.includes('app/constants.ts') },
  { name: 'Utils', done: tsFiles.includes('app/utils.ts') },
  {
    name: 'Config + Env',
    done: tsFiles.includes('app/config.ts') && tsFiles.includes('app/envConfig.ts'),
  },
  { name: 'Socket handlers', done: hasSocketMirror },
  { name: 'Routes', done: hasRoutesMirror },
  { name: 'Entry/Packaging', done: existsSync('dist/index.js') },
]

const md = [
  '# Migration Progress',
  '',
  `- Total source files: ${summary.totals.all}`,
  `- TypeScript files: ${summary.totals.ts} (${summary.percentTs}%)`,
  `- JavaScript files: ${summary.totals.js}`,
  `- explicit 'any' uses (TS): ${summary.explicitAny}`,
  '',
  '## Areas',
  ...areas.map((a) => {
    const extra = a.name === 'Socket handlers' && hasContracts ? ' (contracts v1 present)' : ''
    return `- [${a.done ? 'x' : ' '}] ${a.name}${extra}`
  }),
  '',
  '## TypeScript Flags',
  '### tsconfig.json',
  '```json',
  JSON.stringify(baseFlags, null, 2),
  '```',
  '### tsconfig.build.json',
  '```json',
  JSON.stringify(buildFlags, null, 2),
  '```',
  '',
  `CI typecheck gate enabled: ${workflowStrict ? 'yes' : 'no'}`,
  '',
].join('\n')

const outPath = resolve('ts-migration-progress.md')
writeFileSync(outPath, md, 'utf8')

console.log(JSON.stringify(summary, null, 2))
