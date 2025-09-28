# WebSSH2 Admin API – Ideas & Feasibility

## Summary

- Goal: Add an HTTP `/api` surface to administer live WebSSH2 sessions.
- Core features: list active sessions; forcefully remove/close sessions; optionally send a message to the user before termination.
- Feasibility: High. Requires an in‑memory session registry, minimal hooks in the Socket.IO layer, and an Express router for `/api`. No changes needed to the client for basic terminal messaging (we can write to the SSH stream). Optional UI notices would require client changes.

## Current State (Repo Review)

- Entrypoint: `index.js` → `app/app.ts` creates Express app, HTTP server, and Socket.IO.
- Routes: `app/routes-v2.ts` mounts under `/ssh` (no REST API yet).
- Sockets: `app/socket-v2.ts` uses `ServiceSocketAdapter` per connection; maintains session state via `SessionStore` and uses `SSHServiceImpl` (`app/services/ssh/ssh-service.ts`).
- Sessions: Global session state managed through `SessionStore` with dependency injection pattern.
- Useful data available today:
  - `socket.id` (session id surrogate)
  - Client IP: `socket.handshake.address` or `socket.request.connection.remoteAddress`
  - Dest host/port: populated after `authenticate` → `initializeConnection` via `sessionState.{host,port}`
  - Username: `sessionState.username` (post‑auth)
  - Term size/type: `sessionState.{term,rows,cols}`
  - SSH stream handle for messaging: `ssh.stream` (when shell started)

## What We Need To Track

Introduce an in‑memory registry keyed by `socket.id`:

- id: Socket.IO id
- user: username (null until auth)
- source: { ip, port, userAgent? }
- dest: { host, port }
- term: { type, rows, cols }
- timestamps: { connectedAt, authenticatedAt, lastActivityAt }
- state flags: { authenticated, hasStream }
- handles (internal, not exported): socket ref, ssh ref

Update points in `app/socket-v2.ts` (ServiceSocketAdapter):

- On `io.on('connection')`: register basic entry with source IP/UA, connectedAt.
- On successful authentication via `SSHService.connect()`: update with username/dest; mark authenticated.
- On shell creation via `SSHService.shell()`: mark hasStream, store term/size.
- On data/resize events: update `lastActivityAt`.
- On `disconnect`: remove from registry.

## Proposed API Surface

- GET `/api/sessions`
  - Lists active sessions.
  - Response items: { id, user, source { ip, port }, dest { host, port }, term { type, rows, cols }, authenticated, connectedAt, authenticatedAt, lastActivityAt }
- GET `/api/sessions/:id`
  - Details for one session.
- DELETE `/api/sessions/:id`
  - Terminates a session. Body options:
    - { message?: string, notify?: { terminal?: boolean, delayMs?: number }, reason?: string }
  - Behavior: optionally send message to terminal, wait delay, close SSH stream and disconnect socket.
- POST `/api/sessions/:id/message`
  - Sends a message to the user terminal (best‑effort; falls back to socket emit if no stream yet).
- POST `/api/broadcast`
  - Sends message to multiple sessions with optional filters (by user, host).
- GET `/api/stats`
  - Basic stats: counts by host/user, totals, uptime, memory.
- GET `/api/health`
  - Health probe for orchestration.

Notes

- Fields exposing secrets must be masked; only metadata is returned.
- Session id is the Socket.IO `socket.id`.

## Authentication & Security

- Enable/disable API via config: `api.enabled` (default false).
- Auth options (choose one, configurable):
  - Static API key via header `X-API-Key` → `api.key` (recommended minimal change).
  - HTTP Basic (reuse `createAuthMiddleware`) with a separate `api.user`/`api.password` pair.
  - mTLS (advanced deployments, optional later).
- Network constraints: bind API under same server but guard with
  - CORS: reuse `config.getCorsConfig()` with a dedicated `http.apiOrigins` list.
  - Optional IP allowlist `api.allowlist`.
- Rate limiting: express-rate-limit for write ops (terminate, message, broadcast).
- Audit logging: log all admin actions with masked payloads.

## Remove/Message Semantics

- Terminal message: If `ssh.stream` exists, `stream.write("\r\n*** Admin: <message> ***\r\n")` so it renders in terminal. If no stream yet, emit `socket.emit('data', ...)` to display text (client renders terminal from this event already).
- Termination flow: message (optional) → optional `delayMs` → `ssh.end()` and `socket.disconnect(true)` → registry removal.
- Return codes: 202 Accepted for async termination; 200 OK on immediate success; 404 if id not found.

## Implementation Plan (Phased)

Phase 1 – Minimal, Safe, Useful

- Add `app/session-registry.ts` with:
  - register(socket), update(id, patch), remove(id), get(id), list(), terminate(id, opts), message(id, text), stats().
- Wire registry in `app/socket-v2.ts` lifecycle points.
- Add `app/api-routes.ts` (mount at `/api` in `createAppAsync` and `createApp` when `config.api.enabled`).
- Endpoints: `GET /sessions`, `GET /sessions/:id`, `DELETE /sessions/:id`, `POST /sessions/:id/message`, `GET /stats`, `GET /health`.
- Auth: simple API key check middleware.
- Tests: Vitest specs for registry and routes under `tests/api.vitest.ts` (mock io/socket, inject fake sessions, verify JSON shape, and termination flow).

Phase 2 – Hardening & Quality

- Rate limits on write endpoints; structured audit logs; IP allowlist.
- Better source IP extraction with trust proxy.
- Config docs: update `CONFIG.md`, `ENV_VARIABLES.md`, `config.json.sample` with `api` section and env mappings.

Phase 3 – Nice-to-haves

- Broadcast messaging with filters.
- Optional client UI toast via a new event (requires `webssh2_client` change).
- Session tagging/metadata (e.g., who initiated, purpose).

## Config Additions (proposed)

config.json

```json
{
  "api": {
    "enabled": false,
    "key": null,
    "allowlist": [],
    "rateLimit": { "windowMs": 60000, "max": 30 }
  },
  "http": {
    "apiOrigins": ["*:*"]
  }
}
```

ENV (examples)

- `WEBSSH2_API_ENABLED=true`
- `WEBSSH2_API_KEY=supersecret`
- `WEBSSH2_API_ALLOWLIST=10.0.0.0/8,127.0.0.1/32`
- `WEBSSH2_HTTP_API_ORIGINS=https://admin.example.com:443`

Notes: Update `app/envConfig.ts` and `app/configSchema.ts` to validate/merge these.

## Data Shapes (examples)

GET /api/sessions

```json
[
  {
    "id": "kV2mI0yE7o0lq1ePAAAB",
    "user": "alice",
    "source": { "ip": "203.0.113.10", "port": 51234 },
    "dest": { "host": "db01.internal", "port": 22 },
    "term": { "type": "xterm-256color", "rows": 40, "cols": 120 },
    "authenticated": true,
    "connectedAt": "2025-09-03T07:15:10.210Z",
    "authenticatedAt": "2025-09-03T07:15:12.422Z",
    "lastActivityAt": "2025-09-03T07:16:50.005Z"
  }
]
```

DELETE /api/sessions/:id body

```json
{ "message": "You will be disconnected by admin.", "notify": { "terminal": true, "delayMs": 1500 }, "reason": "maintenance" }
```

## Risks & Edge Cases

- Pre‑auth sockets: entries will lack user/dest; still listable; termination still works.
- No `ssh.stream` yet: messaging falls back to socket emit; text appears in terminal after connect or may be dropped – acceptable for admin notices.
- Proxies: ensure `app.set('trust proxy', true)` if using `X-Forwarded-For`; document.
- Persistence: in‑memory registry resets on server restart; acceptable for admin ops.
- Security: keep API disabled by default; require strong key; rate‑limit destructive ops.

## Test Strategy

- Unit: registry behavior, masking, update/remove, termination flow with fakes.
- Integration: spin up app in tests, call `/api/sessions` with seeded sockets (mock io), validate shapes and status codes.
- E2E (optional): Playwright can exercise API with a running server if needed.

## Estimated Effort

- Phase 1: ~3–6 hours including tests and docs.
- Phase 2: ~2–4 hours (rate limit, allowlist, trust proxy handling).

## Open Questions

- Should admin API live under the same origin or on a separate admin port?
- Do we want role‑based control beyond a single API key?
- Is there a requirement to persist session history/audit beyond logs?

---

If you want, I can implement Phase 1 with config toggles, a registry, the routes, and tests.
