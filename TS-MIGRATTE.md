# TypeScript Migration Playbook, v2

**Objective.** Incrementally migrate WebSSH2 (server) to TypeScript
with strict typing, zero `any`, `tsx` for dev, Vitest for tests,
and zero breaking changes to HTTP routes or Socket.IO contracts.

**Principles.**

- Do not change public routes or event names
- Small, reversible PRs
- Runtime validation at boundaries
- Measure, compare, and ratchet quality

---

## 0) Pre-migration baselines

Capture these once and commit JSON outputs to `.bench/`:

- Bundle size
- Build time
- Test time
- Memory under load
- Response time for key ops
- E2E success rate for critical paths

Use `autocannon` and small Node scripts to collect metrics. Compare
against `main` using deltas, not hard thresholds.

```bash
# example
npm run bench:collect   # writes .bench/before.json
# after changes
npm run bench:collect   # writes .bench/after.json
npm run bench:compare -- --max-regress 15
```

---

## 1) Tooling baseline (PR0)

**Configs**

- `tsconfig.json` (ESM, NodeNext)
  - `allowJs: true`
  - `checkJs: true`
  - `skipLibCheck: true`  (turn off later)
  - `verbatimModuleSyntax: true`
  - `module: "NodeNext"`, `moduleResolution: "NodeNext"`
  - `target: "ES2022"`, `lib: ["ES2023"]`
  - `esModuleInterop: true`
  - `resolveJsonModule: true`
- `tsconfig.build.json` extends base
  - `outDir: "dist"`
  - `allowJs: false`
  - `checkJs: false`
  - `strict: true`

**Dev deps**
`typescript`, `tsx`, `vitest`, `@vitest/coverage-v8`,
`@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`,
`eslint-plugin-import`, `@microsoft/api-extractor`,
`type-coverage`, `zod` (or AJV, see §4)

**Scripts**

```json
{
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "build": "tsc -p tsconfig.build.json",
    "dev": "tsx watch index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
    "api:extract": "api-extractor run --local",
    "type-coverage": "type-coverage --at-least 80 --strict",
    "bench:collect": "node scripts/measure.js",
    "bench:compare": "node scripts/compare.js"
  }
}
```

**ESLint (flat config, matches repo)**

- Extend `eslint.config.js` with a TS override; keep existing Prettier and security rules.

```js
// eslint.config.js (additions)
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

export default [
  // ...existing configs,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2024,
      sourceType: 'module',
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'node/file-extension-in-import': ['error', 'always'],
    },
  },
]
```

**CI gate**

```yaml
- run: npm ci
- run: npm run typecheck
- run: npm run build
- run: npm test
- run: npm run coverage
- run: npm run type-coverage
- run: npm run api:extract
```

---

## 2) Shared types and contracts (PR1, PR17, PR18)

Create/maintain `app/types/contracts/v1`:

- `config.ts`  
  `export interface Config { /* derived from defaults */ }`
- `socket.ts` (expanded in PR17; flipped in PR18)
  - Client→Server: `authenticate`, `terminal`, `resize`, `data`, `control('replayCredentials'|'reauth')`, `exec`
  - Server→Client: `authentication` union (`request_auth` | `auth_result` | `keyboard-interactive`), `permissions`, `updateUI`, `getTerminal`, `ssherror`, `data`, `exec-data`, `exec-exit`

Add helper:

```ts
// app/types/socket-helpers.ts
import type { Socket } from "socket.io";
import type {
  ClientToServerEvents as C2S,
  ServerToClientEvents as S2C,
  InterServerEvents as IS,
  SocketData as SD
} from "./contracts/v1/socket";

export type TypedSocket = Socket<C2S, S2C, IS, SD>;
```

Add `// @ts-check` with JSDoc to legacy `*.js` that will linger for a
few PRs, import shared types to improve accuracy before renames.

---

## 2b) Flip cadence updates (PR22)

Following the same shim pattern used for `routes`/`socket`, we flipped
`connectionHandler` and `io` to TS-built entrypoints while delegating
runtime behavior to the original JS via `*.impl.js -> *.impl.target.js`.

- Updated `scripts/copy-js.mjs` to:
  - Exclude `app/connectionHandler.js` and `app/io.js` from 1:1 copying
  - Copy originals to `dist/app/connectionHandler.impl.target.js` and
    `dist/app/io.impl.target.js`
- Pointed `app/connectionHandler.impl.js` and `app/io.impl.js` at the
  new `*.impl.target.js` files.
- Left imports in existing JS untouched; Node resolves to the TS-compiled
  wrappers, avoiding circular deps while keeping runtime behavior stable.

---

## 2c) Flip ssh (PR23)

Following the same shim pattern, we flipped `ssh` to a TS-built
entrypoint while delegating runtime behavior to the original JS via
`app/ssh.impl.js -> dist/app/ssh.impl.target.js`.

- Updated `scripts/copy-js.mjs` to exclude `app/ssh.js` from straight copy
  and copy the original under a special target consumed by the shim.
- Kept imports in JS unchanged; TS consumers import `./ssh.js` which
  resolves to the compiled TS wrapper.

---

## 2d) Flip validators (PR24)

Added a TS mirror for the Socket.IO exec payload schema with a
shim: `app/validators/execSchema.ts` and
`app/validators/execSchema.impl.js` that re-exports the original as
`execSchema.impl.target.js`.

- Updated `scripts/copy-js.mjs` to exclude `app/validators/execSchema.js`
  from 1:1 copy and emit the special target.
- Exposed `ExecPayload` type for use across handlers while keeping
  runtime validation in JS.

---

## 2e) Flip middleware + headers (PR25)

Both `middleware` and `security-headers` now build from TS wrappers
that delegate to the original JS via `*.impl.target.js` files. This
keeps runtime behavior stable while exposing strong types to TS
consumers and avoiding circular imports.

- Updated `scripts/copy-js.mjs` to exclude `app/middleware.js` and
  `app/security-headers.js` from direct copy and emit special targets
  used by the shims.
- Swapped shims to re-export from `*.impl.target.js`.

---

## 2f) Flip small helpers (PR27)

Migrated `client-path` and `crypto-utils` to TS-built wrappers with
`*.impl.js` shims that delegate to `*.impl.target.js` copied from the
original JS. This exposes types while keeping the runtime intact.

- Updated copy script to exclude original helpers from 1:1 copy and add
  special-target copies.

---

## 3) Runtime validation is mandatory (PR1)

Validate at boundaries only, then pass typed data inside.

Choose one runtime engine and stick with it.

**Option A, Zod at runtime** (recommended)

- Great DX, simpler code
- Validate only once per input

```ts
// app/validators/socket.ts
import { z } from "zod";

export const execPayloadSchema = z.object({
  command: z.string(),
  pty: z.boolean().optional(),
  term: z.string().optional(),
  cols: z.number().positive().optional(),
  rows: z.number().positive().optional(),
  env: z.record(z.string()).optional(),
  timeoutMs: z.number().positive().optional()
});

export type ExecPayload = z.infer<typeof execPayloadSchema>;
```

```ts
// app/validate.ts
import { z } from "zod";
import { WebSSH2Error } from "../types/errors";

/**
 * Parse with Zod, map to typed WebSSHError on failure.
 */
export const parseOrThrow = <T>(
  schema: z.ZodType<T>,
  data: unknown,
  code = "BAD_REQUEST"
): T => {
  const res = schema.safeParse(data);
  if (res.success) return res.data;
  throw new WebSSH2Error(
    "Invalid request payload",
    code,
    400,
    res.error.flatten()
  );
};
```

**Option B, AJV in prod, Zod in dev** (optional)

- Convert Zod to JSON Schema at build
- Run AJV for hot paths

Pick one to avoid drift.

Status (PR17): Exec payloads validated (via tests). Negative-path tests added to cover invalid `authenticate`, `terminal`, `resize`, and `control` payloads.

---

## 4) Typed error model (PR1, ongoing)

```ts
// app/types/errors.ts  (name matches existing WebSSH2Error)
/**
 * Application error with code and HTTP status.
 */
export class WebSSH2Error extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: unknown,
    cause?: unknown
  ) {
    super(message);
    this.name = "WebSSH2Error";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    if (cause) this.cause = cause as Error;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode
    };
  }
}
```

---

## 5) Batch process, repeatable loop

For each area:

1) **Implement**  
Rename `*.js` to `*.ts` in small chunks. Keep import specifiers
with `.js` to preserve Node ESM behavior while migrating.

2) **Type**  
No `any`. Use unions, `unknown` plus narrowing, helpers for
common patterns.

3) **Test**  
Unit tests in Vitest. Keep Playwright e2e. Add contract checks.

4) **Ship**  
No public changes, update `CHANGELOG`.

**Batch order**

- PR2, Utilities and constants first (low risk)
- PR3, Config and envConfig, lock defaults with tests
- PR4, Core server wiring, IO, sockets, middleware, routes
- PR5, Entry and packaging, `index.ts`, compiled output
- PR6, Tests migration, contract and smoke suites

---

## 6) Contract tests and smoke tests

**HTTP contracts**

- Validate JSON with JSON Schema, not brittle snapshots
- Assert status, headers, shape

**Socket contracts**

- Use `socket.io-client` against server
- Validate payloads with the same schema used at runtime

```ts
// test/contracts/socket.exec.test.ts
import { execPayloadSchema } from "../../app/validators/socket";

test("exec payload shape", () => {
  const sample = { command: "ls" };
  const ok = execPayloadSchema.safeParse(sample);
  expect(ok.success).toBe(true);
});
```

**Smoke suite**

- Can establish SSH connection
- Resize events work
- Exec data flows, exit reported

Run smoke after each PR.

---

## 7) Strictness ratchet

- After PR2
  - `noImplicitAny: true`
  - `useUnknownInCatchVariables: true`
- After PR3
  - `noUncheckedIndexedAccess: true`
- After PR4
  - `exactOptionalPropertyTypes: true`
  - `noPropertyAccessFromIndexSignature: true`
- Final
  - root `strict: true`
  - remove `allowJs`, drop `checkJs`
  - turn off `skipLibCheck`

---

## 8) Developer ergonomics

- Path aliases with ESM friendly style

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "#app/*": ["app/*"]
    }
  }
}
```

- Pre-commit hooks with lint-staged
  - `tsc --noEmit`
  - eslint
  - vitest changed files

- Editor note in `CONTRIBUTING.md`
  - Use `npm run dev` with `tsx` during dev
  - Use `npm run typecheck` before push

---

## 9) Test transition plan

- Keep current Node runner during early PRs:
  - `"test:node": "WEBSSH2_SKIP_NETWORK=1 node scripts/run-node-tests.mjs"`
  - `"test": "npm run test:node && vitest run"`
- Convert tests file-by-file to Vitest (`*.test.ts`).
- When fully migrated, drop `test:node` and rely on Vitest only.

```json
{
  "coverage": {
    "provider": "v8",
    "all": true,
    "lines": 80,
    "functions": 80,
    "branches": 70
  }
}
```

Type coverage budget starts at 80 for TS files, ratchet to 95.

---

## 10) Feature flags, short lived

Add flags for rollout only, each with an expiry note.

```ts
// config.ts
export interface Config {
  features: {
    useTypedSocketHandlers: boolean;
    strictRuntimeValidation: boolean;
  };
}

/**
 * Flag: strictRuntimeValidation
 * Added: 2025-09-11
 * Remove by: 2025-11-01
 */
```

Remove flags within two releases once stable.

---

## 11) Public API stability

If you export types, lock your `.d.ts` surface.

```json
{
  "scripts": {
    "api:extract": "api-extractor run --local"
  }
}
```

Fail CI on unintended API changes.

---

## 12) Compatibility guarantees and checks

- Do not change route paths or query names
- Lock examples from README with tests
  - `/ssh`, `/ssh/host/:host`, `?env=...`, `?port=...`
- Keep Socket.IO events and payload shapes identical
- Add snapshot tests for `exec` flow where safe, otherwise
  schema checks

---

## 13) Rollout and rollback

- Each PR is small and green on `typecheck`, `build`, tests
- Release as patch versions with clear notes
- If a regression appears, revert the batch PR
- Temporary escape hatch
  - Allow switching between `dist/` and legacy entry if needed,
    guard with short-lived env flag

---

## 14) Migration tracking dashboard

Add a living checklist to the repo root.

```markdown
## Migration Progress

- [ ] Constants (0% → TS)
- [ ] Utils (0% → TS)
- [ ] Config (0% → TS)
- [ ] Socket handlers (0% → TS)
- [ ] Routes (0% → TS)

Coverage
- TypeScript files: X%
- Strictly typed: Y%
- Any count: Z (target 0)
```

---

## 15) MIGRATION_NOTES.md

Record near-misses and gotchas to speed reviews.

```markdown
## Gotchas

- Socket emit callback signatures differ once typed
- Express middleware order is more apparent under strict types
- Env parsing needs explicit coercion and defaults
```

---

## 16) Ops safety nets

- Redact secrets in logs, mask keys by pattern
- Simple per-socket rate limit for risky events
- Uniform error mapping
  - WebSSHError with codes, status, and safe `toJSON`

```ts
// naive per-socket limiter
const execCount = new Map<string, number>();

socket.on("exec", (raw) => {
  const n = (execCount.get(socket.id) ?? 0) + 1;
  execCount.set(socket.id, n);
  if (n > 20) {
    throw new WebSSHError("Rate limit", "RATE_LIMIT", 429);
  }
  const p = parseOrThrow(execPayloadSchema, raw, "EXEC_INVALID");
  // handle typed exec
});
```

---

## 17) Packaging and entry (PR5)

- `main: "dist/index.js"`
- `types: "dist/index.d.ts"`
- `bin.webssh2-server: "./dist/index.js"`
- Scripts
  - `dev`: `tsx watch index.ts`
  - `start`: `node dist/index.js`

Consider a dual build only if your users need CJS. If not,
stay ESM only.

---

## 18) Acceptance checklist, per PR

- `npm run typecheck` passes
- `npm run build` emits JS
- Unit, contract, and smoke tests pass in CI
- No `any` introduced
  - exceptions must be commented and tracked for removal
- Public contracts unchanged
- Bench compare within regression budget
- API extractor passes if public types are exported

---

## Branch-Only Workflow & Checkpoints

- Work on a single migration branch; commit only after a full verify.
- Use the built-in verification script locally: `npm run verify`.
- A Husky pre-push hook runs the same verification to prevent broken pushes.
- For human functional checkpoints at critical phases, add `[checkpoint]` to the PR title (if you open a PR for review without merging) to require manual approval in CI.

Minimum verify gates:

- Lint clean, tests pass, (optional) typecheck if TS is present, progress dashboard updated.

---

## Appendix, sample `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ['tests/**/*.test.{js,ts}'],
    coverage: {
      provider: "v8",
      all: true,
      lines: 80,
      functions: 80,
      branches: 70
    }
  }
});
```

## Appendix, sample socket bootstrap

```ts
// app/socket/bootstrap.ts
import type { Server } from "socket.io";
import type { TypedSocket } from "#app/types/socket-helpers";
import { execPayloadSchema } from "#app/validators/socket";
import { parseOrThrow } from "#app/validate";
import { WebSSH2Error } from "#app/types/errors";

export function initSocket(io: Server): void {
  io.on("connection", (socket: TypedSocket) => {
    socket.on("exec", (raw) => {
      const p = parseOrThrow(execPayloadSchema, raw, "EXEC_INVALID");
      // implement exec using typed payload p
      // handle errors via WebSSH2Error
    });

    socket.on("resize", (raw) => {
      // similar pattern
    });
  });
}
```

---

## Roadmap Snapshot

Completed

- PR0–PR3: TS scaffolding, @ts-check on core, initial types and smoke tests
- PR4–PR6: JSON schema for exec payload, route helper tests
- PR7–PR10: TS mirrors for core leaf modules + io/socket typings
- PR11: Flip runtime to `dist` (compile TS + mirror JS)
- PR12–PR15: Security hardening + HTTP/Socket.IO contract tests

Upcoming (updated)

- PR16: TS mirrors for `socket` and `routes` (no runtime change) — done
- PR17: Strict typecheck pass for mirrored modules (ENABLE_TYPECHECK=1) — done
- PR18: Flip `socket` and `routes` to `dist` implementations (impl shims + copy exclusions) — done
- PR19: Raise strictness (noUncheckedIndexedAccess, noImplicitOverride, useUnknownInCatchVariables, noImplicitReturns, noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch) — done
- PR20: Flip `errors` and `logger` to TS runtime (copy exclusions); checkpoint — next
- Final: Checkpoint + merge to `main`
