# Security Policy

## Supported Versions

We currently support only the latest released version of WebSSH2 with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 6.x     | :white_check_mark: |
| < 6.0.0 | :x:                |

**We strongly recommend always using the latest release to ensure you have the most recent security patches and improvements.**

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by:

**GitHub Security Advisories**: Use the [Security Advisories](https://github.com/billchurch/WebSSH2/security/advisories) feature to privately report vulnerabilities

### What to Include

Please include as much of the following information as possible:

- Type of vulnerability (e.g., authentication bypass, injection, etc.)
- Step-by-step instructions to reproduce the issue
- Affected version(s)
- Potential impact of the vulnerability
- Suggested fix (if available)

### What to Expect

- **Initial Response**: You can expect an initial response within 72 hours acknowledging receipt of your report
- **Status Updates**: We will keep you informed of our progress as we investigate and address the issue
- **Timeline**: We aim to release a security patch within 30 days for confirmed vulnerabilities, depending on complexity
- **Credit**: If you wish, we will credit you in the security advisory and release notes (unless you prefer to remain anonymous)

### Security Best Practices

When deploying WebSSH2:

- Always use HTTPS/TLS in production environments
- Implement proper authentication mechanisms
- Follow the principle of least privilege for SSH access
- Keep Node.js and all dependencies up to date
- Review and follow security guidance in our [documentation](README.md)
- Use environment variables for sensitive configuration (see [ENV_VARIABLES.md](DOCS/ENV_VARIABLES.md))

## Default security posture

Two defaults ship intentionally permissive and are kept that way for
backward compatibility. Both are audited when the server starts and emit
warn-level structured logs (`event: security_posture`) until you harden
them. Review this section before exposing any deployment beyond a trusted
network.

### Host key verification is disabled by default

| Config key | Default | Exposure |
| --- | --- | --- |
| `ssh.hostKeyVerification.enabled` | `false` | The gateway accepts ANY SSH host key, so an attacker positioned between the gateway and the target can silently man-in-the-middle sessions and capture credentials |

To harden, enable verification (the `prompt` action gives users a
TOFU-style accept/reject decision for unknown keys):

```json
{
  "ssh": {
    "hostKeyVerification": {
      "enabled": true,
      "unknownKeyAction": "prompt"
    }
  }
}
```

Or via environment variables:

```bash
WEBSSH2_SSH_HOSTKEY_ENABLED=true
WEBSSH2_SSH_HOSTKEY_UNKNOWN_ACTION=prompt
```

Additional notes:

- Pre-seed the server-side key store with `npm run hostkeys` so known
  hosts are pinned before first use
- Enabling verification covers socket-based SSH connections; some
  non-socket connection paths skip the verifier even when it is enabled,
  so do not treat it as covering every code path
- Full option reference:
  [Host Key Verification](DOCS/configuration/CONFIG-JSON.md#host-key-verification)

### Content-Security-Policy is report-only by default

| Config key | Default | Exposure |
| --- | --- | --- |
| `csp.mode` | `report-only` | The CSP header is sent as `Content-Security-Policy-Report-Only` — browsers report violations but do **not** enforce the policy. A `security_posture` warning is logged at startup when mode is not `enforce` |

The CSP is configured through the `csp` block in `config.json` (or the `WEBSSH2_CSP_*` environment variables). Full reference: [CONFIG-JSON.md](DOCS/configuration/CONFIG-JSON.md#content-security-policy-csp) and [ENVIRONMENT-VARIABLES.md](DOCS/configuration/ENVIRONMENT-VARIABLES.md#content-security-policy).

**The three modes:**

- `off` — no CSP header is sent (not recommended)
- `report-only` (default) — `Content-Security-Policy-Report-Only` header collects violations without blocking anything; safe for rollout
- `enforce` — `Content-Security-Policy` header actively blocks violations

**Recommended rollout:**

1. Deploy with the default `report-only` mode
2. Monitor the structured `csp_violation` log events at `/ssh/csp-report`
3. Confirm only the expected legacy-inline-script violation appears (see below)
4. Set `csp.mode` to `enforce` (or `WEBSSH2_CSP_MODE=enforce`)

**`connect-src` derivation and the wildcard `http.origins` caveat:**

The CSP `connect-src` directive is built from `'self'`, concrete entries in `http.origins`, and the `csp.connectSrc` allowlist. The default `http.origins` value is `["*:*"]` — wildcards are not valid CSP source expressions and are dropped. With the default configuration, `connect-src` is therefore `'self'` only. For split client/gateway deployments (browser origin differs from the gateway origin), either:

- Set a concrete `http.origins` list: `["https://gw.example:8443"]`, or
- Add explicit socket URLs via `csp.connectSrc`: `["wss://gw.example:8443"]`

A `security_posture` warning is also logged when `enforce` mode is combined with wildcard `http.origins`.

**Violation reporting endpoint:**

`POST /ssh/csp-report` receives violation reports from browsers. It is intentionally unauthenticated so browsers can reach it without session cookies. The endpoint is per-IP intake rate-limited (default burst 10, steady-state ~10 requests/minute, throttled before the body is parsed), body-capped at 8 KB, and always returns `204`. It logs a structured `csp_violation` event, which is itself additionally rate-limited to 60 events/minute by the default logging controls. Operators should additionally rate-limit `POST /ssh/csp-report` at the reverse proxy or load balancer.

**No violations on a normal page load:**

Since 6.0.0 the server injects runtime config only through the inert `<script type="application/json" id="webssh2-config">` block, and the bundled client (6.0.0+) contains no executable inline script. A normal page load produces no `csp_violation` reports, and every report is logged at `warn` level. Custom client builds must read the JSON config block (client 5.1.0 or newer); the legacy `window.webssh2Config` inline script is no longer filled in.

### No target-host restrictions by default

| Config key | Default | Exposure |
| --- | --- | --- |
| `ssh.allowedSubnets` | `[]` (allow all) | Any authenticated client can ask the gateway to open an SSH connection to ANY reachable host/port — an open SSH proxy and SSRF pivot into internal networks and cloud metadata endpoints |
| `telnet.allowedSubnets` | `[]` (allow all) | Same exposure for telnet targets when `telnet.enabled` is `true` (telnet is disabled by default) |

To harden, restrict destinations to the CIDR ranges you actually serve:

```json
{
  "ssh": {
    "allowedSubnets": ["10.0.0.0/8", "192.168.1.0/24"]
  },
  "telnet": {
    "allowedSubnets": ["10.0.0.0/8"]
  }
}
```

Or via environment variables:

```bash
WEBSSH2_SSH_ALLOWED_SUBNETS="10.0.0.0/8,192.168.1.0/24"
WEBSSH2_TELNET_ALLOWED_SUBNETS="10.0.0.0/8"
```

Additional notes:

- Validation happens at connect time using DNS resolution of the
  requested host; there is no DNS-rebinding pinning between validation
  and connection (tracked separately)
- Prefer the narrowest CIDR ranges possible and pair them with
  network-level egress controls

### Server-configured credentials only reach `ssh.host`

When you set `user.name` together with `user.password` or `user.privateKey`
(or the matching `WEBSSH2_USER_*` variables), the gateway uses those
credentials for visitors who do not log in themselves. Since 6.0.0 they are
pinned to the configured `ssh.host` and `ssh.port`:

- `GET /ssh/host/<host>` and `?port=<n>` must name the configured host and
  port. Any other host or port gets `403 Forbidden` with the error
  `Server-configured credentials can only be used for the configured SSH host and port`.
  No SSH connection is opened.
- With `sso.enabled`, a `POST /ssh` or `POST /ssh/host/<host>` that falls
  back to the configured credentials follows the same rule for the path,
  body and query `host`/`port`.
- The socket never auto-connects with server-configured credentials to any
  other target.
- If `ssh.host` is not set, server-configured credentials are never used.

Visitors who send their own credentials (HTTP Basic Auth, a POST form with
`username` and `password`, or the login dialog) can still choose the host
and port, limited only by `ssh.allowedSubnets`.

The gateway refuses the request instead of silently dropping the configured
credentials and showing a login dialog. A refusal opens no connection to the
requested target at all and makes the misuse visible in logs and to the
caller.

An empty `ssh.allowedSubnets` still means "any destination" for
user-supplied credentials, even when server-configured credentials are set.
If you run a gateway with configured credentials, set `ssh.allowedSubnets`
to the configured host as well, so that no visitor can use the gateway to
reach other hosts:

```json
{
  "user": { "name": "kiosk", "password": "..." },
  "ssh": {
    "host": "10.0.0.5",
    "port": 22,
    "allowedSubnets": ["10.0.0.5/32"]
  }
}
```

## Running behind a reverse proxy (`http.trustProxy`)

By default the server ignores `X-Forwarded-For`, `X-Forwarded-Proto` and
`X-Forwarded-Host`. Behind a TLS-terminating proxy this means every request
looks like plain HTTP from the proxy's address: no `Strict-Transport-Security`
header, the `connect-src` variant that also allows `http://` and `ws://`, a
session cookie without `Secure`, and per-IP limits (such as the
`POST /ssh/csp-report` throttle) keyed on the proxy's address.

Set `http.trustProxy` (`WEBSSH2_HTTP_TRUST_PROXY`) to tell the server which
peers may set those headers. It is passed to Express's `trust proxy` setting.
When it is set, requests forwarded as HTTPS get HSTS, the strict CSP variant,
a `Secure` session cookie and an `https://` socket URL, and `req.ip` is the
client address the proxy reports.

| Value | Meaning |
| --- | --- |
| unset, `false`, `0` or `[]` (default) | Trust no proxy; behavior is unchanged |
| `["10.0.0.5", "10.1.0.0/16", "loopback"]` | Trust only these peers (recommended) |
| `1`, `2`, … | Trust that many hops in front of the server |
| `true` | Trust every peer |

> **Warning:** Do not use `true` (or a hop count) when clients can reach the
> gateway directly, bypassing the proxy. Any client could then send its own
> `X-Forwarded-Proto` and `X-Forwarded-For` headers, choose the IP address the
> server logs and rate-limits by, and make plain-HTTP requests look like HTTPS.
> Prefer a list of the proxy's own addresses, and make sure the proxy
> overwrites (not appends to) `X-Forwarded-Proto`.

`sso.trustedProxies` is not affected: it is always matched against the
address of the peer that opened the TCP connection, never against
`X-Forwarded-For`.

## Process-level error handling

Every client socket event is validated before it reaches a handler, and each
handler catches its own errors, so a malformed message gets an error reply
instead of reaching the process level. As a last resort the server also
installs process handlers (`app/process-guards.ts`):

| Event | Behavior |
| --- | --- |
| `unhandledRejection` | Logged as `process_error`; the server keeps serving |
| `uncaughtException` | Logged as `process_error`; the server exits with code 1 after a short flush delay |

The server exits on an uncaught exception because Node.js does not guarantee
consistent state after one, and a half-working gateway is worse than a clean
restart. Run the server under a supervisor that restarts it: a Docker or
Compose restart policy (`--restart unless-stopped`), systemd `Restart=always`,
or a Kubernetes Deployment.

## Client bundle integrity verification

This gateway serves a pre-built browser bundle from the `webssh2_client` npm
package (`node_modules/webssh2_client/client/public`). To ensure the bytes we
ship match the bytes the client project built and published, CI verifies the
bundle's integrity **and provenance** before it can reach operators.

The verification (`npm run security:verify-bundle`, implemented in
`scripts/verify-client-bundle.ts`) does the following:

1. Resolves the pinned `webssh2_client` version from `package-lock.json`
   (exact-pinned, lockfile-anchored) and rejects anything below `5.1.0` — the
   first release carrying both `checksums.txt` and a sigstore attestation.
2. Downloads `checksums.txt` from the matching `v<version>` GitHub release over
   HTTPS, fail-closed and size-capped.
3. Verifies the file's sigstore attestation with `gh attestation verify`,
   pinned via `--cert-identity` to the client's release workflow on its signing
   ref:
   `https://github.com/billchurch/webssh2_client/.github/workflows/release.yml@refs/heads/main`.
   Pinning the certificate identity (not just `--repo`) is what proves the file
   was produced by the expected workflow — a bare `--repo` check would pass for
   any attestation from the repository, including one minted by a malicious
   workflow.
4. Verifies the installed `public/` files against the attested checksums with
   `sha256sum -c`.
5. Runs `npm audit signatures` for registry-side signature verification across
   the dependency tree (fails on invalid signatures, not on absent provenance).

### Where it runs

- **CI (`ci.yml`)**: a dedicated `verify-client-bundle` job runs the full check.
  It is skipped on fork and dependabot pull requests (read-only token / withheld
  secrets); the same-repo and main-branch runs are the gate of record. A
  negative-control step asserts that a deliberately wrong signer identity is
  rejected, so a `gh` behavior change cannot silently weaken the pin.
- **Image publish (`docker-publish.yml`)**: the bundle is extracted from the
  built image and verified pre-push, so the exact bytes shipped in the Docker
  image — not just the CI runner's `node_modules` — are gated. This runs once
  (the bundle is architecture-independent).

### Failure policy and overrides

Tamper-class failures (attestation mismatch, checksum mismatch, missing asset on
a `>= 5.1.0` release, invalid registry signature) always fail closed.

Network downloads are retried with bounded exponential backoff. If the GitHub
release CDN, the Attestations API, or the Rekor transparency log is genuinely
unreachable after retries, the failure is classified as an **outage** rather
than tamper. An outage — and only an outage — may be bypassed by a maintainer
re-running the workflow with the `bundle_verify_outage_override` input set,
which exposes `WEBSSH2_BUNDLE_VERIFY_OUTAGE_OVERRIDE=true` to the script. The
bypass is recorded in the run's logs and actor; tamper failures are never
bypassable.

The script also honors `WEBSSH2_CLIENT_DIR` to point verification at a bundle
extracted from elsewhere (used for the Docker image check).

## Credential POST CSRF protection

WebSSH2 accepts credentials on four POST routes, so that an outside
portal can post a login into the gateway:

- `POST /ssh` and `POST /ssh/host/:host`
- `POST /telnet` and `POST /telnet/host/:host`

These requests are cross-site by design, so they cannot carry a CSRF
token. Instead, WebSSH2 checks the `Origin` and `Sec-Fetch-Site` headers
that the browser sets, against an allowlist that you configure. The
reasons for this design are in
[ADR 0001](DOCS/adr/0001-origin-allowlist-for-credential-posts.md).

### Default risk

| Config key | Default | Exposure |
| --- | --- | --- |
| `http.allowedPostOrigins` | unset | **With this option unset and `sso.enabled` off, cross-site credential POSTs are accepted.** Any web page can make a visitor's browser POST a username, password and host of the attacker's choice (login CSRF). The visitor then gets a terminal on a host and account that the attacker controls, and anything they type there goes to the attacker |

The default stays permissive so that an upgrade does not break existing
portal integrations. If you do not post credentials from another site,
or you know which sites do, set the allowlist.

### When the check runs

The check runs on the four routes above, and on no other route, when
either of these is true:

- `http.allowedPostOrigins` is not empty
- `sso.enabled` and `sso.csrfProtection` are both `true`

When neither is true, the routes accept every POST, as before.

When `sso.enabled` is `true`, two kinds of request skip the check:

- requests whose TCP peer address is in `sso.trustedProxies` (never
  matched against `X-Forwarded-For`, even with `http.trustProxy` set)
- requests that carry the `x-apm-username` or `x-apm-session` header

A cross-site HTML form cannot set custom headers, and `fetch()` cannot
set them on a cross-site request without passing a CORS preflight,
which WebSSH2 does not grant on these routes. So this bypass does not
weaken the CSRF protection.

### Decision table

The rules are evaluated in this order. The first match wins.

| # | Request | Result |
| --- | --- | --- |
| 1 | `Sec-Fetch-Site: same-origin` | Accept |
| 2a | `Origin: null` | Reject |
| 2b | `Origin` listed in `allowedPostOrigins` | Accept |
| 2c | `Origin` present, not listed | Reject |
| 3 | Neither `Origin` nor `Sec-Fetch-Site` present | Accept (debug log) |
| 4 | Anything else | Reject |

The same rules, one row per header combination:

| `Origin` | `Sec-Fetch-Site` | Step | Result |
| --- | --- | --- | --- |
| any or absent | `same-origin` | 1 | Accept |
| `null` | absent, `same-site`, `cross-site` or `none` | 2a | Reject |
| listed | absent, `same-site`, `cross-site` or `none` | 2b | Accept |
| not listed (or malformed) | absent, `same-site`, `cross-site` or `none` | 2c | Reject |
| absent | absent | 3 | Accept |
| absent | `same-site` | 4 | Reject |
| absent | `cross-site` | 4 | Reject |
| absent | `none` | 4 | Reject |

Notes:

- With `sso.csrfProtection` on and an empty allowlist, step 2b can never
  match. Only same-origin POSTs (and the SSO bypasses) pass.
- Same-origin is detected only from `Sec-Fetch-Site`. WebSSH2 never
  compares `Origin` with `Host`, because that gives the wrong answer
  behind a TLS-terminating proxy.
- Step 3 exists because every current browser sends `Origin` on a
  cross-site POST. A request with neither header comes from curl, a
  script or another server, and cannot carry a victim's cookies.

### Allowlist entries

Each entry must be a bare origin, `scheme://host[:port]`, with an `http`
or `https` scheme. Matching ignores case and the scheme's default port
(`:443` for https, `:80` for http), so `HTTPS://Portal.Example.com:443`
matches `https://portal.example.com`. One trailing `/` is accepted and
removed.

The server refuses to start if an entry has a path, query string,
fragment or user info, uses a wildcard (`*`), is `null`, or uses another
scheme. The error names the bad entry. Enter internationalized host
names in their `xn--` (punycode) form.

```json
{
  "http": {
    "allowedPostOrigins": ["https://portal.example.com"]
  }
}
```

```bash
WEBSSH2_HTTP_ALLOWED_POST_ORIGINS="https://portal.example.com"
```

### Rejections

A rejected POST gets `403` with the body `{"error":"Forbidden"}`. The
server logs a `policy_block` event at warn level, with
`reason: post_origin_<step>` and the route, `Origin`, `Sec-Fetch-Site`
and step in the event details. The posted body, which holds the
credentials, is never logged.

### Examples

**An outside portal.** A login page at `https://portal.example.com`
posts a form to `https://ssh.example.com/ssh/host/server1`. Set:

```bash
WEBSSH2_HTTP_ALLOWED_POST_ORIGINS="https://portal.example.com"
```

The browser sends `Origin: https://portal.example.com` and
`Sec-Fetch-Site: same-site` or `cross-site`. Step 2b accepts it. A form
on any other site is rejected at step 2c.

**SSO behind a trusted proxy.** An access proxy at `10.0.0.5`
authenticates users and forwards their POST to WebSSH2:

```bash
WEBSSH2_SSO_ENABLED=true
WEBSSH2_SSO_CSRF_PROTECTION=true
WEBSSH2_SSO_TRUSTED_PROXIES="10.0.0.5"
```

Requests from `10.0.0.5`, and requests with the `x-apm-username` header,
skip the check. A cross-site form posted straight to WebSSH2 from
another site is rejected. If users also post from a portal page, add its
origin to `WEBSSH2_HTTP_ALLOWED_POST_ORIGINS`.

**A curl or script integration.** A script posts credentials:

```bash
curl -X POST https://ssh.example.com/ssh/host/server1 \
  -d username=deploy -d password="$PASSWORD"
```

curl sends neither `Origin` nor `Sec-Fetch-Site`, so step 3 accepts it
whatever the allowlist holds. If the script sets an `Origin` header,
that origin must be on the list.

## Security Disclosure Policy

- **Private Disclosure**: We request that you give us reasonable time to address the issue before public disclosure
- **Coordinated Disclosure**: We will coordinate with you on the disclosure timeline
- **Public Advisory**: Once a fix is released, we will publish a security advisory detailing the vulnerability, the fix, and assigning credit.

Thank you for helping keep WebSSH2 and its users secure!

## Solid-js and Seroval vulnerability assessment

As of 2026-01-27, we evaluated the following vulnerabilities affecting our client dependencies:

### CVE-2026-23737 (Seroval RCE)

| Aspect            | Status                                           |
| ----------------- | ------------------------------------------------ |
| Affected versions | seroval < 1.4.1                                  |
| Our version       | seroval@1.5.0 (transitive via solid-js)          |
| Status            | **Not vulnerable** - already on patched version  |

This vulnerability affects the `fromJSON` and `fromCrossJSON` functions in client-to-server transmission scenarios, requiring Solid Start server functions to exploit.

**Why we are not affected:**

- webssh2_client is a plain Solid.js SPA, not a Solid Start application
- No `"use server"` directives or server functions are used
- All client-server communication uses Socket.IO's native JSON serialization
- seroval is only a transitive dependency and is not directly imported or used

### CVE-2025-27109 (Solid-js XSS)

| Aspect             | Status                                          |
| ------------------ | ----------------------------------------------- |
| Vulnerability type | Cross-site Scripting (XSS)                      |
| Status             | **Not vulnerable** - safe coding patterns used  |

**Why we are not affected:**

- No `innerHTML` or `dangerouslySetInnerHTML` usage in the codebase
- All JSX uses Solid.js safe text binding
- Terminal output is rendered through xterm.js which safely handles escape sequences

### CVE-2026-33671 (picomatch ReDoS in bundled npm)

| Aspect             | Status                                                                          |
| ------------------ | ------------------------------------------------------------------------------- |
| Vulnerability type | Regular Expression Denial of Service (ReDoS) via crafted extglob patterns       |
| Affected versions  | picomatch < 4.0.4 (also fixed in 3.0.2 and 2.3.2)                               |
| Our exposure       | picomatch 4.0.3 bundled inside the global `npm` shipped in `node:22-alpine`     |
| Path on disk       | `/usr/local/lib/node_modules/npm/node_modules/picomatch` (in the runtime image) |
| Status             | **Not exploitable** — bundled `npm` is never executed at runtime                |

**Why we are not affected:**

- The container's `ENTRYPOINT` is `tini` and `CMD` is `node dist/index.js`.
- The application never invokes `npm`, `npx`, or any code path that loads
  `picomatch` from the global npm install. There is no shell exec of `npm`,
  no `child_process.spawn('npm', ...)`, and no library in our production
  dependency closure that pulls picomatch.
- An attacker would need code execution inside the container to reach
  picomatch — at which point ReDoS is the least of our concerns.

**Mitigation status:**

- **Resolved 2026-07-28**: the Dockerfile runtime stage now upgrades the
  bundled npm to a pinned `npm@11.18.0`, which vendors picomatch 4.0.4
  (patched). The `.trivyignore` entry has been removed.

### CVE-2026-14257 (brace-expansion DoS in bundled npm)

| Aspect             | Status                                                                         |
| ------------------ | ------------------------------------------------------------------------------ |
| Vulnerability type | Denial of Service via unbounded expansion length (out-of-memory crash)         |
| Affected versions  | brace-expansion <= 5.0.7 (fixed in 5.0.8, published 2026-07-23)                |
| Our exposure       | brace-expansion 5.0.7 vendored inside the pinned global `npm@11.18.0`          |
| Path on disk       | `/usr/local/lib/node_modules/npm/node_modules/brace-expansion` (runtime image) |
| Status             | **Not exploitable** — bundled `npm` never processes attacker-controlled globs  |

**Why we are not affected:**

- The container's `ENTRYPOINT` is `tini` and `CMD` is `node dist/index.js`;
  the application never invokes `npm` or loads code from the global npm
  install.
- The only supported use of `npm` inside the container is the operator-run
  `npm run hostkeys:prod` host-key CLI, which executes first-party
  package.json scripts. No attacker-controlled glob patterns reach npm's
  brace-expansion.
- As of 2026-07-28 no published npm release vendors brace-expansion 5.0.8
  (the fix postdates every npm release), so no upgrade path exists yet.

**Mitigation status:**

- The Dockerfile runtime stage pins `npm@11.18.0`, which already remediates
  the more severe bundled-npm findings (tar CVE-2026-59873 CRITICAL /
  CVE-2026-59874 HIGH, sigstore CVE-2026-48815 HIGH).
- The `.trivyignore` file suppresses this single CVE for the Trivy image
  scan gate so unrelated image regressions still fail the build.
- Re-evaluate on each npm release: bump the pinned npm version in the
  Dockerfile once a release vendors brace-expansion >= 5.0.8, then remove
  the `.trivyignore` entry.

### GHSA-mh99-v99m-4gvg (brace-expansion 1.x in dev toolchain, npm audit)

| Aspect             | Status                                                                        |
| ------------------ | ----------------------------------------------------------------------------- |
| Vulnerability type | Denial of Service via unbounded expansion length (same root as CVE-2026-14257)|
| Affected versions  | advisory range <= 5.0.7; only 5.0.8 listed as patched as of 2026-07-28        |
| Our exposure       | brace-expansion 1.1.16 via `minimatch@3` inside the eslint dev toolchain      |
| Status             | **Remediated 2026-07-28** — eslint toolchain upgraded; vulnerable copy removed|

**Why we are not affected:**

- The vulnerable copy exists only under `@eslint/config-array`,
  `@eslint/eslintrc`, and `eslint-plugin-node` — all devDependencies. It is
  absent from the production install (`npm ci --omit=dev`) and the Docker
  image.
- Lint glob patterns are first-party (eslint config), not attacker input.
- No patched 1.x release of brace-expansion exists, and overriding the 1.x
  copy with 2.x/5.x breaks minimatch@3 at runtime (the CommonJS default
  export was replaced by a named `expand` export). Upstream backports for the
  2.x/3.x lines landed 2026-07-27/28, but the advisory range remained a
  blanket `<= 5.0.7`, so npm audit would flag them regardless.

**Remediation (2026-07-28):** upgraded the lint toolchain to `eslint@10.7.0`
(with `@eslint/js@10.0.1`, `@typescript-eslint/*@8.64.0`,
`eslint-plugin-unicorn@71.1.0`) and replaced the unmaintained
`eslint-plugin-node` with `eslint-plugin-n@18.2.2`. eslint 10 drops
`@eslint/eslintrc` and uses `minimatch@^10.2.5` → `brace-expansion@5.0.8`
throughout, removing every vulnerable copy from the tree; `npm audit` reports
0 vulnerabilities. Versions were chosen to also satisfy the 14-day
new-release quarantine (all published on or before 2026-07-14).

---

## August 2026 npm audit findings (socket.io-parser, nanoid, brace-expansion)

As of 2026-08-18, `npm audit --audit-level=high` reported three HIGH
advisories. All were remediated the same day under the CVE exception to the
14-day quarantine; each fix version was verified against its maintainer and
publish date before adoption.

### GHSA-2m8v-j782-fhvr (socket.io-parser zero-attachment memory exhaustion)

| Aspect             | Status                                                                        |
| ------------------ | ----------------------------------------------------------------------------- |
| Vulnerability type | Memory exhaustion via crafted binary packets declaring zero attachments       |
| Affected versions  | 4.0.0 – 4.2.6                                                                 |
| Our exposure       | **Production** — `socket.io@4.8.3` → `socket.io-parser`; our own `overrides` pinned 4.2.6 |
| Status             | **Remediated 2026-08-18** — override bumped to 4.2.7 (published 2026-07-15)   |

This is the only production-path finding. Any WebSocket client able to reach
the Socket.IO endpoint could send the malformed packet, so it was treated as
directly exploitable. `socket.io`'s own `~4.2.4` range resolves to 4.2.7
naturally; the override is retained to make the floor explicit.

### GHSA-2v37-7h3g-55p8 (nanoid infinite loop with zero-size custom generator)

| Aspect             | Status                                                                        |
| ------------------ | ----------------------------------------------------------------------------- |
| Vulnerability type | Denial of Service — custom generators loop indefinitely when `size` is 0      |
| Affected versions  | < 3.3.18                                                                      |
| Our exposure       | Dev toolchain only — `vitest` → `vite` → `postcss` → `nanoid@3.3.16`          |
| Status             | **Remediated 2026-08-18** — new `overrides` pin `nanoid@3.3.18` (published 2026-08-07) |

Not present in the production install (`npm ci --omit=dev`) or the Docker
image. postcss's own floor (`^3.3.16`) is satisfied by the vulnerable
version, so an explicit override was required to force the bump.

### GHSA-rgw5-rvv9-x895 (brace-expansion DoS via unbounded intermediate arrays)

| Aspect             | Status                                                                        |
| ------------------ | ----------------------------------------------------------------------------- |
| Vulnerability type | Denial of Service — bypass of the CVE-2026-14257 mitigation                   |
| Affected versions  | 4.0.0 – 5.0.8                                                                 |
| Our exposure       | Dev toolchain only — `eslint-plugin-sonarjs` → `minimatch@10.2.6` → `brace-expansion@5.0.8` |
| Status             | **Remediated 2026-08-18** — lockfile refreshed to 5.0.9 (published 2026-07-30) |

Same posture as GHSA-mh99-v99m-4gvg above: devDependency only, lint glob
patterns are first-party. No override needed — 5.0.9 sits inside minimatch's
existing `^5.0.8` range.

---

## October 2026 npm audit findings (proxy-addr, engine.io, qs, vitest, brace-expansion, source-map-js)

As of 2026-10-06, `npm audit` reported 8 advisories (1 CRITICAL, 3 HIGH,
4 MODERATE); 5 were on the production path. The lockfile was regenerated with
`npm install --before=2026-09-22` so every resolved version honors the 14-day
quarantine. The single exception is `source-map-js@1.2.2` (HIGH, published
2026-09-30), adopted under the CVE exception after verifying the publisher
(`7rulnik`, same maintainer as 1.2.1) and reviewing the tarball diff (bounds
on section offsets only; no new imports, network calls, or lifecycle scripts).

Dependabot PR #576 was closed rather than merged: it bumped `vitest` to the
5.x major (published < 14 days) while leaving `@vitest/coverage-v8` on 4.x,
which broke `npm ci` with `ERESOLVE`.

### GHSA-jqcg-44mw-7w3h (proxy-addr IP spoofing via IPv4-mapped IPv6 trust subnet)

| Aspect | Status |
| --- | --- |
| Vulnerability type | IP spoofing — IPv4-mapped IPv6 addresses match IPv4 trust subnets |
| Affected versions | 1.1.0 – 2.0.7 (CRITICAL) |
| Our exposure | **Production** — `express@5.2.1` → `proxy-addr@2.0.7` |
| Status | **Remediated 2026-10-06** — lockfile refreshed to 2.0.8 (published 2026-09-15) |

Not exploitable in our default configuration: the server sets Express
`trust proxy` only when `http.trustProxy` is configured (unset by default), so
`proxy-addr` trusts no hops and `req.ip` is always the socket peer address. Patched regardless because it is on the production path.
2.0.8 sits inside Express's `~2.0.7` range; no override needed.

### GHSA-2gc4-cqfq-p2gv (Engine.IO protocol revision mismatch DoS)

| Aspect | Status |
| --- | --- |
| Vulnerability type | Denial of Service via protocol revision mismatch |
| Affected versions | 6.6.0 – 6.6.9 (HIGH) |
| Our exposure | **Production** — `socket.io@4.8.3` → `engine.io@6.6.9` |
| Status | **Remediated 2026-10-06** — new `overrides` pin `engine.io@6.6.10` (published 2026-09-03) |

Reachable by any client that can open a Socket.IO connection, so treated as
directly exploitable. Pinned to 6.6.10 rather than 6.6.11 (published
2026-09-24, inside the quarantine window).

### GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g (qs array-limit bypass, isBuffer DoS)

| Aspect | Status |
| --- | --- |
| Vulnerability type | Array-limit bypass via bracket-key comma parsing; DoS via attacker-controlled `isBuffer` |
| Affected versions | < 6.16.0 (MODERATE) |
| Our exposure | **Production** — `express` / `body-parser` → `qs`; our own `overrides` pinned 6.15.2 |
| Status | **Remediated 2026-10-06** — override bumped to 6.16.0 (published 2026-08-29) |

### GHSA-82fw-gwwq-j7x9 (Vitest path traversal via @vitest/mocker redirect mock)

| Aspect | Status |
| --- | --- |
| Vulnerability type | Arbitrary file read via mock redirect |
| Affected versions | 2.1.0 – 4.1.10 (MODERATE) |
| Our exposure | Dev toolchain only — `vitest`, `@vitest/coverage-v8`, `@vitest/mocker` |
| Status | **Remediated 2026-10-06** — pinned `vitest` and `@vitest/coverage-v8` to 4.1.11 (published 2026-08-18) |

### GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p, GHSA-q2hr-2g5m-vwhr (brace-expansion DoS)

| Aspect | Status |
| --- | --- |
| Vulnerability type | Stack exhaustion / quadratic-time expansion |
| Affected versions | 4.0.0 – 5.0.10 (HIGH) |
| Our exposure | Dev toolchain only — `eslint-plugin-sonarjs` → `minimatch` → `brace-expansion@5.0.9` |
| Status | **Remediated 2026-10-06** — lockfile refreshed to 5.0.12 (published 2026-09-14) |

### GHSA-68fv-2mgg-jv7q (source-map-js indexed source-map DoS)

| Aspect | Status |
| --- | --- |
| Vulnerability type | Event-loop DoS via huge indexed source-map section offsets |
| Affected versions | 1.0.0 – 1.2.1 (HIGH) |
| Our exposure | Dev toolchain only — `vitest` → `vite` → `postcss` / `magicast` → `source-map-js` |
| Status | **Remediated 2026-10-06** — lockfile refreshed to 1.2.2 under the CVE exception (see above) |

Only first-party source maps are processed, so practical exposure was nil.

### GHSA-587h-7wmj-h5pm, GHSA-r825-w8mm-5pxw, GHSA-698v-4r3x-3vcv (launch-editor in vite)

| Aspect | Status |
| --- | --- |
| Vulnerability type | Editor-launch command injection and Windows path checks in the `launch-editor` code bundled by the vite dev server |
| Affected versions | vite 8.0.0 – 8.1.5 (one HIGH, two MODERATE; published 2026-10-20) |
| Our exposure | Dev toolchain only — `vitest` → `vite`. The project never runs the vite dev server, and vite is not in the runtime image |
| Status | **Remediated 2026-10-20** — the stale `vite` override was dropped in #589, so `vitest` now resolves the patched `vite` 8.3.3 |

---

## Bundled-npm findings in the runtime image (Trivy, 2026-08-18)

Trivy's image scan (`docker-image-scan` CI job) began flagging two HIGH CVEs
on 2026-08-18. Both live under
`/usr/local/lib/node_modules/npm/node_modules/` — the global `npm@11.18.0`
pinned by the Dockerfile runtime stage — not in the application dependency
tree. As of 2026-08-18 no published npm release (latest checked: 11.19.0,
2026-07-29) vendors the fixed versions, so there is no upgrade path yet. Both
are suppressed in `.trivyignore` with the assessments below.

### CVE-2026-69152 (brace-expansion DoS bypass in bundled npm)

| Aspect             | Status                                                                         |
| ------------------ | ------------------------------------------------------------------------------ |
| Advisory           | GHSA-rgw5-rvv9-x895 (published 2026-08-03)                                     |
| Vulnerability type | Denial of Service via unbounded intermediate arrays (bypasses CVE-2026-14257 fix) |
| Affected versions  | 4.0.0 – 5.0.8 (fixed in 5.0.9, published 2026-07-30)                           |
| Our exposure       | brace-expansion 5.0.7 vendored inside the pinned global `npm@11.18.0`          |
| Status             | **Not exploitable** — same rationale as CVE-2026-14257 above                   |

The application's own copy (dev toolchain, via minimatch) was moved to 5.0.9
the same day — see the August 2026 npm audit section above. Only the bundled
npm copy remains, and the container never invokes npm on attacker-controlled
glob patterns.

### CVE-2026-69192 (ip-address SSRF in bundled npm)

| Aspect             | Status                                                                         |
| ------------------ | ------------------------------------------------------------------------------ |
| Advisory           | GHSA-mwp4-54f8-5fhr (published 2026-08-03)                                     |
| Vulnerability type | Inconsistent leading-zero octet parsing → SSRF / trust-boundary bypass         |
| Affected versions  | < 10.3.1 (fixed in 10.3.1, published 2026-07-25)                               |
| Our exposure       | ip-address 10.2.0 vendored inside `npm@11.18.0` via `socks-proxy-agent` → `socks` |
| Status             | **Not exploitable** — code path only runs when npm uses a SOCKS proxy         |

**Why we are not affected:**

- `ip-address` is not a dependency of webssh2; it exists in the image solely
  as npm's SOCKS proxy support. The application (`node dist/index.js`) never
  loads code from `/usr/local/lib/node_modules/npm`.
- The only in-container npm use is the operator-run `npm run hostkeys:prod`,
  which does not talk to a registry or proxy.
- `socks@2.8.9` declares `ip-address@^10.1.1`, so a future npm release that
  refreshes its lockfile will pick up 10.3.1 automatically.

**Re-evaluate on each npm release:** bump the Dockerfile `npm@11.18.0` pin
once a release vendors brace-expansion >= 5.0.9 and ip-address >= 10.3.1,
then remove both `.trivyignore` entries (and CVE-2026-14257's).

**Resolved 2026-10-06:** the npm pin moved to 11.20.0, which vendors
brace-expansion 5.0.9 and ip-address 10.5.0. The CVE-2026-14257,
CVE-2026-69152 and CVE-2026-69192 entries were removed from `.trivyignore`.

---

## Bundled-npm and base-image findings in the runtime image (Trivy, 2026-10-06)

On 2026-10-06 the `docker-image-scan` job reported 6 HIGH findings: OpenSSL
in the Alpine base image, and `brace-expansion`, `tar` and `undici` vendored
inside the global `npm@11.18.0`.

| CVE | Package | Fixed in | Resolution |
| --- | --- | --- | --- |
| CVE-2026-14456 | `libcrypto3`, `libssl3` 3.5.7-r0 | 3.5.8-r0 | **Fixed** — base image digest bumped (see below) |
| CVE-2026-73566 | `tar` 7.5.19 (bundled npm) | 7.5.21 | **Fixed** — npm pin 11.18.0 → 11.20.0 (vendors tar 7.5.22) |
| CVE-2026-102276, CVE-2026-102278 | `brace-expansion` 5.0.9 (bundled npm) | 5.0.10 / 5.0.11 | **Suppressed** in `.trivyignore` — no npm release vendors the fix |
| CVE-2026-19534 | `undici` 6.28.0 (bundled npm) | 6.28.1 | **Suppressed** in `.trivyignore` — no npm release vendors the fix |

**Base image:** `node:22-alpine` digest moved from `sha256:e58326d0…` (Node
22.22.3, OpenSSL 3.5.7-r0) to `sha256:0a7108bf…` (Node 22.23.3, Alpine
3.24.2, OpenSSL 3.5.8-r0), built 2026-09-23. That is one day inside the
14-day quarantine and is adopted under the HIGH-CVE exception: it is a Docker
Official Image, and the change is the routine upstream rebuild.

**npm pin:** 11.20.0 was published 2026-09-22 (14 days, quarantine
satisfied) by the npm CLI team, with no install scripts. 11.21.0
(2026-09-30) was checked and vendors the same vulnerable `brace-expansion`
and `undici`, so moving past the quarantine would not have cleared anything.

**Why the suppressed findings are not exploitable:**

- The application (`node dist/index.js`) never loads code from
  `/usr/local/lib/node_modules/npm`. The only in-container npm use is the
  operator-run `npm run hostkeys:prod`, which runs a first-party script.
- `brace-expansion` is only reached through npm's own glob handling of
  first-party patterns; no attacker-controlled input reaches it.
- `undici`'s flaw is in WebSocket subprotocol handling. npm never opens
  WebSocket connections.

**Re-evaluate on each npm release:** bump the Dockerfile npm pin once a
release vendors brace-expansion >= 5.0.11 and undici >= 6.28.1, then remove
the three `.trivyignore` entries.

---

## Shai-hulud 2.0 supply chain risk

As of 2026-01-27, automated checks for Shai-hulud 2.0 indicators of compromise (IoCs) found **no evidence of compromise** in this repository.

The scanner performed the following checks:

- Searched for risky npm lifecycle scripts (preinstall, postinstall)
- Checked for known Shai-hulud 2.0 payload files (setup_bun.js, bun_environment.js)
- Inspected GitHub Actions workflows for discussion-triggered backdoor patterns and secret-dumping jobs
- Searched for known self-hosted runner and Docker breakout markers
- Checked for leaked cloud credentials and unsafe npm token usage
- Compared dependencies against a supplied list of known compromised npm packages (if provided)

No matches were found. This is not a guarantee of safety, but it indicates that this project does not currently exhibit known Shai-hulud 2.0 patterns.

### Hardening against Shai-hulud-style attacks

Regardless of current status, this project aims to reduce supply chain risk through the following practices:

- Dependencies are pinned, with automated checks to avoid adopting very recent releases until they age out an organization-defined delay window.
- CI/CD tokens and cloud credentials follow least-privilege and short-lived patterns.
- GitHub Actions workflows are restricted to known, reviewed actions from trusted sources.
- Secret scanning is enabled for this repository.
- npm lifecycle scripts are avoided where possible and are never used to download and execute remote code.
  The project defines no `preinstall`, `install` or `postinstall` script of its own, and no project
  script runs `npm install` (see [Install-time lifecycle scripts](#install-time-lifecycle-scripts)).
- Cloud IAM policies are configured so that developer or CI credentials cannot directly access production infrastructure.

For more information about detection logic or mitigations, contact the security team via [GitHub Security Advisories](https://github.com/billchurch/WebSSH2/security/advisories).

---

## Install-time lifecycle scripts

As of 2026-10-20, the project no longer ships `scripts/postinstall.js`. That
script ran on every `npm install` (and from `npm run prepare:runtime`, which CI
called after `npm ci --ignore-scripts`) and installed a platform-specific
`@rollup/rollup-*` native binary with `npm install <pkg> --no-save` and no
version. Because the package was resolved outside `package-lock.json`, it
skipped lockfile pinning, `npm ci` integrity checks and the 14-day quarantine
for new releases.

| Aspect | Status |
| --- | --- |
| Why it was safe to remove | Vitest now runs on Vite 8 (Rolldown/Oxc); no package in the lockfile depends on `rollup` or `@rollup/rollup-*` |
| `postinstall` | Removed from `package.json` |
| `prepare:runtime` | Kept as a no-op for downstream pipelines that call it; it installs nothing |
| CI (`.github/workflows/ci.yml`), devcontainer setup | No longer call `prepare:runtime`; installs stay `npm ci --ignore-scripts` plus `npm rebuild better-sqlite3` |
| Docker image | Never ran the script; unchanged apart from a comment |
| Release tarball | No longer includes `scripts/postinstall.js` |
| Regression test | `tests/unit/scripts/lifecycle-scripts.vitest.ts` fails if an install-time lifecycle script or an unpinned `npm install` returns |

Any native binary a future dependency needs must arrive through the lockfile
(for example as a pinned `optionalDependencies` entry gated by `os`/`cpu`),
never from a script that installs packages at install time.

---

## Rollup path traversal vulnerability (GHSA-mw96-cpmx-2vgc)

As of 2026-02-26, we evaluated the following vulnerability affecting our dev dependencies:

### GHSA-mw96-cpmx-2vgc (Rollup Arbitrary File Write)

| Aspect            | Status                                              |
| ----------------- | --------------------------------------------------- |
| Affected versions | rollup 4.0.0 - 4.58.0                              |
| Severity          | HIGH                                                |
| Our version       | rollup@4.59.0 (updated from 4.57.1)                |
| Status            | **Patched** - updated to fixed version              |

This vulnerability allows arbitrary file writes via path traversal in rollup's bundle output.

**Action taken:**

- Updated rollup from 4.57.1 to 4.59.0 which includes the fix
- rollup is a dev dependency only (used by Vitest) and does not ship in production builds
- Exception to the 2-week age-out policy was granted due to high severity

---

## TeamPCP / CanisterWorm supply chain attack (Trivy compromise)

As of 2026-03-24, we evaluated the TeamPCP campaign that compromised
Aqua Security's GitHub and Docker Hub accounts, injecting malware
into the Trivy vulnerability scanner and propagating a
self-replicating worm ("CanisterWorm") through npm packages.

### Exposure assessment

This repository uses `aquasecurity/trivy-action` in CI (`ci.yml`):

| Aspect | Status |
| --- | --- |
| Trivy action pinning | Pinned to commit SHA `76071ef0...` (v0.31.0) |
| Compromised packages in deps | **None found** |
| Filesystem IOCs | **None found** |
| npm publishing | **Not applicable** — webssh2 is not published to npm |
| Status | **Not compromised** |

### Why we are not affected

- GitHub Actions are **pinned to commit SHAs**, not mutable tags,
  preventing silent tag-based substitution
- The pinned SHA `76071ef0d7ec797419534a183b498b4d6366cf37` predates
  the compromise and was verified against the pre-incident
  repository state
- This repository does not publish to npm and has no npm tokens
  configured, so there is nothing for the worm to exfiltrate or
  abuse
- No known compromised dependencies were found in
  `package-lock.json`

### Remediation actions taken

1. **Trivy action review**: Confirmed pinned SHAs correspond to
   legitimate pre-compromise commits
2. **IOC scan**: Checked build systems for CanisterWorm filesystem
   artifacts — none found
3. **Dependency audit**: Scanned all `package-lock.json` files
   against known compromised package list — clean

### CanisterWorm indicators of compromise (IOCs)

For reference, the following IOCs were published by Aikido and
Socket:

**C2 infrastructure:**

- ICP canister: `tdtqy-oyaaa-aaaae-af2dq-cai.raw.icp0.io`
- Cloudflare tunnels:
  `souls-entire-defined-routes.trycloudflare.com`,
  `investigation-launches-hearings-copying.trycloudflare.com`,
  `championships-peoples-point-cassette.trycloudflare.com`

**Filesystem artifacts:**

- `~/.local/share/pgmon/service.py`,
  `~/.config/systemd/user/pgmon.service`
- `/var/lib/svc_internal/runner.py`, `/var/lib/pgmon/pgmon.py`
- `/tmp/pglog`, `/tmp/.pg_state`

**Kubernetes artifacts (kube-system namespace):**

- DaemonSets: `host-provisioner-iran`, `host-provisioner-std`
- Container names: `kamikaze` (wiper), `provisioner` (backdoor)

**Compromised npm packages (partial list):**

- 28 packages in `@EmilGroup` scope, 16 in `@opengov` scope
- `@teale.io/eslint-config` (v1.8.11, v1.8.12),
  `@airtm/uuid-base32`, `@pypestream/floating-ui-dom`

### References

- [Ars Technica — Self-propagating malware poisons open source software](https://arstechnica.com/security/2026/03/self-propagating-malware-poisons-open-source-software-and-wipes-iran-based-machines/)
- [Aikido — TeamPCP Deploys CanisterWorm on NPM Following Trivy Compromise](https://www.aikido.dev/blog/teampcp-deploys-worm-npm-trivy-compromise)
- [Aikido — CanisterWorm Gets Teeth: TeamPCP's Kubernetes Wiper Targets Iran](https://www.aikido.dev/blog/teampcp-stage-payload-canisterworm-iran)

## Axios npm supply chain attack (March 2026)

As of 2026-03-31, we evaluated the axios npm supply chain attack in which
a compromised maintainer account was used to publish malicious versions
containing a cross-platform RAT delivered via a hidden `plain-crypto-js`
dependency.

### Exposure assessment

| Aspect | Status |
| --- | --- |
| Compromised versions | `axios@1.14.1`, `axios@0.30.4` |
| axios in dependencies | **Not present** — webssh2 does not use axios |
| `plain-crypto-js` in deps | **Not found** |
| Other compromised packages | **Not found** (`@qqbrowser/openclaw-qbot`, `@shadanai/openclaw`) |
| Filesystem IOCs | **None found** |
| Status | **Not compromised** |

### Why we are not affected

- webssh2 **does not depend on axios** at all — neither directly nor
  transitively
- The malicious dependency `plain-crypto-js@4.2.1` is not present in
  `package-lock.json`
- No filesystem IOCs were found on build systems
- This repository does not publish to npm and has no npm tokens configured

### Indicators of compromise (IOCs)

For reference, the following IOCs were published by Snyk:

**C2 infrastructure:**

- Domain: `sfrclak[.]com:8000` (IP: `142.11.206.73`)

**Filesystem artifacts:**

- macOS: `/Library/Caches/com.apple.act.mond`
- Windows: `%PROGRAMDATA%\wt.exe`
- Linux: `/tmp/ld.py`

**Compromised npm packages:**

- `axios@1.14.1`, `axios@0.30.4`
- `plain-crypto-js@4.2.1` (hidden malicious dependency)
- `@qqbrowser/openclaw-qbot@0.0.130`
- `@shadanai/openclaw` (versions `2026.3.31-1`, `2026.3.31-2`)

### References

- [Snyk — Axios npm package compromised in supply chain attack](https://snyk.io/blog/axios-npm-package-compromised-supply-chain-attack-delivers-cross-platform/)

---

## esbuild RCE via Deno module (GHSA-gv7w-rqvm-qjhr)

As of 2026-07-30, we completed mitigation of GHSA-gv7w-rqvm-qjhr, a remote
code execution flaw in esbuild's Deno module (`lib/deno/mod.ts`) that downloads
native binaries and writes them to disk with executable permissions without
integrity verification when `NPM_CONFIG_REGISTRY` is attacker-controlled.

### Exposure assessment

| Aspect | Status |
| --- | --- |
| Affected versions | esbuild 0.17.0 - < 0.28.1 |
| Severity | HIGH (CVSS 8.1) |
| Mitigation | **Retired** — vulnerable range no longer resolved; remaining esbuild is tsx's dev-only copy at 0.28.1 (patched) via natural resolution |
| Dependency path | dev-only: `tsx` → `esbuild@0.28.1` (patched); `vitest` → `vite@8.3.3` (Rolldown/Oxc, no esbuild). Vite 8 lists esbuild only as an optional peer, satisfied by tsx's copy — it does not pull esbuild itself |
| Resolution | Vite 8 migration removes esbuild from the vite/vitest chain; tsx retains the patched 0.28.1 |

### Mitigation history

**2026-06-16**: Initial assessment — esbuild@0.28.1 pinned via `overrides`

- The vulnerable code is in esbuild's **Deno** module; webssh2 runs under
  **Node.js** only (no Deno usage), so the code path was never reachable.
- However, for defense-in-depth, added `overrides.esbuild: "^0.28.1"` (pinned
  to fixed release) and bumped Vite 7.3.2 → 7.3.5, Vitest 4.1.4 → 4.1.9.
- esbuild 0.28.1 (published 2026-06-11) applied the quarantine exception for
  HIGH-severity advisories.
- Related advisory GHSA-g7r4-m6w7-qqqr (dev-server) also resolved.

**2026-07-30**: Cleanup complete — Vite 8 migration (issue [#550](https://github.com/billchurch/webssh2/issues/550))

- Upgraded Vitest to Vite 8.1.4 (Rolldown/Oxc backend), eliminating the vulnerable
  esbuild chain: Vitest → Vite 8.1.4 no longer requires esbuild.
- Retired `overrides.esbuild: "^0.28.1"` mitigation entirely — no longer needed.
- esbuild still present as dev-only: `tsx@4.23.1` (TypeScript runner, esbuild-based
  by design) requires `esbuild ~0.28.0`, which resolves to **0.28.1 (the fixed version)** by natural resolution.
- webssh2_client upgraded to v5.4.0 (billchurch/webssh2_client#132), clearing
  esbuild from the client build entirely.
- Vite 8.1.4 override remains temporarily for supply-chain quarantine
  (8.1.5 published within 14-day window). Will be dropped once a ≥14-day-old
  Vite 8.x release becomes available.
- `npm audit --audit-level=high` reports 0 vulnerabilities.

**2026-10-20**: Quarantine pins retired (issue [#585](https://github.com/billchurch/webssh2/issues/585))

- Removed the temporary `overrides` pins `vite: 8.1.4` and `lightningcss: 1.32.0`.
  Both now resolve from `vitest`'s own range. The lockfile was regenerated with
  `npm install --before=2026-10-06T22:00:00Z`, so every changed version is at
  least 14 days old.
- Resolved versions (dev-only, via `vitest@4.1.11`): `vite@8.3.3` (published
  2026-10-06), `lightningcss@1.33.0` (published 2026-07-20), `rolldown@1.2.12`
  (published 2026-09-30). `vite@8.3.3` was published by the same GitHub Actions
  trusted publisher as earlier releases.
- The exact pin had started to block a patch: `vite@8.1.4` falls in the
  vulnerable range of GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw and
  GHSA-587h-7wmj-h5pm (HIGH, bundled `launch-editor`, Windows dev server only;
  fixed in 8.1.6 / 8.2.4 / 8.3.3). Not reachable from the production install
  or the Docker image, and webssh2 does not run the Vite dev server.
- `npm audit --audit-level=high` reports 0 vulnerabilities.

---

**Last updated:** 2026-10-20

**Next review:** 2026-10-30
