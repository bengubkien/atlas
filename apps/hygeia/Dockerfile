# Hygeia. Built from the repository's root: docker build -f apps/hygeia/Dockerfile .
# (deploy/compose.yml does this for you.)

FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ui/package.json packages/ui/
COPY packages/sync/package.json packages/sync/
COPY apps/hygeia/package.json apps/hygeia/
RUN pnpm install --frozen-lockfile --filter "@atlas/hygeia..."

FROM deps AS build
COPY packages/ui packages/ui
COPY packages/sync packages/sync
COPY apps/hygeia apps/hygeia
RUN pnpm --filter @atlas/hygeia build

FROM node:22-alpine AS production
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 \
    # Only inside the Tailscale sidecar's network: Serve is the one way in.
    HOSTNAME=127.0.0.1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/hygeia/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/hygeia/.next/static ./apps/hygeia/.next/static
COPY --from=build --chown=node:node /repo/apps/hygeia/public ./apps/hygeia/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO /dev/null http://127.0.0.1:3000/manifest.webmanifest || exit 1
CMD ["node", "apps/hygeia/server.js"]
