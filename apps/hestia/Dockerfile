# Hestia, with the micasa program it reads and writes through. Built from the
# repository's root: docker build -f apps/hestia/Dockerfile .
# (deploy/compose.yml does this for you.)

# The micasa release Hestia is tested against (apps/hestia/src/lib/micasa).
# Change it together with the contract tests, never on its own.
ARG MICASA_VERSION=2.8.2
FROM ghcr.io/micasa-dev/micasa:${MICASA_VERSION} AS micasa

FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ui/package.json packages/ui/
COPY apps/hestia/package.json apps/hestia/
RUN pnpm install --frozen-lockfile --filter "@atlas/hestia..."

FROM deps AS build
COPY packages/ui packages/ui
COPY apps/hestia apps/hestia
RUN pnpm --filter @atlas/hestia build

FROM node:22-alpine AS production
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 \
    # Only inside the Tailscale sidecar's network: Serve is the one way in.
    HOSTNAME=127.0.0.1 \
    MICASA_BIN=/usr/local/bin/micasa \
    MICASA_DB_PATH=/data/micasa.db
COPY --from=micasa /bin/micasa /usr/local/bin/micasa
# micasa's database lives in /data, a volume, kept across updates.
RUN mkdir -p /data && chown node:node /data
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/hestia/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/hestia/.next/static ./apps/hestia/.next/static
COPY --from=build --chown=node:node /repo/apps/hestia/public ./apps/hestia/public
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO /dev/null http://127.0.0.1:3000/manifest.webmanifest || exit 1
CMD ["node", "apps/hestia/server.js"]
