# Migration Progress

- Total source files: 32
- TypeScript files: 12 (38%)
- JavaScript files: 20
- explicit 'any' uses (TS): 0

## Areas
- [ ] Constants
- [ ] Utils
- [ ] Config + Env
- [ ] Socket handlers
- [ ] Routes
- [ ] Entry/Packaging

_Last updated: 2025-09-11T19:00:48.512Z_

## Checkpoint: PR11 (runtime flip to dist)
- Status: PASSED functional smoke (manual)
- Date: 2025-09-11
- Verified items:
  - Build emits dist/ and start runs from dist.
  - GET /ssh renders UI.
  - GET /ssh/host/:host with Basic Auth returns 200 with HTML.
  - POST /ssh/host/ with form credentials returns 200 with HTML.
  - Header overrides via query/body apply correctly.
  - Socket.IO auth prompt appears; terminal opens; exec payload returns exec-data and exec-exit.
  - No changes to public route paths or event names.
