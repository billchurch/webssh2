# Local Checklist: Env Allowlist + Lint Hardening

This doc tracks the local work for the environment allowlist feature, safer env handling, and ESLint hardening.

## Summary

- Add `ssh.envAllowlist` and `WEBSSH2_SSH_ENV_ALLOWLIST`.
- Filter env keys/values and cap total forwarded pairs.
- Enable parsing of `&env=` on `/ssh` route.
- Replace falsy defaulting with `??`; remove unnecessary conditionals.
- Refactor exec env validator to safe transforms (no dynamic writes).
- Flip `security/detect-object-injection` to error.
- Update docs (README, CONFIG, ENV) and add tests.

## Status

### Done

- [x] Lint passes locally (app + tests): `npm run lint`
- [x] Tests pass locally: `npm run test`
- [x] Build succeeds: `npm run build`
- [x] Docs updated (README, DOCS/CONFIG.md, DOCS/ENV_VARIABLES.md)
- [x] `/ssh` route parses `&env=` into session
- [x] Allowlist works via config and env var
- [x] Exec env validator uses safe transforms
- [x] Flip `security/detect-object-injection` to error
- [x] README examples and tips for `&env=` vs `?`, AcceptEnv
- [x] Promote `@typescript-eslint/no-unnecessary-condition` to error (zero violations)
- [x] Add README TOC entry to “Environment Variables via URL”
- [x] Add Troubleshooting AcceptEnv note in README
- [x] Enable `@typescript-eslint/switch-exhaustiveness-check` (error)
- [x] Add caps to `parseEnvVars` (key ≤ 32, value ≤ 512) and document
- [x] Centralize constants (DEFAULTS, ENV_LIMITS, HEADERS, SSO headers, cookie name)
- [x] Update Docker docs to prefer environment variables
- [x] Add CONTRIBUTORS.md and DOCS/CONSTANTS.md

### To Do (Next)

- [ ] Optional e2e: containerized sshd to assert AcceptEnv path (see `DOCS/E2E-SSH.md`)
- [ ] Release notes entry for next pre-release
- [ ] CI: ensure workflows run `npm run lint` and `npm run test` (replace any references to removed scripts)
- [x] Promote `@typescript-eslint/prefer-nullish-coalescing` to error (after reviewing intentional `||` sites)
- [ ] Consider adding an examples section for allowlist in README (quick snippet)

## Manual Verification

1. `DEBUG=webssh2:* npm run start`
2. Visit `/ssh/host/localhost?port=2244&env=FOO:bar,BAR:baz` (or `/ssh?env=...`), login
3. Confirm logs:
   - `routes: Parsed environment variables: { FOO: 'bar', BAR: 'baz' }`
   - `ssh: shell: ... env options: { env: { TERM: 'xterm-color', FOO: 'bar', BAR: 'baz' } }`
4. On SSH server, `AcceptEnv FOO BAR` must be set; otherwise server will deny names

## Notes

- If allowlist is set (non-empty), only listed names pass filtering.
- WebSSH2 rejects keys not matching `^[A-Z][A-Z0-9_]*$` and values containing `; & | \` $`.
- Safety cap: up to 50 env pairs forwarded.
