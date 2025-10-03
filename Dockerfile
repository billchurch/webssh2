# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS builder
WORKDIR /srv/webssh2

ENV NODE_ENV=development

COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci --include=optional --audit=false --fund=false

COPY . .
RUN npm run build


FROM node:22-alpine AS runtime
WORKDIR /srv/webssh2

ENV NODE_ENV=production \
    PORT=2222 \
    WEBSSH2_LISTEN_IP=0.0.0.0 \
    WEBSSH2_LISTEN_PORT=2222

COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci --omit=dev --include=optional --audit=false --fund=false \
  && npm cache clean --force

COPY --from=builder /srv/webssh2/dist ./dist
COPY --from=builder /srv/webssh2/LICENSE ./LICENSE
COPY --from=builder /srv/webssh2/README.md ./README.md

USER node

EXPOSE 2222

CMD ["npm", "start"]
