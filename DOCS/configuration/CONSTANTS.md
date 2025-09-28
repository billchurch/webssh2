# Constants Overview

This document summarizes core constants used across the WebSSH2 server. Centralizing values improves readability, security, and maintenance.

Location: `app/constants.ts`

## DEFAULTS

- Networking and protocol
  - `LISTEN_PORT` – default HTTP listen port
  - `IO_PATH` – Socket.IO path (e.g., `/ssh/socket.io`)
  - `IO_PING_TIMEOUT_MS`, `IO_PING_INTERVAL_MS` – Socket.IO heartbeat
- SSH/session defaults
  - `SSH_PORT` – default SSH port
  - `SSH_TERM` – default terminal type
  - `TERM_ROWS`, `TERM_COLS` – default terminal size
  - `SSH_READY_TIMEOUT_MS`, `SSH_KEEPALIVE_INTERVAL_MS`, `SSH_KEEPALIVE_COUNT_MAX`
- HTTP/security
  - `HSTS_MAX_AGE_SECONDS` – Strict-Transport-Security max-age
- App defaults
  - `WEBSSH2_CLIENT_PATH`, `CLIENT_FILE`
  - `MAX_AUTH_ATTEMPTS`
  - `SESSION_COOKIE_NAME`
  - `SSO_HEADERS` – default inbound SSO header names (username, password, session)

## ENV_LIMITS

- Controls server-side acceptance of env vars forwarded to SSH:
  - `MAX_PAIRS` (default 50)
  - `MAX_KEY_LENGTH` (default 32)
  - `MAX_VALUE_LENGTH` (default 512)

Applied in:

- URL parsing: `parseEnvVars()` (utils)
- Session → SSH transform: `SSHServiceImpl` (services/ssh/ssh-service)

## HTTP

- Common HTTP codes and header names used internally:
  - `OK`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_SERVER_ERROR`
  - `AUTHENTICATE`, `REALM`, `AUTH_REQUIRED`, `COOKIE`, `PATH`, `SAMESITE_POLICY`, `SESSION_SID`, `CREDENTIALS_CLEARED`

## HEADERS

- Canonical header names used by the security middleware:
  - `CONTENT_SECURITY_POLICY`
  - `X_CONTENT_TYPE_OPTIONS`
  - `X_FRAME_OPTIONS`
  - `X_XSS_PROTECTION`
  - `REFERRER_POLICY`
  - `PERMISSIONS_POLICY`
  - `STRICT_TRANSPORT_SECURITY`

Used in:

- `app/security-headers.ts` (`SECURITY_HEADERS`, `createCSPMiddleware`)

## Where These Are Used

- Routing and connection setup: `app/routes-v2.ts`, `app/connection/connectionHandler.ts`
- Middleware and security: `app/middleware.ts`, `app/security-headers.ts`
- SSH behavior and env handling: `app/services/ssh/ssh-service.ts`
- Socket behavior: `app/socket-v2.ts`, `app/socket/adapters/service-socket-adapter.ts`

## Conventions

- Use numeric separators for readability: `31_536_000` (1 year, seconds)
- Encode units in names: `..._MS`, `..._SECONDS`
- Prefer referencing constants over literals in new code

## Changing Defaults

- Update values in `app/constants.ts`
- If behavior is user-configurable, add or reference the corresponding config or environment variable in `DOCS/CONFIG.md` and `DOCS/ENV_VARIABLES.md`
