// tests/unit/services/host-key/host-key-test-fixtures.ts
// Shared test fixtures for host-key tests to reduce duplication

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export const HOST_KEY_SCHEMA = `
CREATE TABLE host_keys (
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    algorithm TEXT NOT NULL,
    key TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    comment TEXT,
    PRIMARY KEY (host, port, algorithm)
);
`

export interface TestContext {
  tmpDir: string
  dbPath: string
}

export function createTempDbContext(prefix: string): TestContext {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  const dbPath = path.join(tmpDir, 'hostkeys.db')
  return { tmpDir, dbPath }
}

export function cleanupTempDbContext(ctx: TestContext): void {
  fs.rmSync(ctx.tmpDir, { recursive: true, force: true })
}
