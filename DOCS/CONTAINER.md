# Container & Downstream Integration

This guide explains how to consume the WebSSH2 release artifact from downstream automation.
Examples include the nginx-webssh2 project or custom container images.

## Expected Artifact Layout

After downloading and extracting `webssh2-<version>.tar.gz`, the release root contains:

```
./dist/
./manifest.json
./package.json
./package-lock.json
./scripts/postinstall.js
./scripts/prestart.js
```

All commands must execute from this extracted root so the npm scripts resolve correctly.

## Recommended Install Flow

1. Download the release asset and corresponding `.sha256` checksum.
2. Verify the checksum before extraction.
3. Extract the tarball into your build context.
4. Install production dependencies for the target platform.
   ```bash
   npm ci --omit=dev --ignore-scripts
   ```
5. Optionally install native helpers if your runtime requires them.
   ```bash
   npm run prepare:runtime
   ```
6. Launch WebSSH2.
   ```bash
   NODE_ENV=production npm start
   ```

`npm run prepare:runtime` currently loads any optional native dependencies. It becomes a no-op when
`dist/` and `manifest.json` are already present.

> **Note:** Extraction via `tar` preserves file permissions. If your pipeline rewrites the
> bundle, make sure the JavaScript files in `scripts/` stay readable so Node can execute them.

`npm start` triggers `scripts/prestart.js`, which detects that the TypeScript sources are absent.
The prestart script skips rebuilding, so startup stays fast inside the container.

## CI/CD Integration Example

```bash
set -euo pipefail
TAG="webssh2-server-vX.Y.Z"
ASSET="webssh2-X.Y.Z"
curl -LO "https://github.com/billchurch/webssh2/releases/download/${TAG}/${ASSET}.tar.gz"
curl -LO "https://github.com/billchurch/webssh2/releases/download/${TAG}/${ASSET}.tar.gz.sha256"
sha256sum --check "${ASSET}.tar.gz.sha256"
mkdir -p /opt/webssh2
tar -xzf "${ASSET}.tar.gz" -C /opt/webssh2 --strip-components=0
cd /opt/webssh2
npm ci --omit=dev --ignore-scripts
npm run prepare:runtime
NODE_ENV=production npm start
```

Adjust the final step to fit your process manager (PM2, systemd, docker entrypoint, etc.).

Release tags follow the `webssh2-server-vX.Y.Z` pattern because the project uses
release-please with a package name.

## Notes for nginx-webssh2

- The artifact remains layout-compatible with earlier manual builds. Copy the `dist/`
  directory directly into your image if you prefer, but keep `package.json` and
  `package-lock.json` alongside it so `npm ci --omit=dev` can rehydrate
  platform-specific modules.
- Verify `manifest.json` and `distSha256` when promoting builds between environments.
- Ensure GNU tar is available in any custom build containers if you ever need to regenerate the artifact.
