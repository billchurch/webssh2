# Contributors Guide

Welcome! This guide explains how to set up a dev environment, coding standards, and how to open high‑quality PRs for WebSSH2.

## Stack & Requirements

- Node.js 22 LTS (Jod)
- TypeScript 5
- Express 5, Socket.IO 4, ssh2 1.x
- ESLint 9 + @typescript-eslint, Prettier

## Getting Started

- Install deps: `npm install`
- Dev server (with watch + debug): `DEBUG=webssh2:* npm run dev`
- Build: `npm run build`
- Lint: `npm run lint` (lints app + tests, autofix: `npm run lint:fix`)
- Tests: `npm run test` (includes unit + integration)
- Typecheck only: `npm run typecheck`

## Project Conventions

- Language: Strict TypeScript only (no `any`).
- Defaults: Prefer `??` over `||` for fallback; use `??=` patterns where useful.
- Conditionals: `@typescript-eslint/no-unnecessary-condition` is error‑level.
- Exhaustiveness: `@typescript-eslint/switch-exhaustiveness-check` is error‑level.
- Security: `eslint-plugin-security` with `detect-object-injection` as error. Avoid dynamic writes; prefer transforms using `Object.entries` → `filter` → `map` → `Object.fromEntries`.
- Constants: Avoid magic numbers/strings. Use centralized constants in `app/constants.ts`:
  - `DEFAULTS` for server defaults (timeouts in `…_MS`, HSTS `…_SECONDS`, terminal sizes, etc.)
  - `ENV_LIMITS` for env var caps
  - `HTTP` for codes and common tokens
  - `HEADERS` for canonical header names
  See `DOCS/CONSTANTS.md`.
- Env forwarding to SSH:
  - URL param `env=FOO:bar,BAR:baz`
  - Server filtering + caps, optional allowlist via `ssh.envAllowlist` or `WEBSSH2_SSH_ENV_ALLOWLIST`
  - SSH server must allow names via `AcceptEnv`. See README “Environment Variables via URL”.

## Dev Tips

- Debug namespaces: `webssh2:*` (core), plus `engine`, `socket`, `express` for frameworks.
- Socket.IO path: `DEFAULTS.IO_PATH` (do not hardcode).
- Session cookie name: `DEFAULTS.SESSION_COOKIE_NAME`.
- SSO inbound headers: `DEFAULTS.SSO_HEADERS`.

## Testing Philosophy

- Add unit tests near the code under `tests/unit`.
- Use integration tests for Socket.IO behavior (`tests/integration`).
- Prefer deterministic tests (no network). Real SSH e2e belongs in separate, opt‑in workflows.

## PR Checklist (copy into PR description)

- [ ] Build succeeds (`npm run build`)
- [ ] Lint passes (app + tests): `npm run lint`
- [ ] Tests pass locally (`npm run test`)
- [ ] No new `any`, no disabled rules without justification
- [ ] Constants used (no magic literals); docs updated as needed
- [ ] Security: no dynamic object injection; input validated
- [ ] Behavior: preserved or documented changes; migration notes added if needed

## Docs to Review When Changing Behavior

- `README.md` – usage, env via URL, troubleshooting
- `DOCS/CONFIG.md` – config schema and examples
- `DOCS/ENV_VARIABLES.md` – env var mapping
- `DOCS/CONSTANTS.md` – centralized constants

## Opening a PR

- Keep diffs focused and scoped; one topic per PR when feasible.
- Include a clear summary, motivation, and before/after notes.
- Reference issues or discussions when applicable.
- End with the PR checklist above.

Thanks for contributing!
