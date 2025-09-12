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
- [x] Lint passes locally: `npm run lint`
- [x] Tests pass locally: `npm run test`
- [x] Build succeeds: `npm run build`
- [x] Docs updated (README, DOCS/CONFIG.md, DOCS/ENV_VARIABLES.md)
- [x] `/ssh` route parses `&env=` into session
- [x] Allowlist works via config and env var
- [x] Exec env validator uses safe transforms
- [x] Flip `security/detect-object-injection` to error
- [x] README examples and tips for `&env=` vs `?`, AcceptEnv

### To Do (Next)
- [ ] Promote `@typescript-eslint/no-unnecessary-condition` to error (confirm zero violations)
- [ ] Add README TOC entry pointing to “Environment Variables via URL” (ensure prominent)
- [ ] Add short “Troubleshooting AcceptEnv” note near README top (quick link)
- [ ] Consider enabling `@typescript-eslint/switch-exhaustiveness-check` (evaluate usage sites)
- [ ] Add optional caps to `parseEnvVars` (key length ≤ 32, value length ≤ 512) for parity with SSH layer; document behavior
- [ ] Optional e2e: containerized sshd to assert AcceptEnv path
- [ ] Release notes entry for next pre-release

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

