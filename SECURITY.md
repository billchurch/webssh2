# Security Policy

## Supported Versions

We currently support only the latest released version of WebSSH2 with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 5.x     | :white_check_mark: |
| < 5.0.0 | :x:                |

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

**Expected legacy-inline-script violation:**

During the current deprecation window, the client HTML contains a legacy `window.webssh2Config = null;` inline script. Under `enforce` mode this script is blocked harmlessly (the JSON config block supplies the configuration), but it generates **one `csp_violation` report per page load**. This report is demoted to `debug` log level — it is not a regression and does not indicate an attack. It will be removed in a future major release.

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

- The `.trivyignore` file at the repo root suppresses this single CVE for the
  Trivy image scan gate so unrelated image regressions still fail the build.
- Tracking upstream: re-evaluate when `node:22-alpine` ships a bundled
  `npm` whose `picomatch` is `>= 4.0.4`. At that point Renovate's auto-merged
  digest bump will land the fix and the `.trivyignore` entry should be removed.

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
- Cloud IAM policies are configured so that developer or CI credentials cannot directly access production infrastructure.

For more information about detection logic or mitigations, contact the security team via [GitHub Security Advisories](https://github.com/billchurch/WebSSH2/security/advisories).

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

As of 2026-06-16, we evaluated GHSA-gv7w-rqvm-qjhr, a remote code execution
flaw in esbuild's Deno module (`lib/deno/mod.ts`) that downloads native
binaries and writes them to disk with executable permissions without integrity
verification when `NPM_CONFIG_REGISTRY` is attacker-controlled.

### Exposure assessment

| Aspect | Status |
| --- | --- |
| Affected versions | esbuild 0.17.0 - < 0.28.1 |
| Severity | HIGH (CVSS 8.1) |
| Our version | esbuild@0.28.1 (was 0.27.2) |
| Dependency path | dev-only: `vitest` / `tsx` → `vite` → esbuild |
| Status | **Patched** - pinned to 0.28.1 via `overrides` |

### Exposure context

- esbuild is a **dev-only** dependency. webssh2 builds with `tsc`, dev-runs
  with `tsx`, and tests with Vitest; esbuild never ships in a production
  artifact. There is no `vite.config` and no `import 'vite'` in source — Vite
  is present only as Vitest's internal engine.
- The vulnerable code is in esbuild's **Deno** module. webssh2 runs under
  **Node.js** (its install path uses npm `optionalDependencies` with integrity
  hashes), and there is no Deno usage anywhere in the repo, so the affected
  code path was never reachable. We were therefore not exploitable even before
  the patch.

### Action taken

- Added `overrides.esbuild: "^0.28.1"` (resolves esbuild 0.28.1, the fixed
  release) and bumped the `vite` override 7.3.2 → 7.3.5,
  `vitest` / `@vitest/coverage-v8` 4.1.4 → 4.1.9, and `tsx` → `^4.22.4`.
- The same bump also resolves the related esbuild dev-server advisory
  GHSA-g7r4-m6w7-qqqr.
- After the dependency bump, `npm audit --audit-level=high` reports 0
  vulnerabilities; the patch commit (`40b8a7c`) landed with its full test run
  passing.
- esbuild 0.28.1 was published 2026-06-11, within the 14-day quarantine window;
  the quarantine exception for HIGH-severity advisories was applied.

### Follow-up

- [#550](https://github.com/billchurch/webssh2/issues/550) tracks the optional
  cleanup of moving Vitest to Vite 8, which drops esbuild from the tree
  entirely and lets the override be removed.

---

**Last updated:** 2026-06-16

**Next review:** 2026-09-16
