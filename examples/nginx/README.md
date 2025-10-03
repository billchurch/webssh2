# WebSSH2 + LinuxServer Nginx Example

This folder demonstrates how to front the published `ghcr.io/billchurch/webssh2` container with LinuxServer.io's hardened Nginx image. It is intended for local testing, so the configuration ships with a self-signed TLS bundle that trusts `https://localhost`.

## Contents

- `docker-compose.yml` — two-service stack (`webssh2`, `nginx`) wired together via a private bridge network. The proxy mounts its virtual host config and TLS material from this directory.
- `nginx.conf` — virtual host that terminates TLS, enables HTTP/1.1 + WebSocket upgrades, and forwards requests to the WebSSH2 container listening on port `2222`.
- `fullchain.pem` / `privkey.pem` — self-signed certificate and key issued for `localhost` with SAN entries for `localhost` and `127.0.0.1`. Replace these with production certificates before exposing the proxy.

## Prerequisites

- Docker Engine 24+ with Compose V2 (`docker compose`) enabled.
- A recent clone of this repository to provide the example files.
- Optional: add the generated certificate to your local trust store to avoid browser warnings when testing.

## Running the stack

```bash
cd examples/nginx
# stop any prior stack so bind mounts refresh
docker compose down
# launch WebSSH2 + Nginx
PUID=$(id -u) PGID=$(id -g) docker compose up -d
```

The `PUID`/`PGID` variables default to `1000` inside the compose file. Override them on the CLI (as shown) if your user uses a different UID/GID. After the containers are healthy, browse to `https://localhost/ssh`. Because TLS is self-signed, accept the warning or import `fullchain.pem` into your trust store.

## Customization tips

- **Certificates**: Replace `fullchain.pem` and `privkey.pem` with real certificates, ensuring permissions allow the proxy to chown/chmod them during start-up.
- **Origins**: Update `WEBSSH2_HTTP_ORIGINS` in `docker-compose.yml` so it matches the external scheme/host exactly (`https://your-domain.example`).
- **Trusted proxies**: Adjust `WEBSSH2_SSO_TRUSTED_PROXIES` to include the IPs of any reverse proxies that will inject SSO headers.
- **Ports**: Change the `ports` mapping under the `nginx` service if you need to expose a different host port (e.g., `8443:443`).

## Tear down

Stop and remove the containers when finished:

```bash
docker compose down
```

Volumes are not persisted, so destroying the stack leaves the `fullchain.pem` and `privkey.pem` files in-place for the next run.
