#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
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

const md = `# Migration Progress\n\n- Total source files: ${summary.totals.all}\n- TypeScript files: ${summary.totals.ts} (${summary.percentTs}%)\n- JavaScript files: ${summary.totals.js}\n- explicit 'any' uses (TS): ${summary.explicitAny}\n\n## Areas\n- [ ] Constants\n- [ ] Utils\n- [ ] Config + Env\n- [ ] Socket handlers\n- [ ] Routes\n- [ ] Entry/Packaging\n\n_Last updated: ${summary.timestamp}_\n`

writeFileSync('MIGRATION_PROGRESS.md', md)
console.log(JSON.stringify(summary, null, 2))

