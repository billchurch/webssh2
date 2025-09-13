# E2E: SSH AcceptEnv with Containerized Server

This guide shows how to run a disposable SSH server container that accepts specific environment variables, then verify that WebSSH2 forwards them end‑to‑end.

## 1) Start a test SSH server (AcceptEnv)

Using billchurch/ssh_test (alpine):

```bash
docker run --rm -d \
  -p 2289:22 \
  -e SSH_USER=testuser \
  -e SSH_PASSWORD=testpassword \
  -e SSH_AUTHORIZED_KEYS="$(cat ./test-keys/*.pub 2>/dev/null || true)" \
  -e SSH_DEBUG_LEVEL=3 \
  -e SSH_PERMIT_PASSWORD_AUTH=yes \
  -e SSH_PERMIT_PUBKEY_AUTH=yes \
  -e SSH_CUSTOM_CONFIG=$'PermitUserEnvironment yes\nAcceptEnv FOO' \
  ghcr.io/billchurch/ssh_test:alpine
```

Notes:

- Port 2244 maps to container SSH port 22.
- Accepts `FOO` from the client via `AcceptEnv`.

## 2) Start WebSSH2

```bash
DEBUG=webssh2:* npm run start
```

## 3) Connect with env via URL

Open your browser to:

```bash
http://localhost:2222/ssh/host/localhost?port=2244&env=FOO:bar
```

Authenticate with `testuser` / `testpassword`.

You should see logs like:

```bash
routes: Parsed environment variables: { FOO: 'bar' }
ssh: shell: ... and env options: { env: { TERM: 'xterm-color', FOO: 'bar' } }
```

On the SSH server logs you will see `req env` and permission for `FOO`.

## 4) Verify in the terminal

In the WebSSH2 terminal, run:

```bash
printenv FOO
```

Expected output:

```bash
bar
```

## Troubleshooting

- Ensure you used `&env=...` not a second `?` in the URL.
- If you configured `ssh.envAllowlist`, include `FOO` in the allowlist.
- Check that the SSH server includes `AcceptEnv FOO` and `PermitUserEnvironment yes`.
- Review README “Troubleshooting: AcceptEnv on SSH server”.
