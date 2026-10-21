# ADR 0001: Origin allowlist for credential POSTs

- **Status:** Accepted
- **Date:** 2026-10-20
- **Issue:** [#580](https://github.com/billchurch/webssh2/issues/580)

## Context

WebSSH2 accepts credentials on four POST routes:

- `POST /ssh` and `POST /ssh/host/:host`
- `POST /telnet` and `POST /telnet/host/:host`

The route stores the posted `username`, `password` and `host` in the
visitor's session and serves the terminal page, which then connects.

Before this decision the routes had two problems:

1. With `sso.enabled` off, no CSRF check ran. Any web page could make a
   visitor's browser POST attacker-chosen credentials and a target host
   (login CSRF). The visitor then sees a terminal on a host and account
   that the attacker controls.
2. With `sso.enabled` and `sso.csrfProtection` on, the middleware
   compared a request token with `session.csrfToken`. Nothing ever set
   that value, so every POST that did not use an SSO bypass got `403`.

The bundled client never POSTs to these routes. It logs in over
Socket.IO. The routes exist for outside portals (an SSO portal, an
intranet page, an access gateway) that post credentials into WebSSH2.

## Decision

Protect the credential POST routes with an origin check against an
operator-configured allowlist, `http.allowedPostOrigins`
(`WEBSSH2_HTTP_ALLOWED_POST_ORIGINS`). The check runs when the list is
not empty, or when `sso.enabled` and `sso.csrfProtection` are both true.
Otherwise the routes behave as before.

The decision rule, evaluated in this order (first match wins):

| # | Request | Result |
| --- | --- | --- |
| 1 | `Sec-Fetch-Site: same-origin` | Accept |
| 2a | `Origin: null` | Reject |
| 2b | `Origin` listed in `allowedPostOrigins` | Accept |
| 2c | `Origin` present, not listed | Reject |
| 3 | Neither `Origin` nor `Sec-Fetch-Site` present | Accept (debug log) |
| 4 | Anything else | Reject |

When `sso.enabled` is true, requests from an `sso.trustedProxies` IP, or
that carry the SSO username or session header, skip the rule, as they
skipped the old token check.

The rule is a pure function (`app/security/post-origin.ts`) wrapped by a
thin Express middleware (`app/middleware/csrf.middleware.ts`) that is
mounted only on the four routes. The token code is removed.

## Reasons

### Why an origin allowlist and not CSRF tokens

A synchronizer token works only when the page that submits the form
first loads a token from the same server. Here the form lives on a
different site, by design. The portal cannot read a token from the
gateway without a cross-origin API, and adding one would itself need an
origin allowlist. So a token adds a moving part and no protection that
the `Origin` check does not already give.

Browsers set `Origin` and `Sec-Fetch-Site` themselves. Page scripts
cannot forge them. A forged cross-site form therefore always arrives
with the attacker's real origin, which is not on the list.

### Why requests with neither header are accepted

Every current browser sends `Origin` on a cross-site POST, and
`Sec-Fetch-Site` on every request. A browser-driven CSRF request
therefore always reaches step 2 and is judged on its `Origin`.

A request with neither header comes from curl, a script or another
server. Such a client has no access to the victim's cookies, so it
cannot perform CSRF against a victim's session. Rejecting it would
break existing integrations and gain nothing. The acceptance is logged
at debug level so operators can see it.

### Why `Origin: null` is rejected

Browsers send `null` from sandboxed iframes, `data:` and `file:` URLs,
and after some cross-origin redirects. An attacker can produce it on
demand with a sandboxed iframe. It names no site, so no allowlist entry
can vouch for it. The literal `null` is also refused as an allowlist
entry.

### Why same-origin relies only on `Sec-Fetch-Site`

The obvious alternative is to compare `Origin` with the `Host` header.
Behind a TLS-terminating reverse proxy that answer is wrong: the browser
sends `Origin: https://gw.example`, but the gateway sees plain HTTP and
may see an internal host name. Trusting `X-Forwarded-*` would need
`trust proxy` support, which is a separate change (#582).
`Sec-Fetch-Site: same-origin` is computed by the browser from the URL it
actually loaded, so it is right whatever sits in between.

### Why no wildcards

A wildcard such as `https://*.example.com` trusts every subdomain,
including any one an attacker can take over or that hosts user content.
Exact entries are easy to audit. Wildcards can be added later if a
real need appears.

## Consequences

- With `http.allowedPostOrigins` unset and SSO off, cross-site
  credential POSTs are still accepted. This keeps upgrades from changing
  behavior. SECURITY.md states this risk.
- With SSO `csrfProtection` on and no allowlist, same-origin POSTs now
  work, and cross-site POSTs stay blocked.
- Bad allowlist entries stop the server at startup with an error that
  names the entry.
- Rejections return `403 {"error":"Forbidden"}` and log a
  `policy_block` event with the route, `Origin`, `Sec-Fetch-Site` and
  the rule step. The posted body is never logged.
- The bundled client needs no change.
