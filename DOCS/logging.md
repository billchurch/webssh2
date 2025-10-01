# Logging Strategy

## Vision
- Emit structured, security-focused telemetry for every critical SSH interaction, using JSON as the canonical event payload.
- Support multiple transports (stdout by default, optional syslog) without forcing runtime restarts or code changes.
- Preserve privacy by masking secrets, dropping high-volume clutter, and normalising metadata.

## Guiding Principles
- Prefer pure data assembly functions that return `Result` objects so failures are observable and non-fatal.
- Keep modules small and transport-agnostic; compose via dependency injection.
- Never log credentials, private key material, or raw terminal content.
- Default to UTC ISO-8601 timestamps and stable field keys.
- Reject events that exceed size thresholds or include unsafe characters for downstream systems.

## Event Model
Each log event combines core metadata with an event-specific payload. Core fields:

| Field | Type | Notes |
| --- | --- | --- |
| `ts` | string | RFC 3339 UTC timestamp. |
| `level` | `debug`\|`info`\|`warn`\|`error` | Inclusive severity ladder. |
| `event` | string | One of the catalogued event identifiers. |
| `session_id` | string | Branded session identifier from the session store. |
| `request_id` | string | Correlates HTTP request, socket, and downstream actions. |
| `client_ip` | string | Resolved client IP (trusting configured proxy chain). |
| `client_port` | number | Client source port when available. |
| `client_source_port` | number | Backing TCP port observed from the socket connection (post-proxy). |
| `user_agent` | string | Normalised browser agent string (logged on `session_init` only). |
| `username` | string | Normalised username when known. |
| `target_host` | string | Final SSH target hostname or IP. |
| `target_port` | number | Final SSH target port. |
| `protocol` | string | `ssh`, `sftp`, or `scp` once supported. |
| `subsystem` | string | `shell`, `sftp`, `scp`, or `exec`. |
| `status` | string | `success` or `failure` semantics per event. |
| `duration_ms` | number | Milliseconds captured via monotonic timers. |
| `bytes_in`/`bytes_out` | number | Aggregate stream counters when available. |

Event catalog (initial focus):
- `auth_attempt`, `auth_success`, `auth_failure`
- `session_init`, `session_start`, `session_end`
- `ssh_command` (shell command execution)
- `pty_resize` (terminal size changes)
- `idle_timeout` (automatic disconnect)
- `policy_block` (denied action)
- `error` (unexpected failures, include `error_code` and `reason`)

Future events (`sftp_*`, `scp_*`) remain aspirational until those subsystems exist in `app/`.

Event payloads should be defined in TypeScript using discriminated unions so the compiler enforces completeness.

## Transport Architecture
1. **Stdout transport (default)**
   - Writes newline-delimited JSON to `process.stdout`.
   - Honors log level filtering per configuration.
   - Resilient to partial writes by buffering in memory and draining on `drain` events.

2. **Syslog transport (optional)**
   - Implements RFC 5424 structured data, with TLS per RFC 5425 and octet-counted framing per RFC 6587.
   - Adds structured data block `[webssh2@<enterprise-id> ...]` with high-signal attributes.
   - Reconnects with exponential backoff and surfaces health via metrics.

Transports must be pluggable; attaching or detaching one cannot impact the core log formatting pipeline.

## Configuration Surface
Environment variables (all prefixed `WEBSSH2_LOGGING_`):
- `FORMAT`: `json` (default) for stdout.
- `LEVEL`: minimum severity to emit (`info` default).
- `STDOUT_ENABLED`: defaults to `true`.
- `STDOUT_MIN_LEVEL`: override for stdout transport.
- `SYSLOG_ENABLED`: defaults to `false`.
- `SYSLOG_HOST`, `SYSLOG_PORT`, `SYSLOG_APP_NAME`, `SYSLOG_ENTERPRISE_ID`: connection metadata.
- `SYSLOG_TLS_ENABLED`, `SYSLOG_TLS_CA_FILE`, `SYSLOG_TLS_CERT_FILE`, `SYSLOG_TLS_KEY_FILE`, `SYSLOG_TLS_REJECT_UNAUTHORIZED`: TLS controls.
- `SYSLOG_BUFFER_SIZE`, `SYSLOG_FLUSH_INTERVAL_MS`: flow control.
- `SYSLOG_INCLUDE_JSON`: include JSON payload after structured data block when `true`.

Configuration is parsed through the existing env-mapper, validated via zod schemas, and surfaced through the DI container.

### Runtime Controls (Phase 2)

Structured logging can now be tuned at runtime through `logging` entries in the primary config (`config.json` or environment overrides):

- `logging.minimumLevel`: adjusts the inclusive severity threshold across every structured logger.
- `logging.controls.sampling`: accepts a `defaultSampleRate` and optional `rules[]` keyed by event name (or `*`) to drop high-volume events deterministically.
- `logging.controls.rateLimit`: provides `rules[]` with `limit`, `intervalMs`, and optional `burst` tokens for per-event or wildcard throttling.

Environment overrides keep these controls in sync without touching `config.json`:

- `WEBSSH2_LOGGING_LEVEL` → `logging.minimumLevel`
- `WEBSSH2_LOGGING_SAMPLING_DEFAULT_RATE` → `logging.controls.sampling.defaultSampleRate`
- `WEBSSH2_LOGGING_SAMPLING_RULES` → `logging.controls.sampling.rules` (JSON array)
- `WEBSSH2_LOGGING_RATE_LIMIT_RULES` → `logging.controls.rateLimit.rules` (JSON array)

The stdout transport now enforces a bounded in-memory queue (default 1000 events). When the queue is full, entries are dropped with `TransportBackpressureError`; `StructuredLogger#snapshotMetrics()` exposes counters for published, sampled, rate-limited, and queue-dropped events to aid operational dashboards.

## Implementation Milestones
1. Replace the current `Logger` interface with a structured logger accepting `{ level, event, data }`.
2. Implement shared utilities for timestamps, correlation IDs, byte counters, and error serialisation (`Result` based).
3. Instrument authentication, session, and SSH services to emit events with exhaustive metadata.
   Capture client network fingerprint (IP, port, user agent) during the initial socket handshake.
4. Layer in syslog transport once stdout coverage is complete and validated.
5. Add integration tests that assert log production for representative socket flows.

## Testing Expectations
- Unit tests for formatter correctness, field validation, and masking logic.
- Integration tests (Vitest) that exercise authentication and command execution flows, asserting emitted events against Golden JSON snapshots.
- Playwright smoke tests ensuring critical user actions result in log output.
- Chaos tests (optional) simulating syslog disconnects to confirm buffered resend.

## Operational Guidance
- stdout logs are container-friendly and should be shipped via the hosting platform.
- Syslog transport is opt-in; operators must provision certificates and network routes.
- Document the event schema in release notes so SIEM parsers stay in sync.
- Provide scripts for validating syslog connectivity (e.g., `openssl s_client`).

## Current Progress
- `app/logging/` contains the structured formatter, log level helpers, stdout transport, and application-facing logger factory.
- `app/logger.ts` exposes `createAppStructuredLogger` and now emits structured `error` events in addition to legacy console output.
- Socket authentication/terminal adapters publish structured events for auth attempts, successes/failures,
  exec activity, and capture client network metadata for downstream events.
- Unit coverage lives under `tests/unit/logging/`, validating formatting, level filtering, socket context derivation, and stdout backpressure handling.

## Future Enhancements
- Support OpenTelemetry log record export once Node SDK stabilises.
- Introduce demand-based sampling for high-frequency events (e.g., `pty_resize`).
- Extend event catalog as new SSH features (SFTP/SCP) ship.
- Publish schema versioning to allow consumers to detect breaking changes.
