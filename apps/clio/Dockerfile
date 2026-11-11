# Clio. Built from the repository's root: docker build -f apps/clio/Dockerfile .
# (deploy/compose.yml does this for you.)

FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ui/package.json packages/ui/
COPY packages/sync/package.json packages/sync/
COPY apps/clio/package.json apps/clio/
RUN pnpm install --frozen-lockfile --filter "@atlas/clio..."

FROM deps AS build
COPY packages/ui packages/ui
COPY packages/sync packages/sync
COPY apps/clio apps/clio
RUN pnpm --filter @atlas/clio build

FROM node:22-alpine AS production
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 \
    # Only inside the Tailscale sidecar's network, at the address only Serve
    # reaches (deploy/compose.yml says why).
    HOSTNAME=127.0.0.2
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/clio/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/clio/.next/static ./apps/clio/.next/static
COPY --from=build --chown=node:node /repo/apps/clio/public ./apps/clio/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO /dev/null http://127.0.0.2:3000/manifest.webmanifest || exit 1
CMD ["node", "apps/clio/server.js"]
