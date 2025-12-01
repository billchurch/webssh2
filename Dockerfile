# syntax=docker/dockerfile:1.7

# =============================================================================
# Stage 1: Dependencies
# Purpose: Install and cache all dependencies with BuildKit cache mounts
# This stage is optimized for layer caching and reuse
# =============================================================================
FROM node:22-alpine AS deps
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
FROM node:22-alpine AS builder
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
FROM node:22-alpine AS runtime
WORKDIR /srv/webssh2

# Install tini for proper signal handling and zombie process reaping
RUN apk add --no-cache tini

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

# Run as non-root user for security
USER node

EXPOSE 2222

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "dist/index.js"]
