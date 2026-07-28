# syntax=docker/dockerfile:1.7

# The "22-alpine" tag is intentional alongside the digest: Renovate's
# matchCurrentValue rule keys on it to gate digest-only auto-merges
# (see .github/renovate.json). Docker resolves the pull via the digest;
# the tag is documentation + Renovate metadata. The Sonar rule
# docker:S8431 is suppressed for this file in sonar-project.properties.
ARG BASE_IMAGE=node:22-alpine@sha256:e58326d0d441090181ac150dc2078d3e2cf6a0d42e809aebba3ef5880935ffdd

# =============================================================================
# Stage 1: Dependencies
# Purpose: Install and cache all dependencies with BuildKit cache mounts
# This stage is optimized for layer caching and reuse
# =============================================================================
FROM ${BASE_IMAGE} AS deps
WORKDIR /srv/webssh2

# Install dependencies with cache mount for faster rebuilds
# Cache mount persists npm cache between builds
COPY package.json package-lock.json ./
COPY scripts ./scripts

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=optional --audit=false --fund=false


# =============================================================================
# Stage 2: Builder
# Purpose: Compile TypeScript to JavaScript
# Uses dependencies from deps stage to avoid reinstalling
# =============================================================================
FROM ${BASE_IMAGE} AS builder
WORKDIR /srv/webssh2

ENV NODE_ENV=development

# Copy node_modules from deps stage
COPY --from=deps /srv/webssh2/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY scripts ./scripts

# Copy source code and build
COPY tsconfig.json tsconfig.build.json ./
COPY types ./types
COPY app ./app
COPY index.ts ./

RUN npm run build


# =============================================================================
# Stage 3: Runtime
# Purpose: Minimal production image with only runtime dependencies
# Includes tini for proper init system (signal handling, zombie reaping)
# =============================================================================
FROM ${BASE_IMAGE} AS runtime
WORKDIR /srv/webssh2

# Install tini for proper signal handling and zombie process reaping, and
# upgrade the bundled npm CLI. node:22-alpine ships npm 10.x whose vendored
# tar/sigstore/brace-expansion carry CVEs (incl. CVE-2026-59873, CRITICAL)
# that are only fixed in npm >= 11.18.0 and will never be backported to 10.x,
# so waiting on base-image digest bumps cannot clear them. npm must remain in
# the runtime image for the operator host-key CLI (npm run hostkeys:prod).
# Pinned exact per supply-chain policy; bump deliberately.
RUN apk add --no-cache tini \
  && npm install -g --ignore-scripts npm@11.18.0 \
  && npm cache clean --force

ENV NODE_ENV=production \
    PORT=2222 \
    WEBSSH2_LISTEN_IP=0.0.0.0 \
    WEBSSH2_LISTEN_PORT=2222

# Copy package files for runtime
COPY package.json package-lock.json ./
COPY scripts ./scripts

# Install only production dependencies with cache mount
# Using npm ci ensures we only get prod deps without the space overhead
# of copying all deps then pruning
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=bind,from=deps,source=/srv/webssh2/node_modules,target=/tmp/node_modules \
    cp -R /tmp/node_modules . \
  && npm prune --omit=dev --omit=optional \
  && npm cache clean --force

# Copy compiled application from builder
COPY --from=builder /srv/webssh2/dist ./dist

# Copy essential documentation (smaller than copying all .md files)
COPY LICENSE README.md ./

# Create /data and hand it to the runtime user so the host-key-seed CLI
# (npm run hostkeys:prod) can write hostkeys.db there. Operators are expected
# to bind-mount or named-volume /data; without a mount the data lives in the
# container's writable layer and is destroyed on `docker rm`. No VOLUME
# directive: anonymous-volume silent data loss (on `docker rm`) is a worse
# failure mode than container-fs loss, and we want the missing-mount case to
# be an obvious operator mistake rather than a silent Docker "fix."
RUN mkdir -p /data && chown node:node /data

# Run as non-root user for security
USER node

EXPOSE 2222

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "dist/index.js"]
